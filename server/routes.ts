import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { db, dbConnected, serverReady } from "./db";
import { userTeams, players as playersTable, users, matches as matchesTable, matchPlayerStatus as mpsTable } from "@shared/schema";
import { eq, and, sql, or, desc } from "drizzle-orm";
import { fetchUpcomingMatches, fetchSeriesMatches, fetchSeriesList, syncMatchesFromApi, refreshStaleMatchStatuses, fetchMatchScorecard, fetchMatchInfo, ensureIPLPreviewMatches } from "./cricket-api";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { randomUUID, createHmac } from "crypto";
import pg from "pg";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const ADMIN_PHONES = ["9840872462", "9884334973", "7406020777"];
const TOKEN_SECRET = process.env.SESSION_SECRET || "cdo-session-secret-dev";

function generateAuthToken(userId: string): string {
  const hmac = createHmac("sha256", TOKEN_SECRET);
  hmac.update(userId);
  const sig = hmac.digest("hex");
  return `${userId}.${sig}`;
}

function verifyAuthToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [userId, sig] = parts;
  const hmac = createHmac("sha256", TOKEN_SECRET);
  hmac.update(userId);
  const expected = hmac.digest("hex");
  if (sig !== expected) return null;
  return userId;
}

function getEffectiveLockMs(match: { startTime: Date | string; revisedStartTime?: Date | string | null }): number {
  const effectiveStart = match.revisedStartTime ?? match.startTime;
  return new Date(effectiveStart).getTime() - 1000;
}

function checkUnlockEligibility(match: { firstScorecardAt?: Date | string | null }): { allowed: boolean; reason?: string } {
  if (!match.firstScorecardAt) return { allowed: true };
  const cutoff = new Date(match.firstScorecardAt).getTime() + 6 * 60_000;
  if (Date.now() < cutoff) return { allowed: true };
  return { allowed: false, reason: "Cannot unlock: live scorecard data has been running for more than 6 minutes" };
}

function isEntryOpen(match: {
  startTime: Date | string;
  revisedStartTime?: Date | string | null;
  adminUnlockOverride?: boolean | null;
  firstScorecardAt?: Date | string | null;
  unlockedAt?: Date | string | null;
}, nowMs: number): boolean {
  // GATE 1: Completed matches are always locked
  if ((match as any).status === 'completed') return false;

  // GATE 2: Admin unlock — 6-minute hard cutoff from firstScorecardAt
  if (match.adminUnlockOverride === true) {
    if (!match.firstScorecardAt) return true; // scoring not started yet — unlock is valid
    const cutoff = new Date(match.firstScorecardAt).getTime() + 6 * 60_000;
    return nowMs < cutoff; // hard 6-minute cutoff, no exceptions
  }

  // GATE 3: Deadline-based entry — revisedStartTime takes priority over startTime
  const effectiveDeadline = match.revisedStartTime ?? match.startTime;
  return nowMs < new Date(effectiveDeadline).getTime();
}

function isAuthenticated(req: Request, res: Response, next: Function) {
  if (req.session.userId) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userId = verifyAuthToken(token);
    if (userId) {
      req.session.userId = userId;
      return next();
    }
    console.log(`Auth failed: Bearer token invalid for ${req.path}`);
  } else {
    console.log(`Auth failed: No session or bearer token for ${req.path}, auth header: ${authHeader || 'none'}`);
  }

  return res.status(401).json({ message: "Not authenticated" });
}

async function isAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

const LIVE_CACHE_TTL_MS = 45_000;
const liveScorecardCache = new Map<string, { data: any; fetchedAt: number }>();
const liveScoreCache = new Map<string, { data: any; fetchedAt: number }>();
// Tracks matches where the squad API returned 0 results (e.g. subscription limit).
// Back off 1 hour before retrying so a busy create-team page doesn't spam the API.
const squadFetchBackoff = new Map<string, number>();
const SQUAD_BACKOFF_MS = 60 * 60 * 1000;

// ── In-memory cache for historical stats ─────────────────────────────────────
type HistoricalStats = {
  player_name: string;
  avg_cdo_points: number;
  avg_powerplay_runs: number;
  avg_middle_runs: number;
  avg_death_runs: number;
  avg_powerplay_wickets: number;
  avg_death_wickets: number;
  typical_batting_position: number;
  matches_played: number;
  batting_position_certainty: number;
  bowling_quota_certainty: number;
};

let historicalStatsCache: Map<string, HistoricalStats> | null = null;

export function invalidateHistoricalStatsCache(): void {
  historicalStatsCache = null;
  canonicalCacheIndex = null;
  console.log("[AI] Historical stats cache + canonical index invalidated.");
}

async function getHistoricalStatsCache(): Promise<Map<string, HistoricalStats>> {
  if (historicalStatsCache) return historicalStatsCache;
  console.log("[AI] Building historical stats cache from DB...");
  const rows = await db.execute(sql`
    SELECT player_name, avg_cdo_points,
           avg_powerplay_runs, avg_middle_runs, avg_death_runs,
           avg_powerplay_wickets, avg_death_wickets,
           typical_batting_position, matches_played,
           batting_position_certainty, bowling_quota_certainty
    FROM player_historical_stats
  `);
  const cache = new Map<string, HistoricalStats>();
  for (const row of rows.rows as HistoricalStats[]) {
    cache.set(row.player_name, row);
  }
  historicalStatsCache = cache;
  console.log(`[AI] Historical stats cache built — ${cache.size} players.`);
  return cache;
}

// ── Ownership cache ───────────────────────────────────────────────────────────
type OwnershipData = {
  playerOwnership: Record<string, number>;
  captainOwnership: Record<string, number>;
  vcOwnership: Record<string, number>;
  teamCount: number;
  calculatedAt: number;
  source: "real" | "proxy";
};

const ownershipCache: Record<string, OwnershipData> = {};

const CACHE_TTL_NORMAL     = 2  * 60 * 1000;
const CACHE_TTL_LOCK       = 60 * 1000;
const CACHE_MAX_STALENESS  = 5  * 60 * 1000;

async function refreshOwnershipCache(matchId: string): Promise<void> {
  try {
    const rows = await db.execute(sql`
      SELECT ut.player_ids, ut.captain_id, ut.vice_captain_id
      FROM user_teams ut
      WHERE ut.match_id = ${matchId}
    `);
    const teams = rows.rows as any[];
    const teamCount = teams.length;
    if (teamCount === 0) return;

    const playerCounts: Record<string, number> = {};
    const captainCounts: Record<string, number> = {};
    const vcCounts: Record<string, number> = {};

    for (const team of teams) {
      const ids: string[] = team.player_ids || [];
      for (const id of ids) playerCounts[id] = (playerCounts[id] || 0) + 1;
      if (team.captain_id) captainCounts[team.captain_id] = (captainCounts[team.captain_id] || 0) + 1;
      if (team.vice_captain_id) vcCounts[team.vice_captain_id] = (vcCounts[team.vice_captain_id] || 0) + 1;
    }

    const playerOwnership: Record<string, number> = {};
    const captainOwnership: Record<string, number> = {};
    const vcOwnership: Record<string, number> = {};
    for (const [id, count] of Object.entries(playerCounts)) playerOwnership[id] = count / teamCount;
    for (const [id, count] of Object.entries(captainCounts)) captainOwnership[id] = count / teamCount;
    for (const [id, count] of Object.entries(vcCounts)) vcOwnership[id] = count / teamCount;

    ownershipCache[matchId] = {
      playerOwnership, captainOwnership, vcOwnership,
      teamCount, calculatedAt: Date.now(), source: "real",
    };
  } catch (err: any) {
    console.error(`[Ownership] Refresh failed for ${matchId}:`, err.message);
  }
}

function getProxyOwnership(player: any): number {
  if (player.credits >= 9.5) return 0.65;
  if (player.role === "WK") return 0.55;
  const pos = player.battingPosition || 0;
  if (pos >= 1 && pos <= 3) return 0.55;
  if (pos >= 4 && pos <= 6) return 0.30;
  if (player.role === "BOWL") return 0.45;
  if (player.role === "AR") return 0.40;
  return 0.20;
}

function getOwnershipForMatch(
  matchId: string,
  matchStartTime: Date | string,
  players: any[]
): OwnershipData {
  const cached = ownershipCache[matchId];
  const now = Date.now();
  const minsToStart = (new Date(matchStartTime).getTime() - now) / 60000;
  const ttl = minsToStart <= 20 ? CACHE_TTL_LOCK : CACHE_TTL_NORMAL;

  if (!cached || now - cached.calculatedAt > CACHE_MAX_STALENESS) {
    console.warn(`[Ownership] Cache dead/missing for ${matchId} — using proxy`);
    const playerOwnership: Record<string, number> = {};
    for (const p of players) playerOwnership[p.id] = getProxyOwnership(p);
    return { playerOwnership, captainOwnership: {}, vcOwnership: {}, teamCount: 0, calculatedAt: now, source: "proxy" };
  }

  if (now - cached.calculatedAt > ttl) {
    console.warn(`[Ownership] Cache stale for ${matchId} — serving stale, triggering refresh`);
    refreshOwnershipCache(matchId).catch(() => {});
  }

  return cached;
}

export function startOwnershipWorker(getUpcomingMatchIds: () => Promise<string[]>): void {
  setInterval(async () => {
    try {
      const matchIds = await getUpcomingMatchIds();
      for (const matchId of matchIds) await refreshOwnershipCache(matchId);
    } catch (err: any) {
      console.error("[Ownership] Worker error:", err.message);
    }
  }, CACHE_TTL_NORMAL);
  console.log("[Ownership] Background worker started.");
}

// ── Tap counter (per user, in memory) ────────────────────────────────────────
const userTapCounters: Record<string, number> = {};

function getAiMode(userId: string): "safe" | "differential" {
  const count = (userTapCounters[userId] || 0) + 1;
  userTapCounters[userId] = count;
  return count % 2 === 0 ? "differential" : "safe";
}

// ── Name matching ─────────────────────────────────────────────────────────────
type MatchConfidence = "high" | "medium" | "low" | "none";
type MatchResult = {
  stats: HistoricalStats | null;
  confidence: MatchConfidence;
  resolvedVia: string;
};

// ── Canonicalization ──────────────────────────────────────────────────────────
function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSurname(name: string): string {
  return canonicalize(name).split(" ").pop() || "";
}

function extractInitial(name: string): string {
  return canonicalize(name)[0] || "";
}

// ── Canonical cache index ─────────────────────────────────────────────────────
let canonicalCacheIndex: Map<string, HistoricalStats> | null = null;

export function invalidateCanonicalIndex(): void {
  canonicalCacheIndex = null;
}

function buildCanonicalIndex(cache: Map<string, HistoricalStats>): Map<string, HistoricalStats> {
  if (canonicalCacheIndex && canonicalCacheIndex.size === cache.size) return canonicalCacheIndex;
  const index = new Map<string, HistoricalStats>();
  for (const row of cache.values()) index.set(canonicalize(row.player_name), row);
  canonicalCacheIndex = index;
  return index;
}

// ── DB mappings cache ─────────────────────────────────────────────────────────
let dbMappingsCache: Map<string, string> | null = null;

export function invalidateMappingsCache(): void {
  dbMappingsCache = null;
}

async function getDbMappingsCache(): Promise<Map<string, string>> {
  if (dbMappingsCache) return dbMappingsCache;
  const rows = await db.execute(sql`
    SELECT db_name, cricsheet_name, team_short
    FROM player_name_mappings
    WHERE cricsheet_name != '' AND confidence != 'unresolved'
  `);
  const map = new Map<string, string>();
  for (const row of rows.rows as any[]) {
    map.set(`${canonicalize(row.db_name)}|${row.team_short}`, row.cricsheet_name);
    map.set(canonicalize(row.db_name), row.cricsheet_name);
  }
  dbMappingsCache = map;
  console.log(`[AI Mapping] Loaded ${rows.rows.length} mappings from DB`);
  return map;
}

// ── Team name → Cricsheet full name map ───────────────────────────────────────
const TEAM_SHORT_TO_CRICSHEET: Record<string, string[]> = {
  "RR":   ["rajasthan royals"],
  "RCB":  ["royal challengers bangalore", "royal challengers bengaluru", "royal challengers"],
  "MI":   ["mumbai indians"],
  "CSK":  ["chennai super kings"],
  "KKR":  ["kolkata knight riders"],
  "SRH":  ["sunrisers hyderabad", "deccan chargers"],
  "DC":   ["delhi capitals", "delhi daredevils"],
  "PBKS": ["punjab kings", "kings xi punjab"],
  "GT":   ["gujarat titans"],
  "LSG":  ["lucknow super giants"],
};

// ── Auto-mapping job ──────────────────────────────────────────────────────────
export async function runAutoMapping(): Promise<void> {
  try {
    console.log("[AI Mapping] Starting auto-mapping (Cricsheet-first approach)...");

    // Step 1: Get all IPL players from your DB
    const dbPlayersRows = await db.execute(sql`
      SELECT DISTINCT p.name, p.team_short
      FROM players p
      WHERE p.name IS NOT NULL
        AND p.team_short IN ('RR','RCB','MI','CSK','KKR','SRH','DC','PBKS','GT','LSG')
    `);

    // Build a lookup: canonical name → { db_name, team_short }[]
    // One DB name can appear under multiple teams
    const dbByCanonical = new Map<string, { db_name: string; team_short: string }[]>();
    for (const row of dbPlayersRows.rows as any[]) {
      const key = canonicalize(row.name);
      if (!dbByCanonical.has(key)) dbByCanonical.set(key, []);
      dbByCanonical.get(key)!.push({ db_name: row.name, team_short: row.team_short });
    }

    // Also build surname → db entries lookup
    const dbBySurname = new Map<string, { db_name: string; team_short: string; canonical: string }[]>();
    for (const row of dbPlayersRows.rows as any[]) {
      const surname = extractSurname(row.name);
      if (!dbBySurname.has(surname)) dbBySurname.set(surname, []);
      dbBySurname.get(surname)!.push({
        db_name: row.name,
        team_short: row.team_short,
        canonical: canonicalize(row.name)
      });
    }

    // Step 2: Get ALL Cricsheet players
    const cricsheetRows = await db.execute(sql`
      SELECT DISTINCT player_name, team, matches_played
      FROM player_historical_stats
      ORDER BY matches_played DESC
    `);

    // Map team name → IPL team_short
    // Built from actual Cricsheet team names — covers all historical name variants
    function cricsheetTeamToShort(team: string): string | null {
      const t = canonicalize(team);
      if (t.includes("rajasthan")) return "RR";
      if (t.includes("royal challengers")) return "RCB";
      if (t.includes("mumbai")) return "MI";
      if (t.includes("chennai")) return "CSK";
      if (t.includes("kolkata")) return "KKR";
      if (t.includes("sunrisers") || t.includes("deccan")) return "SRH";
      if (t.includes("delhi")) return "DC";
      if (t.includes("punjab") || t.includes("kings xi")) return "PBKS";
      if (t.includes("gujarat")) return "GT";
      if (t.includes("lucknow")) return "LSG";
      if (t.includes("rising pune") || t.includes("kochi") || t.includes("pune warriors")) return null;
      return null;
    }

    let autoMapped = 0, alreadyMapped = 0, unresolved = 0;

    // Step 3: For each Cricsheet player, find their DB equivalent
    for (const csRow of cricsheetRows.rows as any[]) {
      const cricName: string = csRow.player_name;
      const cricTeam: string = csRow.team;
      const teamShort = cricsheetTeamToShort(cricTeam);

      // Skip non-IPL teams (defunct franchises etc.)
      if (!teamShort) continue;

      const canonicalCric = canonicalize(cricName);
      const cricSurname = extractSurname(cricName);
      const cricInit = extractInitial(cricName);

      // Find matching DB player for this team
      let dbName: string | null = null;
      let confidence = "unresolved";

      // Match 1: Exact canonical match within same team
      const exactMatches = (dbByCanonical.get(canonicalCric) || [])
        .filter(e => e.team_short === teamShort);
      if (exactMatches.length === 1) {
        dbName = exactMatches[0].db_name;
        confidence = "high";
      } else if (exactMatches.length > 1) {
        // Multiple exact matches same team — take first
        dbName = exactMatches[0].db_name;
        confidence = "high";
      }

      // Match 2: Exact canonical match ignoring team (player switched teams)
      if (!dbName) {
        const allExact = dbByCanonical.get(canonicalCric) || [];
        if (allExact.length === 1) {
          dbName = allExact[0].db_name;
          confidence = "medium";
        }
      }

      // Match 3: Surname match within same team
      if (!dbName) {
        const surnameEntries = (dbBySurname.get(cricSurname) || [])
          .filter(e => e.team_short === teamShort);
        if (surnameEntries.length === 1) {
          dbName = surnameEntries[0].db_name;
          const dbInit = extractInitial(surnameEntries[0].db_name);
          confidence = dbInit === cricInit ? "high" : "medium";
        }
      }

      if (!dbName) continue; // No DB match found — skip, don't insert

      // Skip if already manually mapped
      const existing = await db.execute(sql`
        SELECT confidence, source FROM player_name_mappings
        WHERE db_name = ${dbName} AND team_short = ${teamShort}
      `);
      if (existing.rows.length > 0) {
        const row = existing.rows[0] as any;
        if (row.source === 'admin') { alreadyMapped++; continue; }
        // Only update if new confidence is better
        const confOrder: Record<string, number> = { high: 3, medium: 2, low: 1, unresolved: 0 };
        if ((confOrder[row.confidence] || 0) >= (confOrder[confidence] || 0)) {
          alreadyMapped++;
          continue;
        }
      }

      await db.execute(sql`
        INSERT INTO player_name_mappings (db_name, cricsheet_name, team_short, confidence, source)
        VALUES (${dbName}, ${cricName}, ${teamShort}, ${confidence}, 'auto')
        ON CONFLICT (db_name, team_short) DO UPDATE SET
          cricsheet_name = EXCLUDED.cricsheet_name,
          confidence = EXCLUDED.confidence,
          updated_at = NOW()
        WHERE player_name_mappings.source != 'admin'
      `);

      autoMapped++;
    }

    dbMappingsCache = null;
    console.log(`[AI Mapping] Done: ${autoMapped} mapped, ${alreadyMapped} skipped, ${unresolved} unresolved`);
  } catch (err: any) {
    console.error("[AI Mapping] Error:", err.message);
  }
}

// ── Fallback alias table ──────────────────────────────────────────────────────
const PLAYER_ALIASES: Record<string, string> = {
  "vaibhav sooryavanshi": "Vaibhav Suryavanshi",
  "vaibhav suryavanshi":  "Vaibhav Suryavanshi",
  "yashasvi jaiswal":     "YBK Jaiswal",
  "y jaiswal":            "YBK Jaiswal",
  "ravindra jadeja":      "RA Jadeja",
  "r jadeja":             "RA Jadeja",
  "riyan parag":          "R Parag",
  "shimron hetmyer":      "SO Hetmyer",
  "s hetmyer":            "SO Hetmyer",
  "jofra archer":         "JC Archer",
  "j archer":             "JC Archer",
  "donovan ferreira":     "D Ferreira",
  "nandre burger":        "N Burger",
  "virat kohli":          "V Kohli",
  "v kohli":              "V Kohli",
  "rajat patidar":        "RM Patidar",
  "devdutt padikkal":     "D Padikkal",
  "tim david":            "TH David",
  "krunal pandya":        "KH Pandya",
  "bhuvneshwar kumar":    "B Kumar",
  "josh hazlewood":       "JR Hazlewood",
  "philip salt":          "PD Salt",
  "romario shepherd":     "R Shepherd",
  "rohit sharma":         "RG Sharma",
  "hardik pandya":        "HH Pandya",
  "ms dhoni":             "MS Dhoni",
  "shubman gill":         "Shubman Gill",
  "kl rahul":             "KL Rahul",
  "suryakumar yadav":     "SA Yadav",
  "sanju samson":         "SV Samson",
  "rishabh pant":         "R Pant",
  "pat cummins":          "PJ Cummins",
  "travis head":          "TM Head",
  "abhishek sharma":      "Abhishek Sharma",
  "shardul thakur":       "SN Thakur",
  "arshdeep singh":       "Arshdeep Singh",
  "mohammed siraj":       "Mohammed Siraj",
  "kuldeep yadav":        "Kuldeep Yadav",
  "yuzvendra chahal":     "YS Chahal",
  "washington sundar":    "W Sundar",
  "deepak chahar":        "DL Chahar",
  "faf du plessis":       "F du Plessis",
  "quinton de kock":      "Q de Kock",
  "glenn maxwell":        "GJ Maxwell",
  "dinesh karthik":       "KD Karthik",
  "shreyas iyer":         "SS Iyer",
  "ishan kishan":         "I Kishan",
  "venkatesh iyer":       "Venkatesh Iyer",
  "rasikh salam dar":     "Rasikh Dar",
  "rasikh dar":           "Rasikh Dar",
  "vicky ostwal":         "VG Ostwal",
  "jordan cox":           "JM Cox",
  "yudhvir singh charak": "Yudhvir Charak",
  "lhuan-dre pretorius":  "L Pretorius",
  "lhuan dre pretorius":  "L Pretorius",
};

// ── Name matching ─────────────────────────────────────────────────────────────
function matchPlayerToHistorical(
  dbName: string,
  cache: Map<string, HistoricalStats>,
  dbMappings?: Map<string, string>,
  teamShort?: string
): MatchResult {
  const canonicalIndex = buildCanonicalIndex(cache);
  const canonicalDb = canonicalize(dbName);

  // Step 0: DB mappings — team-aware, highest priority
  if (dbMappings) {
    const teamKey = `${canonicalDb}|${teamShort}`;
    const mappingTarget = dbMappings.get(teamKey) || dbMappings.get(canonicalDb);
    if (mappingTarget && mappingTarget !== "") {
      const row = canonicalIndex.get(canonicalize(mappingTarget)) || cache.get(mappingTarget);
      if (row && row.matches_played > 0) {
        const confidence: MatchConfidence = row.matches_played >= 10 ? "high" : row.matches_played >= 5 ? "medium" : "low";
        console.log(`[AI Match] "${dbName}" → "${row.player_name}" ${confidence.toUpperCase()} via DB-MAPPING (${row.matches_played} matches)`);
        return { stats: row, confidence, resolvedVia: "db-mapping" };
      }
    }
  }

  // Step 1: Alias table
  const aliasTarget = PLAYER_ALIASES[canonicalDb];
  if (aliasTarget) {
    const row = canonicalIndex.get(canonicalize(aliasTarget)) || cache.get(aliasTarget);
    if (row && row.matches_played > 0) {
      const confidence: MatchConfidence = row.matches_played >= 10 ? "high" : row.matches_played >= 5 ? "medium" : "low";
      console.log(`[AI Match] "${dbName}" → "${row.player_name}" ${confidence.toUpperCase()} via ALIAS (${row.matches_played} matches)`);
      return { stats: row, confidence, resolvedVia: "alias" };
    }
  }

  // Step 2: Exact canonical match
  const exactMatch = canonicalIndex.get(canonicalDb);
  if (exactMatch && exactMatch.matches_played > 0) {
    const confidence: MatchConfidence = exactMatch.matches_played >= 10 ? "high" : exactMatch.matches_played >= 5 ? "medium" : "low";
    console.log(`[AI Match] "${dbName}" → "${exactMatch.player_name}" ${confidence.toUpperCase()} via EXACT (${exactMatch.matches_played} matches)`);
    return { stats: exactMatch, confidence, resolvedVia: "exact" };
  }

  // Step 3: Surname + initial
  const dbSurname = extractSurname(dbName);
  const dbInit = extractInitial(dbName);
  const dbHasInitialOnly = canonicalDb.split(" ").length <= 2 && canonicalDb.split(" ")[0].length <= 2;

  const candidates: HistoricalStats[] = [];
  for (const row of cache.values()) {
    if (extractSurname(row.player_name) === dbSurname) candidates.push(row);
  }

  if (candidates.length === 0) {
    console.log(`[AI Match] "${dbName}" → NONE (no match found)`);
    return { stats: null, confidence: "none", resolvedVia: "no-match" };
  }

  if (candidates.length === 1) {
    const row = candidates[0];
    const mp = row.matches_played;
    if (mp === 0) return { stats: null, confidence: "none", resolvedVia: "zero-matches" };
    const cricInit = extractInitial(row.player_name);
    if (dbInit === cricInit) {
      const confidence: MatchConfidence = mp >= 10 ? "high" : mp >= 5 ? "medium" : "low";
      console.log(`[AI Match] "${dbName}" → "${row.player_name}" ${confidence.toUpperCase()} via SURNAME+INITIAL (${mp} matches)`);
      return { stats: row, confidence, resolvedVia: "surname-initial" };
    }
    if (!dbHasInitialOnly) {
      console.log(`[AI Match] "${dbName}" → "${row.player_name}" MEDIUM via SURNAME-ONLY (${mp} matches)`);
      return { stats: row, confidence: "medium", resolvedVia: "surname-only" };
    }
    console.log(`[AI Match] "${dbName}" → NONE (initial conflict)`);
    return { stats: null, confidence: "none", resolvedVia: "initial-conflict" };
  }

  const initMatches = candidates.filter(c => extractInitial(c.player_name) === dbInit);
  if (initMatches.length === 1) {
    const row = initMatches[0];
    const mp = row.matches_played;
    if (mp === 0) return { stats: null, confidence: "none", resolvedVia: "zero-matches" };
    const confidence: MatchConfidence = mp >= 10 ? "high" : mp >= 5 ? "medium" : "low";
    console.log(`[AI Match] "${dbName}" → "${row.player_name}" ${confidence.toUpperCase()} via COLLISION-RESOLVED (${mp} matches)`);
    return { stats: row, confidence, resolvedVia: "collision-resolved" };
  }

  console.log(`[AI Match] "${dbName}" → NONE (collision unresolved — ${candidates.length} candidates)`);
  return { stats: null, confidence: "none", resolvedVia: "collision-unresolved" };
}


export async function registerRoutes(app: Express): Promise<Server> {
  const PgStore = connectPgSimple(session);
  const dbUrl = process.env.DATABASE_URL || '';
  const needsSsl = dbUrl.includes('railway') || dbUrl.includes('rlwy');
  const sessionPool = new pg.Pool({
    connectionString: dbUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  sessionPool.on("error", (err) => {
    console.error("[DB:session] Unexpected pool error:", err.message);
  });

  sessionPool.on("connect", (client) => {
    client.query("SET statement_timeout = 5000").catch((err) => {
      console.error("[DB:session] Failed to set statement_timeout:", err.message);
    });
  });

  app.use(
    session({
      store: new PgStore({
        pool: sessionPool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "cdo-session-secret-dev",
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        secure: "auto" as any,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  // ---- HEALTH CHECK ----
  app.get("/health", async (_req: Request, res: Response) => {
    let dbStatus = "disconnected";
    try {
      const client = await sessionPool.connect();
      await client.query("SELECT 1");
      client.release();
      dbStatus = "connected";
    } catch {
      dbStatus = "disconnected";
    }
    res.status(dbStatus === "connected" ? 200 : 503).json({
      server: "running",
      database: dbStatus,
    });
  });

  app.get("/ready", async (_req: Request, res: Response) => {
    const checks = {
      database: false,
      api: serverReady,
      routes: true,
    };

    try {
      const client = await sessionPool.connect();
      await client.query("SELECT 1");
      client.release();
      checks.database = true;
    } catch {
      checks.database = false;
    }

    const allReady = checks.database && checks.api && checks.routes;
    res.status(allReady ? 200 : 503).json({
      ready: allReady,
      checks,
    });
  });

  // ---- AUTH ----
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { username, email, phone, password } = req.body;
      if (!username || !phone || !password) {
        return res
          .status(400)
          .json({ message: "Username, phone number, and password are required" });
      }

      const existingPhone = await storage.getUserByPhone(phone);
      if (existingPhone) {
        return res.status(400).json({ message: "Phone number already in use" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }

      if (email) {
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      const isAdminUser = ADMIN_PHONES.includes(phone);
      const user = await storage.createUser({
        username,
        email: email || null,
        phone: phone || "",
        password,
      });

      if (isAdminUser) {
        await storage.setUserAdmin(user.id, true);
        await storage.updateUserVerified(user.id, true);
        user.isAdmin = true;
        user.isVerified = true;
      }

      if (user.isVerified) {
        req.session.userId = user.id;
        return res.json({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            teamName: user.teamName,
            isVerified: user.isVerified,
            isAdmin: user.isAdmin,
          },
          token: generateAuthToken(user.id),
        });
      }

      return res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          teamName: user.teamName,
          isVerified: false,
          isAdmin: false,
        },
        message: "pending_approval",
      });
    } catch (err: any) {
      console.error("Signup error:", err);
      return res.status(500).json({ message: "Signup failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res
          .status(400)
          .json({ message: "Phone number and password are required" });
      }

      const user = await storage.getUserByPhone(phone);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (ADMIN_PHONES.includes(phone) && !user.isAdmin) {
        await storage.setUserAdmin(user.id, true);
        user.isAdmin = true;
      }

      if (!user.isVerified && !user.isAdmin) {
        return res.status(403).json({ message: "pending_approval", detail: "Your account is pending admin approval. Please wait for an admin to approve your signup." });
      }

      req.session.userId = user.id;
      return res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          teamName: user.teamName,
          isVerified: user.isVerified,
          isAdmin: user.isAdmin,
        },
        token: generateAuthToken(user.id),
      });
    } catch (err: any) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {});
    return res.json({ ok: true });
  });

  app.post('/api/push-token', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: 'Token required' });
      }
      await storage.savePushToken(req.session.userId!, token);
      return res.json({ success: true });
    } catch (e) {
      console.error('Push token save error:', e);
      return res.status(500).json({ message: 'Failed to save token' });
    }
  });

  // ── Cricsheet loader — trigger + progress ─────────────────────────────────────

  // ── Player name mappings admin endpoints ────────────────────────────────────

  app.get(
    "/api/admin/player-mappings/search",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const query = (req.query.q as string || "").toLowerCase().trim();
        if (!query || query.length < 2) {
          return res.status(400).json({ message: "q param required (min 2 chars)" });
        }
        const rows = await db.execute(sql`
          SELECT DISTINCT player_name, team, matches_played, avg_cdo_points
          FROM player_historical_stats
          WHERE LOWER(player_name) LIKE ${('%' + query + '%')}
          ORDER BY matches_played DESC
          LIMIT 20
        `);
        return res.json({ results: rows.rows, count: rows.rows.length });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get(
    "/api/admin/player-mappings/unresolved",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const rows = await db.execute(sql`
          SELECT db_name, team_short, confidence, source, updated_at
          FROM player_name_mappings
          WHERE confidence = 'unresolved' OR cricsheet_name = ''
          ORDER BY team_short, db_name
        `);
        return res.json({ mappings: rows.rows, count: rows.rows.length });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/player-mappings",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { dbName, cricsheetName, teamShort } = req.body;
        if (!dbName || !cricsheetName || !teamShort) {
          return res.status(400).json({ message: "dbName, cricsheetName, teamShort required" });
        }
        await db.execute(sql`
          INSERT INTO player_name_mappings (db_name, cricsheet_name, team_short, confidence, source)
          VALUES (${dbName}, ${cricsheetName}, ${teamShort}, 'manual', 'admin')
          ON CONFLICT (db_name, team_short) DO UPDATE SET
            cricsheet_name = EXCLUDED.cricsheet_name,
            confidence = 'manual',
            source = 'admin',
            updated_at = NOW()
        `);
        dbMappingsCache = null;
        return res.json({ message: `Mapped "${dbName}" → "${cricsheetName}" for ${teamShort}` });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/player-mappings/auto-map",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        runAutoMapping().catch(err => console.error("[AI Mapping] Error:", err));
        return res.json({ message: "Auto-mapping started in background" });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // ── AI Match Diagnostics endpoint ───────────────────────────────────────────
  app.get(
    "/api/admin/ai-diagnostics/:matchId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.matchId;
        const matchPlayers = await storage.getPlayersForMatch(matchId);
        const historicalCache = await getHistoricalStatsCache();

        const dbMappings = await getDbMappingsCache();
        const results = matchPlayers.map(p => {
          const { stats, confidence, resolvedVia } = matchPlayerToHistorical(p.name, historicalCache, dbMappings, p.teamShort);
          return {
            name: p.name,
            teamShort: p.teamShort,
            role: p.role,
            isPlayingXI: p.isPlayingXI,
            confidence,
            resolvedVia,
            matched: stats !== null,
            cricsheetName: stats?.player_name ?? null,
            matchesPlayed: stats?.matches_played ?? 0,
            avgCdoPoints: stats?.avg_cdo_points ?? 0,
          };
        });

        const matched = results.filter(r => r.matched);
        const unresolved = results.filter(r => !r.matched);
        const byConfidence = {
          high:   matched.filter(r => r.confidence === "high").length,
          medium: matched.filter(r => r.confidence === "medium").length,
          low:    matched.filter(r => r.confidence === "low").length,
        };

        return res.json({
          matchId,
          totalPlayers: results.length,
          matched: matched.length,
          unresolved: unresolved.length,
          byConfidence,
          details: results,
          unresolvedNames: unresolved.map(r => r.name),
        });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/rebuild-historical-stats",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const { rebuildHistoricalStatsPublic } = await import("./cricsheet-loader");
        rebuildHistoricalStatsPublic().catch((err) => {
          console.error("[Cricsheet] Rebuild error:", err);
        });
        return res.json({ message: "Rebuilding player_historical_stats in background..." });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/load-cricsheet",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const { getLoaderProgress, loadCricsheetData } = await import("./cricsheet-loader");
        const current = getLoaderProgress();
        if (current.status === "running") {
          return res.json({
            message: "Loader already running",
            progress: current,
          });
        }
        // Fire and forget — runs in background
        loadCricsheetData().catch((err) => {
          console.error("[Cricsheet] Background load error:", err);
        });
        return res.json({
          message: "Cricsheet loader started. Poll /api/admin/load-cricsheet/progress to track.",
        });
      } catch (err: any) {
        console.error("[Cricsheet] Failed to start loader:", err);
        return res.status(500).json({ message: "Failed to start loader", error: err.message });
      }
    }
  );

  app.get(
    "/api/admin/load-cricsheet/progress",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const { getLoaderProgress } = await import("./cricsheet-loader");
        return res.json(getLoaderProgress());
      } catch (err: any) {
        return res.status(500).json({ message: "Could not get progress", error: err.message });
      }
    }
  );

  // ---- TEST: Send push notification to all registered tokens ----
  app.post('/api/admin/test-notification', isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const { notifyMatchStartingSoon } = await import('./notifications');
      await notifyMatchStartingSoon('TEST', 'MATCH');
      return res.json({ message: 'Test notification sent — check Railway logs for [FCM] lines' });
    } catch (e: any) {
      console.error('[FCM] Test notification error:', e);
      return res.status(500).json({ message: e.message });
    }
  });

  // ── DEV ONLY ── players by team short names (supports mock match UI testing)
  // Strategy: try DB first per team; if a team has 0 DB players, fall back to
  // the IPL 2026 series squad via the cricket API.
  const IPL_2026_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f";
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/dev/players", async (req: Request, res: Response) => {
      const teamsParam = typeof req.query.teams === "string" ? req.query.teams : "";
      const teams = teamsParam.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 2);
      if (teams.length < 2) return res.json({ players: [], lastMatchXI: {} });

      const allPlayers: any[] = [];
      const teamsNeedingApiData: string[] = [];

      // Step 1: try DB for each team
      for (const teamShort of teams) {
        const [recent] = await db
          .select({ id: matchesTable.id })
          .from(matchesTable)
          .where(or(eq(matchesTable.team1Short, teamShort), eq(matchesTable.team2Short, teamShort)))
          .orderBy(desc(matchesTable.startTime))
          .limit(1);
        if (recent) {
          const teamPlayers = await storage.getPlayersForMatch(recent.id);
          const filtered = teamPlayers.filter((p) => p.teamShort === teamShort);
          if (filtered.length > 0) {
            allPlayers.push(...filtered);
            console.log(`[DEV players] DB: ${filtered.length} players for ${teamShort}`);
          } else {
            teamsNeedingApiData.push(teamShort);
          }
        } else {
          teamsNeedingApiData.push(teamShort);
        }
      }

      // Step 2: for teams with no DB data, fetch from IPL 2026 series squad API
      if (teamsNeedingApiData.length > 0) {
        console.log(`[DEV players] No DB data for ${teamsNeedingApiData.join(", ")} — fetching from series squad API`);
        const { fetchSeriesSquad } = await import("./cricket-api");
        const seriesPlayers = await fetchSeriesSquad(IPL_2026_SERIES_ID);
        console.log(`[DEV players] Series squad returned ${seriesPlayers.length} total players`);

        for (const teamShort of teamsNeedingApiData) {
          const apiTeamPlayers = seriesPlayers.filter((p) => p.teamShort === teamShort);
          console.log(`[DEV players] API: ${apiTeamPlayers.length} players for ${teamShort}`);
          // Shape into a Player-compatible object (no DB id/matchId — use externalId as id)
          allPlayers.push(
            ...apiTeamPlayers.map((p) => ({
              id: p.externalId,
              matchId: `mock-dev`,
              externalId: p.externalId,
              name: p.name,
              team: p.team,
              teamShort: p.teamShort,
              role: p.role,
              credits: p.credits,
              points: 0,
              selectedBy: 0,
              recentForm: [],
              isImpactPlayer: false,
              isPlayingXI: false,
              apiName: p.name,
            }))
          );
        }
      }

      console.log(`[DEV players] Total returned: ${allPlayers.length} players for teams [${teams.join(", ")}]`);
      return res.json({ players: allPlayers, lastMatchXI: {} });
    });
  }

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    let userId = req.session.userId;

    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        userId = verifyAuthToken(authHeader.slice(7)) || undefined;
      }
    }

    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        teamName: user.teamName,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
      },
    });
  });

  app.put(
    "/api/auth/team-name",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { teamName } = req.body;
        if (!teamName || typeof teamName !== "string" || teamName.trim().length === 0) {
          return res.status(400).json({ message: "Team name is required" });
        }
        if (teamName.trim().length > 30) {
          return res.status(400).json({ message: "Team name must be 30 characters or less" });
        }
        await storage.updateUserTeamName(req.session.userId!, teamName.trim());
        return res.json({ teamName: teamName.trim() });
      } catch (err: any) {
        console.error("Update team name error:", err);
        return res.status(500).json({ message: "Failed to update team name" });
      }
    }
  );

  // ---- REFERENCE CODES ----
  app.post(
    "/api/auth/verify-code",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { code } = req.body;
        if (!code || code.length !== 4) {
          return res.status(400).json({ message: "Invalid code format" });
        }

        const codeRecord = await storage.getActiveCode(code);
        if (!codeRecord) {
          return res.status(400).json({ message: "Invalid or inactive code" });
        }

        await storage.updateUserVerified(req.session.userId!, true);
        await storage.logCodeVerification(req.session.userId!, codeRecord.id);

        return res.json({ verified: true });
      } catch (err: any) {
        console.error("Code verification error:", err);
        return res.status(500).json({ message: "Verification failed" });
      }
    }
  );

  // ---- ADMIN: CODES ----
  app.get(
    "/api/admin/codes",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      const codes = await storage.getAllCodes();
      return res.json({ codes });
    }
  );

  app.post(
    "/api/admin/codes",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { code } = req.body;
        if (!code || code.length !== 4) {
          return res.status(400).json({ message: "Code must be 4 digits" });
        }

        const existing = await storage.getActiveCode(code);
        if (existing) {
          return res.status(400).json({ message: "Code already exists" });
        }

        const created = await storage.createCode(code, req.session.userId);
        return res.json({ code: created });
      } catch (err: any) {
        console.error("Create code error:", err);
        return res.status(500).json({ message: "Failed to create code" });
      }
    }
  );

  app.delete(
    "/api/admin/codes/:id",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      await storage.deleteCode(req.params.id);
      return res.json({ ok: true });
    }
  );

  // ---- ADMIN: MAKE ADMIN ----
  app.post(
    "/api/admin/make-admin",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId required" });
      await storage.setUserAdmin(userId, true);
      return res.json({ ok: true });
    }
  );

  app.post(
    "/api/admin/promote-by-phone",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ message: "phone required" });
      const user = await storage.getUserByPhone(phone);
      if (!user) return res.status(404).json({ message: "User not found" });
      await storage.setUserAdmin(user.id, true);
      return res.json({ ok: true, username: user.username });
    }
  );

  // ---- MATCHES ----
  app.get("/api/matches", isAuthenticated, async (_req: Request, res: Response) => {
    try { await refreshStaleMatchStatuses(); } catch (e) { console.error("Status refresh error:", e); }
    const allMatches = await storage.getAllMatches();

    // Display-layer: ensure next 5 upcoming IPL fixtures are in DB so they show
    // on the Home screen independently of the 48-hour auto-sync mechanism.
    try {
      const newIPL = await ensureIPLPreviewMatches(allMatches);
      if (newIPL.length > 0) allMatches.push(...newIPL);
    } catch (e) { console.error("IPL preview error:", e); }

    const nowMs = Date.now();
    const MS_7D = 7 * 24 * 60 * 60 * 1000;
    const MS_3H = 3 * 60 * 60 * 1000;
    const MS_24H = 24 * 60 * 60 * 1000;

    // Define here so it can be used both in the loop and the cap step below.
    const isIPLLeague = (league: string) => {
      const l = (league || "").toLowerCase();
      return l.includes("indian premier league") || l.includes(" ipl") || l.startsWith("ipl ");
    };

    const matchesWithParticipants: { match: typeof allMatches[0]; participantCount: number }[] = [];

    for (const m of allMatches) {
      const startMs = new Date(m.startTime).getTime();

      const teams = await storage.getAllTeamsForMatch(m.id);
      const uniqueUsers = new Set(teams.map(t => t.userId));
      const participantCount = uniqueUsers.size;

      const isUpcomingOrDelayed = m.status === "upcoming" || m.status === "delayed";
      const startsWithin7d = startMs <= nowMs + MS_7D;
      const isUpcoming = isUpcomingOrDelayed && startsWithin7d;

      const isLive = m.status === "live";

      // IPL preview: always include upcoming API-sourced IPL matches regardless of time window.
      // The display cap below limits this to the next 5, so this won't flood the feed.
      const isIPLPreview = m.status === "upcoming" && isIPLLeague(m.league || "") && !!m.externalId;

      // Completed matches within last 24h — keep visible so admin can settle winner / recalculate.
      const isRecentlyCompleted = m.status === "completed" && startMs >= nowMs - MS_24H;

      // Home feed: show all upcoming (within 7d), live, delayed, IPL preview, and recently completed.
      // Admin controls what's in the DB — everything in DB is intentional.
      const included = isUpcoming || isLive || (m.status === "delayed") || isIPLPreview || isRecentlyCompleted;

      if (included) {
        matchesWithParticipants.push({ match: m, participantCount });
      }
    }

    // IPL display cap: show only the next 5 upcoming IPL matches (from API-sourced pool).
    // Applies only to matches that are (a) IPL by league AND (b) have an externalId,
    // which means they came from the API (auto-sync, admin-import, or IPL preview).
    // Manually admin-created matches never have an externalId and are always shown.
    // Live and delayed IPL matches are never capped — they are happening now.

    const upcomingIPLFromApi = matchesWithParticipants
      .filter(mp => mp.match.status === "upcoming" && isIPLLeague(mp.match.league) && !!mp.match.externalId)
      .sort((a, b) => new Date(a.match.startTime).getTime() - new Date(b.match.startTime).getTime());

    const top5IPLIds = new Set(upcomingIPLFromApi.slice(0, 5).map(mp => mp.match.id));

    const cappedMatches = matchesWithParticipants.filter(mp => {
      const isApiIPL = isIPLLeague(mp.match.league) && !!mp.match.externalId;
      if (!isApiIPL) return true;                          // non-IPL or manually-created: always show
      if (mp.match.status !== "upcoming") return true;    // live/delayed IPL: always show
      return top5IPLIds.has(mp.match.id);                 // upcoming API IPL: only next 5
    });

    cappedMatches.sort((a, b) => {
      const order: Record<string, number> = { live: 0, delayed: 0, upcoming: 1, completed: 2 };
      const oa = order[a.match.status] ?? 1;
      const ob = order[b.match.status] ?? 1;
      if (oa !== ob) return oa - ob;
      if (a.match.status === 'completed' && b.match.status === 'completed') {
        if (a.participantCount > 0 && b.participantCount === 0) return -1;
        if (a.participantCount === 0 && b.participantCount > 0) return 1;
      }
      if (a.match.status === 'upcoming' || a.match.status === 'delayed') {
        return new Date(a.match.startTime).getTime() - new Date(b.match.startTime).getTime();
      }
      return new Date(b.match.startTime).getTime() - new Date(a.match.startTime).getTime();
    });

    const result = cappedMatches.map((mp) => ({
      ...mp.match,
      participantCount: mp.participantCount,
    }));

    return res.json({ matches: result });
  });

  app.get(
    "/api/matches/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });
      const allTeams = await storage.getAllTeamsForMatch(req.params.id);
      const uniqueUsers = new Set(allTeams.map(t => t.userId));
      return res.json({ match: { ...match, spotsFilled: uniqueUsers.size, participantCount: uniqueUsers.size } });
    }
  );

  app.get(
    "/api/matches/:id/players",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const matchId = req.params.id;
      let matchPlayers = await storage.getPlayersForMatch(matchId);

      // Auto-fetch squad when fewer than 15 players exist (covers: empty match AND matches where
      // only replacement players have been seeded — not just the strict === 0 case).
      const SQUAD_MIN = 15;
      const backoffUntil = squadFetchBackoff.get(matchId) ?? 0;
      const squadFetchAllowed = matchPlayers.length < SQUAD_MIN && Date.now() > backoffUntil;
      if (squadFetchAllowed) {
        const match = await storage.getMatch(matchId);
        if (match?.externalId) {
          try {
            const { fetchMatchSquad, fetchSeriesSquad } = await import("./cricket-api");
            let squad = await fetchMatchSquad(match.externalId);

            if (squad.length === 0 && match.seriesId) {
              console.log(`Match squad empty, trying series squad for series ${match.seriesId}...`);
              const seriesPlayers = await fetchSeriesSquad(match.seriesId);
              const team1 = match.team1.toLowerCase();
              const team2 = match.team2.toLowerCase();
              squad = seriesPlayers.filter((p) => {
                const pTeam = p.team.toLowerCase();
                return pTeam === team1 || pTeam === team2 ||
                  pTeam.includes(team1) || team1.includes(pTeam) ||
                  pTeam.includes(team2) || team2.includes(pTeam);
              });
              if (squad.length > 0) {
                console.log(`Found ${squad.length} players from series squad for ${match.team1} vs ${match.team2}`);
              }
            }

            if (squad.length > 0) {
              const playersToCreate = squad.map((p) => ({
                matchId,
                externalId: p.externalId,
                name: p.name,
                team: p.team,
                teamShort: p.teamShort,
                role: p.role,
                credits: p.credits,
              }));
              await storage.upsertPlayersForMatch(matchId, playersToCreate);
              matchPlayers = await storage.getPlayersForMatch(matchId);
              console.log(`Auto-fetched ${matchPlayers.length} players for match ${matchId}`);
              squadFetchBackoff.delete(matchId); // success — clear backoff
            } else {
              // API returned 0 — back off to avoid hammering an unavailable endpoint
              squadFetchBackoff.set(matchId, Date.now() + SQUAD_BACKOFF_MS);
              console.log(`[SquadFetch] 0 players returned for match ${matchId} — backing off 1h`);
            }
          } catch (err) {
            console.error("Auto-fetch squad error:", err);
            squadFetchBackoff.set(matchId, Date.now() + SQUAD_BACKOFF_MS);
          }
        }
      }

      // Build last-match XI for each team (used by frontend ALL-tab ordering)
      let lastMatchXI: Record<string, { xi: string[]; impact: string | null }> = {};
      try {
        const matchForXI = await storage.getMatch(matchId);
        if (matchForXI) {
          for (const teamShort of [matchForXI.team1Short, matchForXI.team2Short]) {
            const [prevMatch] = await db
              .select({ id: matchesTable.id })
              .from(matchesTable)
              .where(
                and(
                  sql`(${matchesTable.team1Short} = ${teamShort} OR ${matchesTable.team2Short} = ${teamShort})`,
                  eq(matchesTable.status, "completed"),
                  sql`${matchesTable.id} != ${matchId}`
                )
              )
              .orderBy(sql`${matchesTable.startTime} DESC`)
              .limit(1);

            if (prevMatch) {
              const prevPlayers = await storage.getPlayersForMatch(prevMatch.id);
              const teamPrev = prevPlayers.filter((p) => p.teamShort === teamShort);
              const xi = teamPrev
                .filter((p) => p.isPlayingXI)
                .sort((a, b) => b.credits - a.credits)
                .map((p) => p.name);
              const impactPlayer = teamPrev.find(
                (p) => p.isImpactPlayer && !p.isPlayingXI
              );
              lastMatchXI[teamShort] = {
                xi,
                impact: impactPlayer?.name ?? null,
              };
            }
          }
        }
      } catch (err) {
        console.error("[lastMatchXI] fetch error:", err);
        lastMatchXI = {};
      }

      // Build per-player historical points (lastMatchPoints + tournamentPoints)
      // Reuses the same prev-match queries as lastMatchXI — safe, read-only, no schema changes
      const playerPointsMap: Record<string, { lastMatchPoints: number | null; tournamentPoints: number | null }> = {};
      try {
        const matchForPts = await storage.getMatch(matchId);
        if (matchForPts && matchPlayers.length > 0) {
          // 1. Last match points — find the most recent completed match with synced scorecard
          // (i.e., at least one player for this team has points > 0)
          const prevPointsLookup: Record<string, number> = {}; // "name|teamShort" → points
          for (const teamShort of [matchForPts.team1Short, matchForPts.team2Short]) {
            const [prevMatch] = await db
              .select({ id: matchesTable.id })
              .from(matchesTable)
              .where(
                and(
                  sql`(${matchesTable.team1Short} = ${teamShort} OR ${matchesTable.team2Short} = ${teamShort})`,
                  eq(matchesTable.status, "completed"),
                  sql`${matchesTable.id} != ${matchId}`,
                  sql`EXISTS (SELECT 1 FROM players p WHERE p.match_id = ${matchesTable.id} AND p.team_short = ${teamShort} AND p.points > 0)`
                )
              )
              .orderBy(sql`${matchesTable.startTime} DESC`)
              .limit(1);
            if (prevMatch) {
              const prevPlayers = await storage.getPlayersForMatch(prevMatch.id);
              for (const p of prevPlayers) {
                if (p.teamShort === teamShort && p.points > 0) {
                  prevPointsLookup[`${p.name}|${p.teamShort}`] = p.points;
                }
              }
            }
          }

          // 2. Tournament total points — single aggregated query
          const tournamentTotalsLookup: Record<string, number> = {};
          if (matchForPts.tournamentName) {
            const rows = await db
              .select({
                name: playersTable.name,
                teamShort: playersTable.teamShort,
                total: sql<number>`CAST(SUM(${playersTable.points}) AS INTEGER)`,
              })
              .from(playersTable)
              .innerJoin(matchesTable, eq(playersTable.matchId, matchesTable.id))
              .where(
                and(
                  eq(matchesTable.tournamentName, matchForPts.tournamentName),
                  eq(matchesTable.status, "completed"),
                  sql`${playersTable.points} > 0`
                )
              )
              .groupBy(playersTable.name, playersTable.teamShort);
            for (const row of rows) {
              tournamentTotalsLookup[`${row.name}|${row.teamShort}`] = row.total;
            }
          }

          // 3. Build per-player map
          for (const p of matchPlayers) {
            const key = `${p.name}|${p.teamShort}`;
            playerPointsMap[p.id] = {
              lastMatchPoints: prevPointsLookup[key] ?? null,
              tournamentPoints: tournamentTotalsLookup[key] ?? null,
            };
          }
        }
      } catch (err) {
        console.error("[playerPoints] fetch error:", err);
      }

      // Normalize player.teamShort to the canonical match short codes.
      // Players created via API may carry different short codes than those stored
      // on the match (e.g. player.teamShort='HHK' while match.team2Short='HK').
      // This causes the ALL-tab grouping (exact string equality) to show 0 players
      // for one team.  We fix it here so every downstream consumer gets clean data.
      try {
        const matchForNorm = await storage.getMatch(matchId);
        if (matchForNorm) {
          const t1s = matchForNorm.team1Short ?? '';
          const t2s = matchForNorm.team2Short ?? '';
          const t1f = (matchForNorm.team1 ?? '').toLowerCase();
          const t2f = (matchForNorm.team2 ?? '').toLowerCase();

          matchPlayers = matchPlayers.map((p) => {
            if (p.teamShort === t1s || p.teamShort === t2s) return p; // already canonical
            const ps = (p.teamShort ?? '').toLowerCase();
            const pt = (p.team ?? '').toLowerCase();

            // Signal 1: full team name (most reliable — API short codes can vary)
            if (pt.length > 2 && t1f.length > 2 && (pt === t1f || t1f.includes(pt) || pt.includes(t1f))) {
              return { ...p, teamShort: t1s };
            }
            if (pt.length > 2 && t2f.length > 2 && (pt === t2f || t2f.includes(pt) || pt.includes(t2f))) {
              return { ...p, teamShort: t2s };
            }
            // Signal 2: short code — one ends with the other (e.g. HHK ↔ HK, INA ↔ IN)
            const t1sl = t1s.toLowerCase();
            const t2sl = t2s.toLowerCase();
            if (ps.endsWith(t1sl) || t1sl.endsWith(ps)) return { ...p, teamShort: t1s };
            if (ps.endsWith(t2sl) || t2sl.endsWith(ps)) return { ...p, teamShort: t2s };

            return p; // no normalization found — keep as-is
          });
        }
      } catch (normErr) {
        console.error("[teamShort normalization] error:", normErr);
        // non-fatal — continue with un-normalized players
      }

      // Overlay match-specific adminStatus so isImpactPlayer/isPlayingXI never
      // bleed across matches from the global player record flag.
      const statuses = await storage.getMatchPlayerStatuses(matchId);
      const statusMap = new Map(statuses.map(s => [s.playerId, s]));

      const activatedImpactIds = new Set(
        statuses.filter(s => s.officialImpactSubUsed === true).map(s => s.playerId)
      );

      const augmentedPlayers = matchPlayers.map((p) => ({
        ...p,
        isImpactPlayer: statusMap.get(p.id)?.adminStatus === 'impact_sub',
        isImpactActivated: activatedImpactIds.has(p.id),
        isPlayingXI: p.isPlayingXI,
        lastMatchPoints: playerPointsMap[p.id]?.lastMatchPoints ?? null,
        tournamentPoints: playerPointsMap[p.id]?.tournamentPoints ?? null,
      }));

      return res.json({ players: augmentedPlayers, lastMatchXI });
    }
  );

  app.post(
    "/api/matches/:id/sync-scorecard",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const matchId = req.params.id;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });
      if (!match.externalId) return res.status(400).json({ message: "No external match ID" });

      try {
        const { fetchMatchScorecard } = await import("./cricket-api");
        const result = await fetchMatchScorecard(match.externalId);
        const pointsMap = result.pointsMap;
        const namePointsMap = result.namePointsMap;

        if (pointsMap.size === 0) {
          return res.json({ message: "No scorecard data available yet", updated: 0 });
        }

        const matchPlayers = await storage.getPlayersForMatch(matchId);
        let updated = 0;
        for (const player of matchPlayers) {
          let pts: number | undefined = undefined;
          if (player.externalId && pointsMap.has(player.externalId)) {
            pts = pointsMap.get(player.externalId)!;
          }
          if (pts === undefined && namePointsMap.size > 0 && player.name) {
            const normName = player.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
            if (namePointsMap.has(normName)) {
              pts = namePointsMap.get(normName)!;
            } else {
              for (const [apiName, apiPts] of namePointsMap) {
                if (apiName.includes(normName) || normName.includes(apiName)) {
                  pts = apiPts;
                  break;
                }
                const p1 = apiName.split(" "), p2 = normName.split(" ");
                if (p1.length > 0 && p2.length > 0 && p1[0][0] === p2[0][0]) {
                  const l1 = p1[p1.length-1], l2 = p2[p2.length-1];
                  if (l1 === l2 || (l1.substring(0,3) === l2.substring(0,3) && p1[0].substring(0,3) === p2[0].substring(0,3))) {
                    pts = apiPts;
                    break;
                  }
                }
              }
            }
          }
          if (pts !== undefined) {
            pts += 4;
            await storage.updatePlayer(player.id, { points: pts });
            updated++;
          } else if (player.isPlayingXI) {
            await storage.updatePlayer(player.id, { points: 4 });
            updated++;
          }
        }

        const recalcAfterScorecard = (globalThis as any).__recalculateTeamTotals;
        if (recalcAfterScorecard) {
          await recalcAfterScorecard(matchId, `${match.team1Short} vs ${match.team2Short}`);
        }

        return res.json({ message: `Updated ${updated} player scores`, updated });
      } catch (err: any) {
        console.error("Scorecard sync error:", err);
        return res.status(500).json({ message: "Failed to sync scorecard" });
      }
    }
  );

  // ---- LIVE SCORECARD ----
  app.get(
    "/api/matches/:id/live-scorecard",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });

      try {
        if (!match.externalId) {
          return res.json({ scorecard: null, message: "No external match ID" });
        }

        const cacheKey = match.externalId;
        const cached = liveScorecardCache.get(cacheKey);
        const now = Date.now();

        if (cached && now - cached.fetchedAt < LIVE_CACHE_TTL_MS) {
          console.log(`[LiveScorecard] cache HIT for ${cacheKey} (age ${Math.round((now - cached.fetchedAt) / 1000)}s)`);
          return res.json(cached.data);
        }

        console.log(`[LiveScorecard] cache MISS for ${cacheKey} — fetching (Cricbuzz primary)`);
        let scorecard = null;
        let source = "none";

        // --- PRIMARY: Cricbuzz ---
        if (process.env.RAPIDAPI_KEY && match.team1Short && match.team2Short) {
          try {
            const { fetchCricbuzzLiveScorecard } = await import("./cricket-api");
            const cbData = await fetchCricbuzzLiveScorecard(match.team1Short, match.team2Short);
            if (cbData) {
              // Build name → points map from DB players for this match
              const dbPlayers = await storage.getPlayersForMatch(match.id);
              const normalize = (n: string) => n.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
              const pointsByName = new Map<string, number>();
              for (const p of dbPlayers) {
                const key = normalize(p.name);
                if (key) pointsByName.set(key, p.points ?? 0);
              }
              for (const inn of cbData.innings) {
                for (const b of inn.batting) {
                  b.fantasyPoints = pointsByName.get(normalize(b.name)) ?? 0;
                }
                for (const bw of inn.bowling) {
                  bw.fantasyPoints = pointsByName.get(normalize(bw.name)) ?? 0;
                }
              }
              scorecard = cbData;
              source = "Cricbuzz";
              console.log(`[LiveScorecard] Cricbuzz (primary) for ${match.team1Short} vs ${match.team2Short}`);
            }
          } catch (cbErr: any) {
            console.error(`[LiveScorecard] Cricbuzz primary failed:`, cbErr?.message || cbErr);
          }
        }

        // --- SECONDARY: CricAPI (only when Cricbuzz returned nothing) ---
        if (!scorecard) {
          try {
            const { fetchLiveScorecard } = await import("./cricket-api");
            scorecard = await fetchLiveScorecard(cacheKey);
            if (scorecard) {
              source = "CricAPI";
              console.log(`[LiveScorecard] CricAPI (secondary) for ${cacheKey}`);
            }
          } catch (apiErr: any) {
            console.error(`[LiveScorecard] CricAPI secondary failed for ${cacheKey}:`, apiErr?.message || apiErr);
          }
        }

        const payload = scorecard
          ? { scorecard, source }
          : { scorecard: null, message: "No scorecard data available yet" };
        liveScorecardCache.set(cacheKey, { data: payload, fetchedAt: now });
        return res.json(payload);
      } catch (err: any) {
        console.error("Live scorecard route error:", err?.message || err);
        return res.json({ scorecard: null, error: err?.message || "Failed to fetch scorecard" });
      }
    }
  );

  // ---- LIVE SCORE (lightweight - match_info) ----
  app.get(
    "/api/matches/:id/live-score",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });

      try {
        if (!match.externalId) return res.json({ score: null });

        const cacheKey = match.externalId;
        const cached = liveScoreCache.get(cacheKey);
        const now = Date.now();

        if (cached && now - cached.fetchedAt < LIVE_CACHE_TTL_MS) {
          console.log(`[LiveScore] cache HIT for ${cacheKey} (age ${Math.round((now - cached.fetchedAt) / 1000)}s)`);
          return res.json(cached.data);
        }

        console.log(`[LiveScore] cache MISS for ${cacheKey} — fetching from CricAPI`);
        let scoreData = null;
        const info = await fetchMatchInfo(cacheKey);
        if (info) {
          scoreData = {
            score: info.score || [],
            status: info.status,
            matchStarted: info.matchStarted,
            matchEnded: info.matchEnded,
            source: "CricAPI",
          };
        }

        const payload = scoreData ?? { score: null };
        liveScoreCache.set(cacheKey, { data: payload, fetchedAt: now });
        return res.json(payload);
      } catch (err: any) {
        console.error("Live score error:", err);
        return res.status(500).json({ message: "Failed to fetch live score" });
      }
    }
  );

  // ---- LOCKOUT PROTOCOL: TEAMS ----
  app.get(
    "/api/matches/:id/teams",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const now = new Date();
      const matchStart = new Date(match.startTime);
      const isLive = now.getTime() >= matchStart.getTime();

      const allTeams = await storage.getAllTeamsForMatch(req.params.id);
      const matchPlayers = await storage.getPlayersForMatch(req.params.id);
      const isCompleted = match.status === "completed";

      const allUsers: Record<string, { username: string; teamName: string }> = {};
      for (const t of allTeams) {
        if (!allUsers[t.userId]) {
          const u = await storage.getUser(t.userId);
          allUsers[t.userId] = {
            username: u?.username || "Unknown",
            teamName: u?.teamName || "",
          };
        }
      }

      const userTeamsByUser = new Map<string, typeof allTeams>();
      for (const t of allTeams) {
        const arr = userTeamsByUser.get(t.userId) || [];
        arr.push(t);
        userTeamsByUser.set(t.userId, arr);
      }

      if (isLive || isCompleted) {
        const teamsWithInfo = allTeams.map((t) => {
          const isOwn = t.userId === req.session.userId;
          const isInvisible = t.invisibleMode === true;
          const shouldHide = isInvisible && !isOwn && !isCompleted;

          if (shouldHide) {
            return {
              id: t.id,
              userId: t.userId,
              matchId: t.matchId,
              name: "Hidden Team",
              username: allUsers[t.userId]?.username || "Unknown",
              userTeamName: allUsers[t.userId]?.teamName || "",
              invisibleMode: true,
              invisibleHidden: true,
              playerIds: [],
              captainId: null,
              viceCaptainId: null,
              primaryImpactId: null,
              backupImpactId: null,
              captainType: null,
              vcType: null,
              totalPoints: null,
              createdAt: t.createdAt,
            };
          }

          return {
            ...t,
            username: allUsers[t.userId]?.username || "Unknown",
            userTeamName: allUsers[t.userId]?.teamName || "",
            invisibleHidden: false,
          };
        });
        return res.json({ teams: teamsWithInfo, visibility: isCompleted ? "full" : "live", players: matchPlayers, impactFeaturesEnabled: match.impactFeaturesEnabled });
      } else {
        const hiddenTeams = allTeams.map((t) => ({
          id: t.id,
          userId: t.userId,
          matchId: t.matchId,
          name: t.name,
          username: allUsers[t.userId]?.username || "Unknown",
          userTeamName: allUsers[t.userId]?.teamName || "",
          playerIds: t.userId === req.session.userId ? t.playerIds : [],
          captainId: t.userId === req.session.userId ? t.captainId : null,
          viceCaptainId: t.userId === req.session.userId ? t.viceCaptainId : null,
          primaryImpactId: t.userId === req.session.userId ? t.primaryImpactId : null,
          backupImpactId: t.userId === req.session.userId ? t.backupImpactId : null,
          captainType: t.userId === req.session.userId ? t.captainType : null,
          vcType: t.userId === req.session.userId ? t.vcType : null,
          invisibleMode: t.userId === req.session.userId ? t.invisibleMode : undefined,
          totalPoints: t.totalPoints,
          createdAt: t.createdAt,
        }));
        return res.json({ teams: hiddenTeams, visibility: "hidden", impactFeaturesEnabled: match.impactFeaturesEnabled });
      }
    }
  );

  app.get(
    "/api/matches/:id/standings",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const matchId = req.params.id as string;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const now = new Date();
      const matchStart = new Date(match.startTime);
      const isLive = now.getTime() >= matchStart.getTime();

      if (!isLive) {
        return res.json({ standings: [], isLive: false, message: "Match has not started yet" });
      }

      const isCompleted = match.status === "completed";

      try {
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        const allUsers: Record<string, { username: string; teamName: string }> = {};
        for (const t of allTeams) {
          if (!allUsers[t.userId]) {
            const u = await storage.getUser(t.userId);
            allUsers[t.userId] = {
              username: u?.username || "Unknown",
              teamName: u?.teamName || "",
            };
          }
        }

        const matchPlayersRaw = await storage.getPlayersForMatch(matchId);
        const allStatuses = await storage.getMatchPlayerStatuses(matchId);
        const activatedPlayerIds = new Set(
          allStatuses.filter(s => s.officialImpactSubUsed === true).map(s => s.playerId)
        );
        const matchPlayersForResponse = matchPlayersRaw.map(p => ({
          ...p,
          isImpactActivated: activatedPlayerIds.has(p.id),
        }));
        const playerById = new Map(matchPlayersForResponse.map(p => [p.id, p]));

        const standings = allTeams
          .map((t) => {
            const isOwn = t.userId === req.session.userId;
            const shouldHide = t.invisibleMode === true && !isOwn && !isCompleted;

            // Invisible mode — strip all composition from opponents during live match
            if (shouldHide) {
              return {
                teamId: t.id,
                teamName: "Hidden Team",
                userId: t.userId,
                username: allUsers[t.userId]?.username || "Unknown",
                userTeamName: allUsers[t.userId]?.teamName || "",
                totalPoints: t.totalPoints || 0,
                playerIds: [],
                captainId: null,
                viceCaptainId: null,
                primaryImpactId: null,
                backupImpactId: null,
                captainType: null,
                vcType: null,
                resolvedPlayers: [],
                invisibleHidden: true,
                rank: 0,
              };
            }

            let resolvedPlayers = (t.playerIds as string[]).map(pid => {
              const p = playerById.get(pid);
              if (p) return { id: p.id, name: p.name, role: p.role, points: p.points || 0, teamShort: p.teamShort, externalId: p.externalId, isPlayingXI: p.isPlayingXI ?? false, isImpactPlayer: p.isImpactPlayer ?? false, isImpactActivated: (p as any).isImpactActivated ?? false };
              return null;
            }).filter(Boolean) as { id: string; name: string; role: string; points: number; teamShort: string; externalId: string | null; isPlayingXI: boolean; isImpactPlayer: boolean; isImpactActivated: boolean }[];

            if (resolvedPlayers.length === 0 && matchPlayersForResponse.length > 0) {
              const targetPts = t.totalPoints || 0;
              const numPlayers = (t.playerIds as string[]).length || 11;
              const sorted = [...matchPlayersForResponse].sort((a, b) => (b.points || 0) - (a.points || 0));
              const topPlayers = sorted.slice(0, numPlayers);
              resolvedPlayers = topPlayers.map(p => ({
                id: p.id, name: p.name, role: p.role, points: p.points || 0, teamShort: p.teamShort, externalId: p.externalId,
              }));
            }

            // Apply XI backup substitution — mirrors resolveEffectiveXI in server/index.ts.
            // Only active when XI is announced. Replaces absent players (isPlayingXI=false) with
            // backups that ARE in the official XI. C/VC roles transfer with the replaced slot.
            // NOTE: C/VC inheritance is position-based — the first absent player encountered in
            // the playerIds order gets Backup 1; the role (C or VC) follows the replaced slot,
            // not the backup slot number. If the captain's position comes before the VC's
            // position in the array, Backup 1 inherits the C role; otherwise it inherits VC.
            const xiAnnouncedInMatch = matchPlayersForResponse.some(p => p.isPlayingXI);
            let effectiveCaptainId: string | null = t.captainId ?? null;
            let effectiveVcId: string | null = t.viceCaptainId ?? null;
            if (xiAnnouncedInMatch && ((t as any).backupXiPlayer1Id || (t as any).backupXiPlayer2Id)) {
              const backup1P = (t as any).backupXiPlayer1Id ? playerById.get((t as any).backupXiPlayer1Id as string) : null;
              const backup2P = (t as any).backupXiPlayer2Id ? playerById.get((t as any).backupXiPlayer2Id as string) : null;
              const availableBackupsForDisplay = [backup1P, backup2P].filter(
                (p): p is NonNullable<typeof p> => !!p && p.isPlayingXI === true
              );
              if (availableBackupsForDisplay.length > 0) {
                let bCursor = 0;
                for (let i = 0; i < resolvedPlayers.length; i++) {
                  if (bCursor >= availableBackupsForDisplay.length) break;
                  const rp = resolvedPlayers[i];
                  const fullP = playerById.get(rp.id);
                  if (fullP && fullP.isPlayingXI !== true && fullP.isImpactPlayer !== true) {
                    // Skip any backup already present in resolvedPlayers to prevent duplicate IDs
                    let bk: (typeof availableBackupsForDisplay)[0] | null = null;
                    while (bCursor < availableBackupsForDisplay.length) {
                      const candidate = availableBackupsForDisplay[bCursor++];
                      if (!resolvedPlayers.some(p => p.id === candidate.id)) {
                        bk = candidate;
                        break;
                      }
                    }
                    if (!bk) break; // no eligible backup remaining
                    if (rp.id === effectiveCaptainId) effectiveCaptainId = bk.id;
                    if (rp.id === effectiveVcId) effectiveVcId = bk.id;
                    resolvedPlayers[i] = {
                      id: bk.id,
                      name: bk.name,
                      role: bk.role,
                      points: bk.points || 0,
                      teamShort: bk.teamShort,
                      externalId: bk.externalId,
                      isPlayingXI: true,
                      isImpactPlayer: bk.isImpactPlayer ?? false,
                    };
                  }
                }
              }
            }

            return {
              teamId: t.id,
              teamName: t.name,
              userId: t.userId,
              username: allUsers[t.userId]?.username || "Unknown",
              userTeamName: allUsers[t.userId]?.teamName || "",
              totalPoints: t.totalPoints || 0,
              playerIds: t.playerIds,
              captainId: effectiveCaptainId,
              viceCaptainId: effectiveVcId,
              primaryImpactId: t.primaryImpactId || null,
              backupImpactId: t.backupImpactId || null,
              captainType: t.captainType || null,
              vcType: t.vcType || null,
              resolvedPlayers,
            };
          })
          .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

        let rank = 1;
        const rankedStandings = standings.map((s, i) => {
          if (i > 0 && s.totalPoints < standings[i - 1].totalPoints) {
            rank = i + 1;
          }
          return {
            ...s,
            rank,
            totalPoints: (s as any).invisibleHidden ? null : s.totalPoints,
          };
        });

        return res.json({ standings: rankedStandings, isLive: true, players: matchPlayersForResponse });
      } catch (err: any) {
        console.error("Standings error:", err);
        return res.status(500).json({ message: "Failed to load standings" });
      }
    }
  );

  // ── AI Team Picker ────────────────────────────────────────────────────────────


// ── AI Team Endpoint ──────────────────────────────────────────────────────────

  app.get(
    "/api/matches/:id/ai-team",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const userId = req.session.userId!;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const matchPlayers = await storage.getPlayersForMatch(matchId);

        // ── Stage 1: Gate check ───────────────────────────────────────────────
        const team1XI = matchPlayers.filter(
          p => p.teamShort === match.team1Short && p.isPlayingXI === true
        );
        const team2XI = matchPlayers.filter(
          p => p.teamShort === match.team2Short && p.isPlayingXI === true
        );
        const xiPool = [...team1XI, ...team2XI];

        const gatePass =
          team1XI.length >= 11 &&
          team2XI.length >= 11 &&
          xiPool.some(p => p.role === "WK") &&
          xiPool.some(p => p.role === "BAT") &&
          xiPool.some(p => p.role === "AR") &&
          xiPool.some(p => p.role === "BOWL");

        if (!gatePass) {
          return res.json({
            fallback: true,
            reason: "Playing XI not fully announced — using Smart Pick instead.",
          });
        }

        // ── Mode: alternating safe/differential ──────────────────────────────
        const mode = getAiMode(userId);

        // ── Stage 2: Parallel data fetch ─────────────────────────────────────
        const xiPlayerNames = xiPool.map(p => p.name);

        const [historicalCache, formRows, h2hMatches] = await Promise.all([
          getHistoricalStatsCache(),

          match.tournamentName ? db.execute(sql`
            SELECT p.name, p.team_short, p.points, m.start_time
            FROM players p
            INNER JOIN matches m ON p.match_id = m.id
            WHERE p.name = ANY(ARRAY[${sql.join(xiPlayerNames.map(n => sql`${n}`), sql`, `)}])
              AND m.tournament_name = ${match.tournamentName}
              AND m.status = 'completed'
              AND m.id != ${matchId}
            ORDER BY p.name, m.start_time DESC
          `) : Promise.resolve({ rows: [] }),

          db.select({ id: matchesTable.id, startTime: matchesTable.startTime })
            .from(matchesTable)
            .where(and(
              eq(matchesTable.status, "completed"),
              sql`(
                (${matchesTable.team1Short} = ${match.team1Short} AND ${matchesTable.team2Short} = ${match.team2Short})
                OR
                (${matchesTable.team1Short} = ${match.team2Short} AND ${matchesTable.team2Short} = ${match.team1Short})
              )`,
              sql`${matchesTable.id} != ${matchId}`
            ))
            .orderBy(sql`${matchesTable.startTime} DESC`),
        ]);

        // ── Stage 2b: Form map ────────────────────────────────────────────────
        const formMap = new Map<string, number>();
        const formByPlayer = new Map<string, number[]>();
        for (const row of formRows.rows as any[]) {
          const key = `${row.name}|${row.team_short}`;
          if (!formByPlayer.has(key)) formByPlayer.set(key, []);
          if (formByPlayer.get(key)!.length < 5) formByPlayer.get(key)!.push(row.points ?? 0);
        }
        const formWeights = [0.30, 0.25, 0.20, 0.15, 0.10];
        for (const [key, pts] of formByPlayer.entries()) {
          let ws = 0, wt = 0;
          for (let i = 0; i < pts.length; i++) { ws += pts[i] * (formWeights[i] ?? 0.10); wt += (formWeights[i] ?? 0.10); }
          formMap.set(key, wt > 0 ? ws / wt : 0);
        }

        // ── Stage 2c: H2H map (last 4 weighted 2x) ───────────────────────────
        const h2hMap = new Map<string, number>();
        if (h2hMatches.length > 0) {
          const recentH2HIds = new Set(h2hMatches.slice(0, 4).map(m => m.id));
          const h2hMatchIds = h2hMatches.map(m => m.id);
          const h2hRows = await db
            .select({ name: playersTable.name, teamShort: playersTable.teamShort, points: playersTable.points, matchId: playersTable.matchId })
            .from(playersTable)
            .where(sql`${playersTable.matchId} = ANY(ARRAY[${sql.join(h2hMatchIds.map(id => sql`${id}`), sql`, `)}]::text[])`);
          const h2hByPlayer = new Map<string, { sum: number; count: number }>();
          for (const row of h2hRows) {
            const key = `${row.name}|${row.teamShort}`;
            const w = recentH2HIds.has(row.matchId) ? 2 : 1;
            if (!h2hByPlayer.has(key)) h2hByPlayer.set(key, { sum: 0, count: 0 });
            h2hByPlayer.get(key)!.sum += (row.points ?? 0) * w;
            h2hByPlayer.get(key)!.count += w;
          }
          for (const [key, { sum, count }] of h2hByPlayer.entries()) h2hMap.set(key, count > 0 ? sum / count : 0);
        }

        // ── Stage 3 & 4: Score every player ──────────────────────────────────
        type PlayerWithScore = typeof xiPool[0] & {
          aiScore: number;
          confidence: MatchConfidence;
          careerAvg: number;
          ceilingScore: number;
        };

        // Load DB name mappings for this match
        const dbMappings = await getDbMappingsCache();

        const roleAvgMap: Record<string, { sum: number; count: number }> = {
          WK: { sum: 0, count: 0 }, BAT: { sum: 0, count: 0 },
          AR: { sum: 0, count: 0 }, BOWL: { sum: 0, count: 0 },
        };
        for (const p of xiPool) {
          const { stats, confidence } = matchPlayerToHistorical(p.name, historicalCache, dbMappings, p.teamShort);
          if (stats && confidence !== "none" && roleAvgMap[p.role]) {
            roleAvgMap[p.role].sum += stats.avg_cdo_points;
            roleAvgMap[p.role].count++;
          }
        }
        const roleDefaults: Record<string, number> = {};
        for (const role of ["WK", "BAT", "AR", "BOWL"]) {
          roleDefaults[role] = roleAvgMap[role].count > 0 ? roleAvgMap[role].sum / roleAvgMap[role].count : 20;
        }

        const scored: PlayerWithScore[] = xiPool.map(p => {
          const key = `${p.name}|${p.teamShort}`;
          const { stats, confidence } = matchPlayerToHistorical(p.name, historicalCache, dbMappings, p.teamShort);
          const careerAvg = stats ? stats.avg_cdo_points : roleDefaults[p.role];
          const careerWeight = confidence === "high" ? 0.30 : confidence === "medium" ? 0.20 : confidence === "low" ? 0.15 : 0;
          const formWeight = 1 - careerWeight - 0.15;

          let phaseBonus = 0;
          if (stats) {
            const pos = stats.typical_batting_position || 0;
            if (p.role === "BAT" || p.role === "AR" || p.role === "WK") {
              let b = 0;
              if (pos >= 1 && pos <= 2) { const r = stats.avg_powerplay_runs; b = r >= 25 ? 15 : r >= 15 ? 10 : r >= 8 ? 5 : 0; }
              else if (pos >= 3 && pos <= 5) { const r = stats.avg_middle_runs; b = r >= 25 ? 15 : r >= 15 ? 10 : r >= 8 ? 5 : 0; }
              else if (pos >= 6 && pos <= 8) { const r = stats.avg_death_runs; b = r >= 25 ? 15 : r >= 15 ? 10 : r >= 8 ? 5 : 0; }
              phaseBonus += b;
            }
            if (p.role === "BOWL" || p.role === "AR") {
              const ppW = stats.avg_powerplay_wickets;
              const dW = stats.avg_death_wickets;
              phaseBonus += ppW >= 0.8 ? 15 : ppW >= 0.5 ? 10 : ppW >= 0.3 ? 5 : 0;
              phaseBonus += dW >= 0.8 ? 15 : dW >= 0.5 ? 10 : dW >= 0.3 ? 5 : 0;
            }
            phaseBonus = Math.min(phaseBonus, 20);
          }

          const ceilingScore = stats && stats.matches_played >= 3 ? stats.avg_cdo_points * 1.8 : careerAvg * 1.5;
          const aiScore =
            (careerWeight * careerAvg) +
            (formWeight * (formMap.get(key) ?? 0)) +
            (0.15 * (h2hMap.get(key) ?? 0)) +
            phaseBonus;

          return { ...p, aiScore, confidence, careerAvg, ceilingScore };
        });

        scored.sort((a, b) => b.aiScore - a.aiScore);

        // ── Stage 5: Greedy selection + backtracking ──────────────────────────
        const ROLE_LIMITS: Record<string, { min: number; max: number }> = {
          WK: { min: 1, max: 4 }, BAT: { min: 1, max: 6 },
          AR: { min: 1, max: 6 }, BOWL: { min: 1, max: 6 },
        };
        const MAX_FROM_ONE_TEAM = 6;
        const CREDIT_CAP = 100;

        function tryBuildTeam(pool: PlayerWithScore[]): PlayerWithScore[] | null {
          const picked: PlayerWithScore[] = [];
          const roleCounts: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
          const teamCounts: Record<string, number> = {};
          let credits = 0;
          for (const role of ["WK", "BAT", "AR", "BOWL"]) {
            const best = pool.find(p =>
              p.role === role && !picked.find(x => x.id === p.id) &&
              (teamCounts[p.teamShort] || 0) < MAX_FROM_ONE_TEAM &&
              credits + p.credits <= CREDIT_CAP
            );
            if (best) { picked.push(best); roleCounts[best.role]++; teamCounts[best.teamShort] = (teamCounts[best.teamShort] || 0) + 1; credits += best.credits; }
          }
          for (const p of pool) {
            if (picked.length >= 11) break;
            if (picked.find(x => x.id === p.id)) continue;
            if (roleCounts[p.role] >= ROLE_LIMITS[p.role].max) continue;
            if ((teamCounts[p.teamShort] || 0) >= MAX_FROM_ONE_TEAM) continue;
            if (credits + p.credits > CREDIT_CAP) continue;
            picked.push(p); roleCounts[p.role]++; teamCounts[p.teamShort] = (teamCounts[p.teamShort] || 0) + 1; credits += p.credits;
          }
          return picked.length === 11 ? picked : null;
        }

        let safeTeam = tryBuildTeam(scored);
        if (!safeTeam) {
          for (let retry = 0; retry < 3; retry++) {
            const rc: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
            for (const p of scored) rc[p.role]++;
            const drop = [...scored].sort((a, b) => a.aiScore - b.aiScore).find(p => rc[p.role] > 1);
            if (!drop) break;
            safeTeam = tryBuildTeam(scored.filter(p => p.id !== drop.id));
            if (safeTeam) break;
          }
        }

        if (!safeTeam) return res.status(422).json({ message: "Could not build a valid AI team." });

        // ── Captain assignment ────────────────────────────────────────────────
        function assignCaptains(team: PlayerWithScore[], ownerData: OwnershipData | null, differential: boolean): { captainId: string; vcId: string } {
          const cvSorted = [...team].sort((a, b) => {
            if (Math.abs(b.aiScore - a.aiScore) < 5) {
              if (b.role === "AR" && a.role !== "AR") return 1;
              if (a.role === "AR" && b.role !== "AR") return -1;
            }
            return b.aiScore - a.aiScore;
          });
          if (!differential || !ownerData) return { captainId: cvSorted[0].id, vcId: cvSorted[1].id };

          const topScore = cvSorted[0].aiScore;
          const leverageCandidate = team.find(p => {
            const own = ownerData.playerOwnership[p.id] ?? 0;
            const hist = historicalCache.get(p.name);
            const roleCertainty = (hist?.batting_position_certainty ?? 0) >= 0.6 || (hist?.bowling_quota_certainty ?? 0) >= 0.6;
            return own < 0.25 && p.aiScore >= topScore * 0.85 && roleCertainty && p.id !== cvSorted[0].id;
          });
          return leverageCandidate
            ? { captainId: leverageCandidate.id, vcId: cvSorted[0].id }
            : { captainId: cvSorted[0].id, vcId: cvSorted[1].id };
        }

        function calcTeamProjection(team: PlayerWithScore[], captainId: string, vcId: string): number {
          return team.reduce((sum, p) => sum + p.aiScore * (p.id === captainId ? 2 : p.id === vcId ? 1.5 : 1), 0);
        }

        const safeOwnership = mode === "differential"
          ? getOwnershipForMatch(matchId, match.startTime, xiPool)
          : null;

        const { captainId: safeCaptainId, vcId: safeVcId } = assignCaptains(safeTeam, null, false);
        const safeProjection = calcTeamProjection(safeTeam, safeCaptainId, safeVcId);

        // ── Stage 6: Differential mode ────────────────────────────────────────
        let finalTeam = safeTeam;
        let finalCaptainId = safeCaptainId;
        let finalVcId = safeVcId;
        let modeDowngraded = false;
        let downgradeReason = "";
        let chalkDropped: string | null = null;
        let replacementChosen: string | null = null;
        let swapsApplied = 0;

        if (mode === "differential" && safeOwnership) {
          const ownerData = safeOwnership;
          const chalkThresholds = [0.75, 0.60, 0.40];
          let chalkCandidates: PlayerWithScore[] = [];
          for (const threshold of chalkThresholds) {
            chalkCandidates = safeTeam.filter(p => (ownerData.playerOwnership[p.id] ?? getProxyOwnership(p)) >= threshold);
            if (chalkCandidates.length > 0) break;
          }
          if (chalkCandidates.length === 0) { modeDowngraded = true; downgradeReason = "no chalk candidates"; }

          if (!modeDowngraded) {
            let differentialTeam: PlayerWithScore[] | null = null;
            for (const chalkPlayer of chalkCandidates) {
              const rc3: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
              for (const p of safeTeam) rc3[p.role]++;
              if (rc3[chalkPlayer.role] <= 1) continue;

              const ownerThresholds = [0.20, 0.30, 0.40, 1.0];
              let replacement: PlayerWithScore | null = null;
              for (const ownerThreshold of ownerThresholds) {
                const teamWithout = safeTeam.filter(p => p.id !== chalkPlayer.id);
                const creditsWithout = teamWithout.reduce((s, p) => s + p.credits, 0);
                const twc: Record<string, number> = {};
                const rwc: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
                for (const p of teamWithout) { twc[p.teamShort] = (twc[p.teamShort] || 0) + 1; rwc[p.role]++; }
                replacement = scored.find(p => {
                  const own = ownerData.playerOwnership[p.id] ?? getProxyOwnership(p);
                  const chalkOwn = ownerData.playerOwnership[chalkPlayer.id] ?? getProxyOwnership(chalkPlayer);
                  return !safeTeam.find(x => x.id === p.id) &&
                    p.role === chalkPlayer.role &&
                    own < ownerThreshold &&
                    own < chalkOwn &&
                    (twc[p.teamShort] || 0) < MAX_FROM_ONE_TEAM &&
                    creditsWithout + p.credits <= CREDIT_CAP &&
                    rwc[p.role] < ROLE_LIMITS[p.role].max;
                }) || null;
                if (replacement) break;
              }
              if (!replacement) continue;

              const candidateTeam = safeTeam.map(p => p.id === chalkPlayer.id ? replacement! : p);
              const { captainId: diffCaptainId, vcId: diffVcId } = assignCaptains(candidateTeam, ownerData, true);
              const diffProjection = calcTeamProjection(candidateTeam, diffCaptainId, diffVcId);
              const guardrailRatio = swapsApplied === 0 ? 0.93 : swapsApplied === 1 ? 0.90 : 0.87;

              if (diffProjection < safeProjection * guardrailRatio) {
                downgradeReason = `projection ${(diffProjection / safeProjection * 100).toFixed(1)}% below guardrail`;
                continue;
              }

              differentialTeam = candidateTeam;
              finalCaptainId = diffCaptainId;
              finalVcId = diffVcId;
              chalkDropped = chalkPlayer.name;
              replacementChosen = replacement.name;
              swapsApplied++;
              break;
            }

            if (!differentialTeam) {
              modeDowngraded = true;
              downgradeReason = downgradeReason || "no valid differential swap found";
            } else {
              finalTeam = differentialTeam;
            }
          }

          if (modeDowngraded) { finalCaptainId = safeCaptainId; finalVcId = safeVcId; }
        } else {
          finalCaptainId = safeCaptainId;
          finalVcId = safeVcId;
        }

        // ── Stage 6b: Per-click variation (safe mode only) ────────────────────
        // Guarantees meaningful variation on every tap for every user.
        // Top 4 by AI score are always locked. Bottom scorers are swap candidates.
        // Both the candidate pool and alternative pool are shuffled per request
        // so identical seeds still produce different teams.
        if (mode === "safe" || modeDowngraded) {
          const pickedIds = new Set(finalTeam.map(p => p.id));

          // Lock top 4 by AI score
          const sortedFinal = [...finalTeam].sort((a, b) => b.aiScore - a.aiScore);
          const lockedFinalIds = new Set(sortedFinal.slice(0, 4).map(p => p.id));

          // Swap candidates: low career data OR bottom scorers — excludes locked top 4
          const lowDataCandidates = finalTeam.filter(
            p => !lockedFinalIds.has(p.id) &&
            (p.careerAvg < 20 || (historicalCache.get(p.name)?.matches_played ?? 0) < 10)
          );
          const bottomCandidates = sortedFinal
            .slice(4)
            .filter(p => !lowDataCandidates.find(lc => lc.id === p.id))
            .reverse()
            .slice(0, 4);

          const swapCandidates = [...lowDataCandidates, ...bottomCandidates];

          // Shuffle candidates so each tap tries different ones first
          for (let i = swapCandidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [swapCandidates[i], swapCandidates[j]] = [swapCandidates[j], swapCandidates[i]];
          }

          let safeSwaps = 0;
          for (const outPlayer of swapCandidates) {
            if (safeSwaps >= 3) break;

            const creditsWithout = finalTeam.reduce((s, p) => s + (p.id === outPlayer.id ? 0 : p.credits), 0);
            const twc: Record<string, number> = {};
            const rwc: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
            for (const p of finalTeam) {
              if (p.id === outPlayer.id) continue;
              twc[p.teamShort] = (twc[p.teamShort] || 0) + 1;
              rwc[p.role]++;
            }

            // Shuffle alternatives so each tap picks different replacements
            const shuffledAlts = [...scored].sort(() => Math.random() - 0.5);
            const alt = shuffledAlts.find(p =>
              !pickedIds.has(p.id) &&
              !lockedFinalIds.has(p.id) &&
              p.role === outPlayer.role &&
              (twc[p.teamShort] || 0) < MAX_FROM_ONE_TEAM &&
              creditsWithout + p.credits <= CREDIT_CAP &&
              rwc[p.role] < ROLE_LIMITS[p.role].max
            );

            if (alt) {
              const idx = finalTeam.findIndex(p => p.id === outPlayer.id);
              finalTeam = [...finalTeam];
              finalTeam[idx] = alt;
              pickedIds.delete(outPlayer.id);
              pickedIds.add(alt.id);
              safeSwaps++;
            }
          }
        }

        // ── Logging + response ────────────────────────────────────────────────
        const finalProjection = calcTeamProjection(finalTeam, finalCaptainId, finalVcId);
        const highCount = scored.filter(p => matchPlayerToHistorical(p.name, historicalCache, dbMappings, p.teamShort).confidence === "high").length;
        console.log(`[AI] matchId=${matchId} mode=${mode} downgraded=${modeDowngraded} reason="${downgradeReason}" chalk="${chalkDropped}" replacement="${replacementChosen}" swaps=${swapsApplied} safeProjection=${safeProjection.toFixed(1)} finalProjection=${finalProjection.toFixed(1)} guardrailRatio=${(finalProjection / safeProjection).toFixed(2)} ownership=${safeOwnership?.source ?? "n/a"} teamCount=${safeOwnership?.teamCount ?? 0} highConf=${highCount}`);

        return res.json({
          fallback: false,
          playerIds: finalTeam.map(p => p.id),
          captainId: finalCaptainId,
          viceCaptainId: finalVcId,
          reason: `AI Pick: ${highCount} players matched${formMap.size > 0 ? " + 2026 form" : ""}${h2hMap.size > 0 ? " + H2H data" : ""}`,
        });

      } catch (err: any) {
        console.error("AI team error:", err);
        return res.status(500).json({ message: "AI team pick failed" });
      }
    }
  )

  app.get(
    "/api/matches/:id/smart-pick",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const matchPlayers = await storage.getPlayersForMatch(matchId);
        if (matchPlayers.length < 22) {
          return res.status(400).json({ message: "Not enough players" });
        }

        // ── Pass 1: Tournament form ───────────────────────────────────────────
        const tournamentTotals = new Map<string, number>();
        if (match.tournamentName) {
          const rows = await db
            .select({
              name: playersTable.name,
              teamShort: playersTable.teamShort,
              total: sql<number>`CAST(SUM(${playersTable.points}) AS INTEGER)`,
            })
            .from(playersTable)
            .innerJoin(matchesTable, eq(playersTable.matchId, matchesTable.id))
            .where(
              and(
                eq(matchesTable.tournamentName, match.tournamentName),
                eq(matchesTable.status, "completed"),
                sql`${playersTable.points} > 0`
              )
            )
            .groupBy(playersTable.name, playersTable.teamShort);
          for (const row of rows) {
            tournamentTotals.set(`${row.name}|${row.teamShort}`, row.total);
          }
        }

        // ── Pass 2: Head-to-head vs this opponent ─────────────────────────────
        const h2hAverages = new Map<string, number>();
        const h2hMatches = await db
          .select({ id: matchesTable.id })
          .from(matchesTable)
          .where(
            and(
              eq(matchesTable.status, "completed"),
              sql`(
                (${matchesTable.team1Short} = ${match.team1Short} AND ${matchesTable.team2Short} = ${match.team2Short})
                OR
                (${matchesTable.team1Short} = ${match.team2Short} AND ${matchesTable.team2Short} = ${match.team1Short})
              )`,
              sql`${matchesTable.id} != ${matchId}`
            )
          );

        if (h2hMatches.length > 0) {
          const h2hMatchIds = h2hMatches.map(m => m.id);
          const h2hRows = await db
            .select({
              name: playersTable.name,
              teamShort: playersTable.teamShort,
              avg: sql<number>`CAST(AVG(${playersTable.points}) AS FLOAT)`,
            })
            .from(playersTable)
            .where(
              and(
                sql`${playersTable.matchId} = ANY(ARRAY[${sql.join(h2hMatchIds.map(id => sql`${id}`), sql`, `)}]::text[])`,
                sql`${playersTable.points} > 0`
              )
            )
            .groupBy(playersTable.name, playersTable.teamShort);
          for (const row of h2hRows) {
            h2hAverages.set(`${row.name}|${row.teamShort}`, row.avg);
          }
        }

        // ── Pass 2b: Last Match XI bonus ─────────────────────────────────────
        // Players who featured in the last match XI for their team get a bonus.
        // This ensures last-XI players are preferred over unknown REST OF SQUAD
        // players when smart scores are otherwise similar.
        const lastXIBonus = new Map<string, number>(); // "name|teamShort" → bonus
        for (const teamShort of [match.team1Short, match.team2Short]) {
          const [prevMatch] = await db
            .select({ id: matchesTable.id })
            .from(matchesTable)
            .where(
              and(
                sql`(${matchesTable.team1Short} = ${teamShort} OR ${matchesTable.team2Short} = ${teamShort})`,
                eq(matchesTable.status, "completed"),
                sql`${matchesTable.id} != ${matchId}`
              )
            )
            .orderBy(sql`${matchesTable.startTime} DESC`)
            .limit(1);
          if (prevMatch) {
            const prevPlayers = await storage.getPlayersForMatch(prevMatch.id);
            for (const p of prevPlayers) {
              if (p.isPlayingXI && p.teamShort === teamShort) {
                lastXIBonus.set(`${p.name}|${p.teamShort}`, 20);
              }
            }
          }
        }

        // ── Pass 3: Score each player and sort ───────────────────────────────
        const scored = matchPlayers.map(p => {
          const key = `${p.name}|${p.teamShort}`;
          const tournPts = tournamentTotals.get(key) ?? 0;
          const h2hPts = h2hAverages.get(key) ?? 0;
          const xiBonus = lastXIBonus.get(key) ?? 0;
          const smartScore = (0.6 * tournPts) + (0.4 * h2hPts) + xiBonus;
          return { ...p, smartScore };
        }).sort((a, b) => b.smartScore - a.smartScore);

        // ── Pass 4: Greedy selection with constraints ─────────────────────────
        const ROLE_LIMITS: Record<string, { min: number; max: number }> = {
          WK: { min: 1, max: 4 }, BAT: { min: 1, max: 6 },
          AR: { min: 1, max: 6 }, BOWL: { min: 1, max: 6 },
        };
        const MAX_FROM_ONE_TEAM = 6;
        const CREDIT_CAP = 100;

        const picked: typeof scored = [];
        const roleCounts: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
        const teamCounts: Record<string, number> = {};
        let credits = 0;

        // First pass: pick best player per role to satisfy minimums
        for (const role of ['WK', 'BAT', 'AR', 'BOWL']) {
          const best = scored.find(p =>
            p.role === role &&
            !picked.find(x => x.id === p.id) &&
            (teamCounts[p.teamShort] || 0) < MAX_FROM_ONE_TEAM &&
            credits + p.credits <= CREDIT_CAP
          );
          if (best) {
            picked.push(best);
            roleCounts[best.role]++;
            teamCounts[best.teamShort] = (teamCounts[best.teamShort] || 0) + 1;
            credits += best.credits;
          }
        }

        // Second pass: fill remaining slots by smart score
        for (const p of scored) {
          if (picked.length >= 11) break;
          if (picked.find(x => x.id === p.id)) continue;
          if (roleCounts[p.role] >= ROLE_LIMITS[p.role].max) continue;
          if ((teamCounts[p.teamShort] || 0) >= MAX_FROM_ONE_TEAM) continue;
          if (credits + p.credits > CREDIT_CAP) continue;
          picked.push(p);
          roleCounts[p.role]++;
          teamCounts[p.teamShort] = (teamCounts[p.teamShort] || 0) + 1;
          credits += p.credits;
        }

        if (picked.length !== 11) {
          return res.status(422).json({ message: "Could not build a valid smart team — falling back to random" });
        }

        // ── Pass 5: Controlled variation ─────────────────────────────────────
        // Guarantees at least 3 unique swaps per request so every tap and every
        // user gets a meaningfully different team.
        //
        // Variation pool priority:
        //   1. Non-core picks (not in last match XI) — lowest risk to swap
        //   2. If pool < 3, pad with the bottom scorers from picked XI
        //      This handles the pre-toss case where everyone has lastXIBonus
        //
        // Top 4 players by smartScore are always locked — never swapped.
        // This preserves the best picks while rotating the fringe slots.

        const pickedIds = new Set(picked.map(p => p.id));

        // Sort picked by smartScore descending — top 4 are locked
        const sortedPicked = [...picked].sort((a, b) => b.smartScore - a.smartScore);
        const lockedIds = new Set(sortedPicked.slice(0, 4).map(p => p.id));

        // Build variation pool: non-core first, then pad with bottom scorers
        const nonCorePicks = picked.filter(p =>
          !lockedIds.has(p.id) &&
          !lastXIBonus.has(`${p.name}|${p.teamShort}`)
        );
        const bottomPicks = sortedPicked
          .slice(4) // exclude top 4
          .filter(p => !nonCorePicks.find(nc => nc.id === p.id))
          .reverse(); // lowest scorers first

        // Combine: non-core first, then bottom scorers as padding
        const variationPool = [...nonCorePicks, ...bottomPicks].slice(0, 6);

        // Shuffle the variation pool so each request tries different candidates first
        for (let i = variationPool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [variationPool[i], variationPool[j]] = [variationPool[j], variationPool[i]];
        }

        const ROLE_LIMITS_V: Record<string, { min: number; max: number }> = {
          WK: { min: 1, max: 4 }, BAT: { min: 1, max: 6 },
          AR: { min: 1, max: 6 }, BOWL: { min: 1, max: 6 },
        };

        let swapsApplied = 0;

        for (const outPlayer of variationPool) {
          if (swapsApplied >= 3) break;

          const creditsWithout = picked.reduce((s, p) => s + (p.id === outPlayer.id ? 0 : p.credits), 0);
          const teamCountsWithout: Record<string, number> = {};
          const roleCountsWithout: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
          for (const p of picked) {
            if (p.id === outPlayer.id) continue;
            teamCountsWithout[p.teamShort] = (teamCountsWithout[p.teamShort] || 0) + 1;
            roleCountsWithout[p.role]++;
          }

          // Find next best alternative not already picked
          // Shuffle scored pool so each call picks different alternatives
          const shuffledScored = [...scored].sort(() => Math.random() - 0.5);
          const alternative = shuffledScored.find(p =>
            !pickedIds.has(p.id) &&
            !lockedIds.has(p.id) &&
            p.role === outPlayer.role &&
            (teamCountsWithout[p.teamShort] || 0) < 6 &&
            creditsWithout + p.credits <= 100 &&
            (roleCountsWithout[p.role] || 0) < ROLE_LIMITS_V[p.role].max &&
            (roleCountsWithout[p.role] || 0) >= (ROLE_LIMITS_V[p.role].min - 1)
          );

          if (alternative) {
            const idx = picked.findIndex(p => p.id === outPlayer.id);
            picked[idx] = alternative;
            pickedIds.delete(outPlayer.id);
            pickedIds.add(alternative.id);
            swapsApplied++;
          }
        }

        const hasTournamentData = tournamentTotals.size > 0;
        const matchup = `${match.team1Short} vs ${match.team2Short}`;

        return res.json({
          playerIds: picked.map(p => p.id),
          reason: h2hMatches.length > 0 && hasTournamentData
            ? `Smart pick: IPL 2026 form + ${h2hMatches.length} previous ${matchup} match${h2hMatches.length > 1 ? 'es' : ''}`
            : hasTournamentData
            ? `Smart pick: IPL 2026 form only (first time these teams meet this season)`
            : `Smart pick: based on player credits (first matches of the season — no form data yet)`,
        });
      } catch (err: any) {
        console.error("Smart pick error:", err);
        return res.status(500).json({ message: "Smart pick failed" });
      }
    }
  );

  app.get(
    "/api/my-teams",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const teams = await storage.getUserTeams(req.session.userId!);
      return res.json({ teams });
    }
  );

  app.get(
    "/api/my-teams/:matchId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const teams = await storage.getUserTeamsForMatch(
        req.session.userId!,
        req.params.matchId
      );
      return res.json({ teams });
    }
  );

  app.post(
    "/api/teams",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { matchId, name, playerIds, captainId, viceCaptainId, primaryImpactId, backupImpactId, captainType, vcType, invisibleMode, backupXiPlayer1Id, backupXiPlayer2Id } = req.body;
        console.log("Receiving Team:", JSON.stringify({ matchId, name, playerIds, captainId, viceCaptainId, primaryImpactId, backupImpactId, captainType, vcType }));
        console.log("Player IDs count:", playerIds?.length, "IDs:", playerIds);

        const match = await storage.getMatch(matchId);
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }

        const now = new Date();
        if (match.status === "completed") {
          return res.status(400).json({ message: "Match has already started" });
        }
        // For live/delayed matches, isEntryOpen() is the sole authority
        if (!isEntryOpen(match, now.getTime())) {
          return res
            .status(400)
            .json({ message: "Entry deadline has passed" });
        }

        const existingTeams = await storage.getUserTeamsForMatch(
          req.session.userId!,
          matchId
        );

        const weeklyUsage = await storage.getOrCreateWeeklyUsage(req.session.userId!);
        const maxTeams = storage.canUseMultiTeam(weeklyUsage) ? 3 : 1;

        if (existingTeams.length >= maxTeams) {
          if (maxTeams === 1) {
            return res.status(400).json({ message: "You've used all 3 multi-team slots this week. Only 1 team allowed for this match." });
          }
          return res
            .status(400)
            .json({ message: "Maximum 3 teams per match" });
        }

        if (!playerIds || playerIds.length !== 11) {
          return res
            .status(400)
            .json({ message: "Must select exactly 11 players" });
        }

        // Impact-slot-aware captain/VC validation.
        // captainType and vcType from the request are only honoured when the match
        // has impact features enabled — prevents spoofing the bypass on non-impact matches.
        const reqCaptainType = captainType === "impact_slot" ? "impact_slot" : "player";
        const reqVcType     = vcType === "impact_slot" ? "impact_slot" : "player";
        const matchImpactOn = match.impactFeaturesEnabled === true;
        const captainOnSlot = matchImpactOn && reqCaptainType === "impact_slot";
        const vcOnSlot      = matchImpactOn && reqVcType     === "impact_slot";

        if (captainOnSlot && vcOnSlot) {
          return res.status(400).json({ message: "Both Captain and Vice-Captain cannot be on the Impact Slot." });
        }
        if (!captainOnSlot && !captainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain required" });
        }
        if (!vcOnSlot && !viceCaptainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain required" });
        }

        const matchPlayers = await storage.getPlayersForMatch(matchId);
        const playerMap = new Map(matchPlayers.map(p => [p.id, p]));
        const roleCounts: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
        const teamPlayerCounts: Record<string, number> = {};
        for (const pid of playerIds) {
          const p = playerMap.get(pid);
          if (p) {
            roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
            const ts = p.teamShort || '';
            teamPlayerCounts[ts] = (teamPlayerCounts[ts] || 0) + 1;
          }
        }
        const ROLE_LIMITS: Record<string, { min: number; max: number }> = {
          WK: { min: 1, max: 4 }, BAT: { min: 1, max: 6 },
          AR: { min: 1, max: 6 }, BOWL: { min: 1, max: 6 },
        };
        for (const [role, limits] of Object.entries(ROLE_LIMITS)) {
          const count = roleCounts[role] || 0;
          if (count < limits.min || count > limits.max) {
            return res.status(400).json({ message: `You must select between ${limits.min}-${limits.max} ${role}s` });
          }
        }
        for (const [team, count] of Object.entries(teamPlayerCounts)) {
          if (count > 10) {
            return res.status(400).json({ message: "You can only select a maximum of 10 players from one team." });
          }
        }

        const impactEnabled = match.impactFeaturesEnabled === true;
        let validPrimaryImpactId = null;
        let validBackupImpactId = null;
        let validCaptainType = "player";
        let validVcType = "player";

        if (impactEnabled) {
          if (primaryImpactId) {
            if (playerIds.includes(primaryImpactId)) {
              return res.status(400).json({ message: "Primary Impact Pick cannot be from your Main XI." });
            }
            const primaryPlayer = playerMap.get(primaryImpactId);
            if (!primaryPlayer) {
              return res.status(400).json({ message: "Invalid Primary Impact Pick player." });
            }
            validPrimaryImpactId = primaryImpactId;
          }
          if (backupImpactId) {
            if (playerIds.includes(backupImpactId)) {
              return res.status(400).json({ message: "Backup Impact Pick cannot be from your Main XI." });
            }
            if (backupImpactId === primaryImpactId) {
              return res.status(400).json({ message: "Backup Impact Pick must be different from Primary." });
            }
            const backupPlayer = playerMap.get(backupImpactId);
            if (!backupPlayer) {
              return res.status(400).json({ message: "Invalid Backup Impact Pick player." });
            }
            if (primaryImpactId) {
              const primaryPlayer = playerMap.get(primaryImpactId);
              if (primaryPlayer && backupPlayer && primaryPlayer.teamShort !== backupPlayer.teamShort) {
                return res.status(400).json({ message: "Backup Impact Pick must be from the same franchise as Primary." });
              }
            }
            validBackupImpactId = backupImpactId;
          }

          if (captainType === "impact_slot") {
            if (!validPrimaryImpactId) {
              return res.status(400).json({ message: "Cannot set Captain on Impact Slot without an Impact Pick." });
            }
            validCaptainType = "impact_slot";
          }
          if (vcType === "impact_slot") {
            if (!validPrimaryImpactId) {
              return res.status(400).json({ message: "Cannot set Vice-Captain on Impact Slot without an Impact Pick." });
            }
            validVcType = "impact_slot";
          }
          if (captainType === "impact_slot" && vcType === "impact_slot") {
            return res.status(400).json({ message: "Both Captain and Vice-Captain cannot be on the Impact Slot." });
          }
        }

        // ── Captain / Vice-Captain integrity ─────────────────────────────────────
        if (validCaptainType === "player" && captainId && !playerIds.includes(captainId)) {
          return res.status(400).json({ message: "Captain must be one of your selected 11 players." });
        }
        if (validVcType === "player" && viceCaptainId && !playerIds.includes(viceCaptainId)) {
          return res.status(400).json({ message: "Vice-Captain must be one of your selected 11 players." });
        }
        if (validCaptainType === "player" && validVcType === "player" && captainId && viceCaptainId && captainId === viceCaptainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain cannot be the same player." });
        }

        // ---- XI BACKUP VALIDATION ----
        // Backups are locked once official Playing XI is announced (playingXIManual = true)
        let validBackupXi1: string | null = null;
        let validBackupXi2: string | null = null;
        if (!match.playingXIManual) {
          const impactSet = new Set([validPrimaryImpactId, validBackupImpactId].filter(Boolean) as string[]);
          for (const [slot, rawId] of [['Backup 1', backupXiPlayer1Id], ['Backup 2', backupXiPlayer2Id]] as const) {
            if (!rawId) continue;
            if (playerIds.includes(rawId)) {
              return res.status(400).json({ message: `${slot} cannot be one of your main XI players.` });
            }
            if (impactSet.has(rawId)) {
              return res.status(400).json({ message: `${slot} cannot overlap with your Impact picks.` });
            }
            if (!playerMap.get(rawId)) {
              return res.status(400).json({ message: `${slot} player not found in this match.` });
            }
          }
          if (backupXiPlayer1Id && backupXiPlayer2Id && backupXiPlayer1Id === backupXiPlayer2Id) {
            return res.status(400).json({ message: "Backup 1 and Backup 2 must be different players." });
          }
          validBackupXi1 = backupXiPlayer1Id || null;
          validBackupXi2 = backupXiPlayer2Id || null;
        }
        // If XI announced, silently ignore backup IDs (they're locked — UI should already block this)

        // Cross-validation: final backup values must never overlap with the final main XI.
        // This catches the case where a user previously saved valid backups, then edited their
        // XI to include one of those backup players without clearing the backup field.
        const playerIdSet = new Set(playerIds as string[]);
        if (validBackupXi1 && playerIdSet.has(validBackupXi1)) {
          validBackupXi1 = null; // auto-clear silently — safer than 400 which blocks team save
        }
        if (validBackupXi2 && playerIdSet.has(validBackupXi2)) {
          validBackupXi2 = null;
        }

        const sortedNewIds = [...playerIds].sort();
        for (const et of existingTeams) {
          const sortedExisting = [...(et.playerIds || [])].sort();
          const samePlayerIds = sortedNewIds.length === sortedExisting.length && sortedNewIds.every((id: string, i: number) => id === sortedExisting[i]);
          if (samePlayerIds && et.captainId === captainId && et.viceCaptainId === viceCaptainId
            && et.primaryImpactId === validPrimaryImpactId && et.backupImpactId === validBackupImpactId
            && et.captainType === validCaptainType && et.vcType === validVcType) {
            return res.status(400).json({ message: "You have already created this exact team. Please change at least one player or the Captain/VC." });
          }
        }

        const existingPrediction = await storage.getUserPredictionForMatch(req.session.userId!, matchId);
        if (!existingPrediction) {
          return res.status(400).json({ message: "You must predict a match winner before submitting your team." });
        }

        let useInvisible = false;
        if (impactEnabled && invisibleMode === true) {
          const invUsage = await storage.getOrCreateWeeklyUsage(req.session.userId!);
          if (!storage.canUseInvisibleMode(invUsage)) {
            return res.status(400).json({ message: "You've already used Invisible Mode once this week." });
          }
          const existingInvisible = existingTeams.some(t => t.invisibleMode === true);
          if (existingInvisible) {
            useInvisible = true;
          } else {
            useInvisible = true;
            await storage.incrementInvisibleUsage(req.session.userId!);
          }
        }

        // Hard gate — re-fetch usage immediately before save to catch any race condition
        // between the first check (above) and the actual team creation.
        if (existingTeams.length >= 1) {
          const freshUsage = await storage.getOrCreateWeeklyUsage(req.session.userId!);
          if (!storage.canUseMultiTeam(freshUsage)) {
            return res.status(400).json({ message: "You've used all 3 multi-team slots this week. Only 1 team allowed per match until Monday." });
          }
        }

        const team = await storage.createUserTeam({
          userId: req.session.userId!,
          matchId,
          name: name || `Team ${existingTeams.length + 1}`,
          playerIds,
          captainId,
          viceCaptainId,
          primaryImpactId: validPrimaryImpactId,
          backupImpactId: validBackupImpactId,
          captainType: validCaptainType,
          vcType: validVcType,
          invisibleMode: useInvisible,
          backupXiPlayer1Id: validBackupXi1,
          backupXiPlayer2Id: validBackupXi2,
        });

        // Consume one weekly multi-team slot when the user creates their 2nd team
        // for a match (first multi-team usage for this match). Creating a 3rd team
        // for the same match does not cost an additional slot.
        if (existingTeams.length === 1) {
          await storage.incrementMultiTeamUsage(req.session.userId!);
        }

        return res.json({ team, weeklyUsage: { maxTeams, teamsCreated: existingTeams.length + 1 } });
      } catch (err: any) {
        console.error("CRITICAL TEAM SAVE ERROR:", err);
        console.error("CRITICAL TEAM SAVE STACK:", err?.stack);
        return res.status(500).json({
          message: "Server Crash: " + (err?.message || "Unknown Error"),
          details: String(err?.stack || err),
        });
      }
    }
  );

  app.put(
    "/api/teams/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const team = await storage.getUserTeam(req.params.id);
        if (!team) {
          return res.status(404).json({ message: "Team not found" });
        }
        if (team.userId !== req.session.userId) {
          return res.status(403).json({ message: "Not your team" });
        }
        const match = await storage.getMatch(team.matchId);
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }
        const now = new Date();
        if (match.status === "completed") {
          return res.status(400).json({ message: "Match has already started" });
        }
        // For live/delayed matches, isEntryOpen() is the sole authority
        if (!isEntryOpen(match, now.getTime())) {
          return res.status(400).json({ message: "Entry deadline has passed" });
        }

        const { playerIds, captainId, viceCaptainId, primaryImpactId, backupImpactId, captainType, vcType, invisibleMode, backupXiPlayer1Id, backupXiPlayer2Id } = req.body;
        if (!playerIds || playerIds.length !== 11) {
          return res.status(400).json({ message: "Must select exactly 11 players" });
        }

        // Impact-slot-aware captain/VC validation (mirrors POST /api/teams logic).
        const reqCaptainTypeU = captainType === "impact_slot" ? "impact_slot" : "player";
        const reqVcTypeU      = vcType === "impact_slot" ? "impact_slot" : "player";
        const matchImpactOnU  = match.impactFeaturesEnabled === true;
        const captainOnSlotU  = matchImpactOnU && reqCaptainTypeU === "impact_slot";
        const vcOnSlotU       = matchImpactOnU && reqVcTypeU     === "impact_slot";

        if (captainOnSlotU && vcOnSlotU) {
          return res.status(400).json({ message: "Both Captain and Vice-Captain cannot be on the Impact Slot." });
        }
        if (!captainOnSlotU && !captainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain required" });
        }
        if (!vcOnSlotU && !viceCaptainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain required" });
        }

        const matchPlayers = await storage.getPlayersForMatch(team.matchId);
        const playerMap = new Map(matchPlayers.map(p => [p.id, p]));
        const roleCounts: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
        const teamPlayerCounts: Record<string, number> = {};
        for (const pid of playerIds) {
          const p = playerMap.get(pid);
          if (p) {
            roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
            const ts = p.teamShort || '';
            teamPlayerCounts[ts] = (teamPlayerCounts[ts] || 0) + 1;
          }
        }
        const ROLE_LIMITS: Record<string, { min: number; max: number }> = {
          WK: { min: 1, max: 4 }, BAT: { min: 1, max: 6 },
          AR: { min: 1, max: 6 }, BOWL: { min: 1, max: 6 },
        };
        for (const [role, limits] of Object.entries(ROLE_LIMITS)) {
          const count = roleCounts[role] || 0;
          if (count < limits.min || count > limits.max) {
            return res.status(400).json({ message: `You must select between ${limits.min}-${limits.max} ${role}s` });
          }
        }
        for (const [t, count] of Object.entries(teamPlayerCounts)) {
          if (count > 10) {
            return res.status(400).json({ message: "You can only select a maximum of 10 players from one team." });
          }
        }

        const impactEnabled = match.impactFeaturesEnabled === true;
        let validPrimaryImpactId = null;
        let validBackupImpactId = null;
        let validCaptainType = "player";
        let validVcType = "player";

        if (impactEnabled) {
          if (primaryImpactId) {
            if (playerIds.includes(primaryImpactId)) {
              return res.status(400).json({ message: "Primary Impact Pick cannot be from your Main XI." });
            }
            const primaryPlayer = playerMap.get(primaryImpactId);
            if (!primaryPlayer) return res.status(400).json({ message: "Invalid Primary Impact Pick player." });
            validPrimaryImpactId = primaryImpactId;
          }
          if (backupImpactId) {
            if (playerIds.includes(backupImpactId)) {
              return res.status(400).json({ message: "Backup Impact Pick cannot be from your Main XI." });
            }
            if (backupImpactId === primaryImpactId) {
              return res.status(400).json({ message: "Backup Impact Pick must be different from Primary." });
            }
            const backupPlayer = playerMap.get(backupImpactId);
            if (!backupPlayer) return res.status(400).json({ message: "Invalid Backup Impact Pick player." });
            if (primaryImpactId) {
              const primaryPlayer = playerMap.get(primaryImpactId);
              if (primaryPlayer && backupPlayer && primaryPlayer.teamShort !== backupPlayer.teamShort) {
                return res.status(400).json({ message: "Backup Impact Pick must be from the same franchise as Primary." });
              }
            }
            validBackupImpactId = backupImpactId;
          }
          if (captainType === "impact_slot") {
            if (!validPrimaryImpactId) return res.status(400).json({ message: "Cannot set Captain on Impact Slot without an Impact Pick." });
            validCaptainType = "impact_slot";
          }
          if (vcType === "impact_slot") {
            if (!validPrimaryImpactId) return res.status(400).json({ message: "Cannot set Vice-Captain on Impact Slot without an Impact Pick." });
            validVcType = "impact_slot";
          }
          if (captainType === "impact_slot" && vcType === "impact_slot") {
            return res.status(400).json({ message: "Both Captain and Vice-Captain cannot be on the Impact Slot." });
          }
        }

        // ── Captain / Vice-Captain integrity ─────────────────────────────────────
        if (validCaptainType === "player" && captainId && !playerIds.includes(captainId)) {
          return res.status(400).json({ message: "Captain must be one of your selected 11 players." });
        }
        if (validVcType === "player" && viceCaptainId && !playerIds.includes(viceCaptainId)) {
          return res.status(400).json({ message: "Vice-Captain must be one of your selected 11 players." });
        }
        if (validCaptainType === "player" && validVcType === "player" && captainId && viceCaptainId && captainId === viceCaptainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain cannot be the same player." });
        }

        // ---- XI BACKUP VALIDATION (edit) ----
        // If XI announced, preserve existing backups and ignore any new ones from the request.
        let validBackupXi1Edit: string | null = team.backupXiPlayer1Id ?? null;
        let validBackupXi2Edit: string | null = team.backupXiPlayer2Id ?? null;
        if (!match.playingXIManual) {
          const impactSetE = new Set([validPrimaryImpactId, validBackupImpactId].filter(Boolean) as string[]);
          const playerMapE = new Map((await storage.getPlayersForMatch(team.matchId)).map(p => [p.id, p]));
          for (const [slot, rawId] of [['Backup 1', backupXiPlayer1Id], ['Backup 2', backupXiPlayer2Id]] as const) {
            if (rawId === undefined) continue; // not sent — keep existing
            if (!rawId) { /* clearing */ continue; }
            if (playerIds.includes(rawId)) return res.status(400).json({ message: `${slot} cannot be one of your main XI players.` });
            if (impactSetE.has(rawId)) return res.status(400).json({ message: `${slot} cannot overlap with your Impact picks.` });
            if (!playerMapE.get(rawId)) return res.status(400).json({ message: `${slot} player not found in this match.` });
          }
          if (backupXiPlayer1Id !== undefined) validBackupXi1Edit = backupXiPlayer1Id || null;
          if (backupXiPlayer2Id !== undefined) validBackupXi2Edit = backupXiPlayer2Id || null;
          if (validBackupXi1Edit && validBackupXi2Edit && validBackupXi1Edit === validBackupXi2Edit) {
            return res.status(400).json({ message: "Backup 1 and Backup 2 must be different players." });
          }
        }

        // Cross-validation: the final backup values (whether newly submitted or carried over from
        // the existing saved team) must never overlap with the final main XI playerIds.
        // This is the exact gap that created the duplicate-player bug: a user could save B1=D.Miller
        // (valid at the time), then edit their XI to include D.Miller without changing B1, and the
        // carried-over backup value was never re-checked against the updated player list.
        const playerIdSetE = new Set(playerIds as string[]);
        if (validBackupXi1Edit && playerIdSetE.has(validBackupXi1Edit)) {
          validBackupXi1Edit = null; // auto-clear: carried-over backup now conflicts with new XI
        }
        if (validBackupXi2Edit && playerIdSetE.has(validBackupXi2Edit)) {
          validBackupXi2Edit = null;
        }

        // ── Carried-forward backup XI vs impact picks integrity ───────────────────
        // The impactSetE check above only runs for newly submitted backup IDs
        // (rawId !== undefined). Carried-forward values skip that block entirely.
        // This guard closes that gap by re-checking the final resolved backup XI
        // values against the final resolved impact picks before the DB write.
        const finalImpactSetE = new Set(
          [validPrimaryImpactId, validBackupImpactId].filter(Boolean) as string[]
        );
        if (validBackupXi1Edit && finalImpactSetE.has(validBackupXi1Edit)) {
          return res.status(400).json({ message: "Backup 1 overlaps with your Impact picks. Please update or clear Backup 1 before saving." });
        }
        if (validBackupXi2Edit && finalImpactSetE.has(validBackupXi2Edit)) {
          return res.status(400).json({ message: "Backup 2 overlaps with your Impact picks. Please update or clear Backup 2 before saving." });
        }

        const existingTeams = await storage.getUserTeamsForMatch(req.session.userId!, team.matchId);
        const sortedNewIds = [...playerIds].sort();
        for (const et of existingTeams) {
          if (et.id === team.id) continue;
          const sortedExisting = [...(et.playerIds || [])].sort();
          const samePlayerIds = sortedNewIds.length === sortedExisting.length && sortedNewIds.every((id: string, i: number) => id === sortedExisting[i]);
          if (samePlayerIds && et.captainId === captainId && et.viceCaptainId === viceCaptainId
            && et.primaryImpactId === validPrimaryImpactId && et.backupImpactId === validBackupImpactId
            && et.captainType === validCaptainType && et.vcType === validVcType) {
            return res.status(400).json({ message: "You have already created this exact team. Please change at least one player or the Captain/VC." });
          }
        }

        let useInvisible = team.invisibleMode || false;
        if (impactEnabled && invisibleMode === true && !team.invisibleMode) {
          const invUsage = await storage.getOrCreateWeeklyUsage(req.session.userId!);
          if (!storage.canUseInvisibleMode(invUsage)) {
            return res.status(400).json({ message: "You've already used Invisible Mode once this week." });
          }
          const existingInvisible = existingTeams.some(t => t.id !== team.id && t.invisibleMode === true);
          if (!existingInvisible) {
            await storage.incrementInvisibleUsage(req.session.userId!);
          }
          useInvisible = true;
        } else if (invisibleMode === false && team.invisibleMode) {
          const existingInvisible = existingTeams.filter(t => t.id !== team.id && t.invisibleMode === true);
          if (existingInvisible.length === 0) {
            await storage.decrementInvisibleUsage(req.session.userId!);
          }
          useInvisible = false;
        }

        const updated = await storage.updateUserTeam(req.params.id, req.session.userId!, {
          playerIds,
          captainId,
          viceCaptainId,
          primaryImpactId: validPrimaryImpactId,
          backupImpactId: validBackupImpactId,
          captainType: validCaptainType,
          vcType: validVcType,
          invisibleMode: useInvisible,
          backupXiPlayer1Id: validBackupXi1Edit,
          backupXiPlayer2Id: validBackupXi2Edit,
        });
        return res.json({ team: updated });
      } catch (err: any) {
        console.error("Update team error:", err);
        return res.status(500).json({ message: "Failed to update team" });
      }
    }
  );

  // ── Dedicated backup-XI update — not gated by entry deadline ────────────
  // Users can set/change XI backups any time up until the Playing XI is
  // announced (match.playingXIManual). The main entry deadline only applies
  // to changing players / captain / VC.
  app.patch(
    "/api/teams/:id/backup-xi",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const team = await storage.getUserTeam(req.params.id);
        if (!team) return res.status(404).json({ message: "Team not found" });
        if (team.userId !== req.session.userId) return res.status(403).json({ message: "Not your team" });

        const match = await storage.getMatch(team.matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (match.playingXIManual) {
          return res.status(400).json({ message: "XI Backups are locked — Playing XI has already been announced." });
        }
        if (match.status === "completed") {
          return res.status(400).json({ message: "Match is already completed." });
        }

        const { backupXiPlayer1Id, backupXiPlayer2Id } = req.body as {
          backupXiPlayer1Id?: string | null;
          backupXiPlayer2Id?: string | null;
        };

        const matchPlayers = await storage.getPlayersForMatch(team.matchId);
        const playerMapB = new Map(matchPlayers.map((p) => [p.id, p]));
        const mainXiIds = new Set<string>(team.playerIds || []);
        const impactIds = new Set<string>(
          [team.primaryImpactId, team.backupImpactId].filter(Boolean) as string[]
        );

        let b1: string | null = backupXiPlayer1Id !== undefined ? (backupXiPlayer1Id || null) : (team.backupXiPlayer1Id ?? null);
        let b2: string | null = backupXiPlayer2Id !== undefined ? (backupXiPlayer2Id || null) : (team.backupXiPlayer2Id ?? null);

        for (const [slot, id] of [["B1", b1], ["B2", b2]] as const) {
          if (!id) continue;
          if (!playerMapB.has(id)) return res.status(400).json({ message: `${slot} player not found in this match.` });
          if (mainXiIds.has(id)) return res.status(400).json({ message: `${slot} cannot be one of your main XI players.` });
          if (impactIds.has(id)) return res.status(400).json({ message: `${slot} cannot overlap with your Impact picks.` });
        }
        if (b1 && b2 && b1 === b2) {
          return res.status(400).json({ message: "Backup 1 and Backup 2 must be different players." });
        }

        const updated = await storage.updateUserTeam(req.params.id, req.session.userId!, {
          backupXiPlayer1Id: b1,
          backupXiPlayer2Id: b2,
        });
        return res.json({ team: updated });
      } catch (err: any) {
        console.error("Backup XI update error:", err);
        return res.status(500).json({ message: "Failed to update XI backups" });
      }
    }
  );

  app.delete(
    "/api/teams/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const team = await storage.getUserTeam(req.params.id);
        if (!team) {
          return res.status(404).json({ message: "Team not found" });
        }
        if (team.userId !== req.session.userId) {
          return res.status(403).json({ message: "Not your team" });
        }
        const match = await storage.getMatch(team.matchId);
        if (match) {
          const now = new Date();
          if (match.status === "live" || match.status === "completed") {
            return res.status(400).json({ message: "Cannot delete team after match has started" });
          }
          if (!isEntryOpen(match, now.getTime())) {
            return res.status(400).json({ message: "Cannot delete team after deadline has passed" });
          }
        }
        await storage.deleteUserTeam(req.params.id, req.session.userId!);
        return res.json({ ok: true });
      } catch (err: any) {
        console.error("Delete team error:", err);
        return res.status(500).json({ message: "Failed to delete team" });
      }
    }
  );

  // ---- PREDICTIONS ----
  app.post(
    "/api/predictions",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { matchId, predictedWinner } = req.body;
        if (!matchId || !predictedWinner) {
          return res.status(400).json({ message: "matchId and predictedWinner are required" });
        }
        const match = await storage.getMatch(matchId);
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }
        if (match.status === "completed") {
          return res.status(400).json({ message: "Match has already started" });
        }
        if (!isEntryOpen(match, Date.now())) {
          return res.status(400).json({ message: "Entry deadline has passed" });
        }
        if (predictedWinner !== match.team1Short && predictedWinner !== match.team2Short) {
          return res.status(400).json({ message: "Invalid team selection" });
        }
        const existing = await storage.getUserPredictionForMatch(req.session.userId!, matchId);
        let prediction;
        if (existing) {
          prediction = await storage.updatePrediction(req.session.userId!, matchId, predictedWinner);
        } else {
          prediction = await storage.createPrediction({
            userId: req.session.userId!,
            matchId,
            predictedWinner,
          });
        }
        return res.json({ prediction });
      } catch (err: any) {
        console.error("Prediction error:", err);
        return res.status(500).json({ message: "Failed to save prediction" });
      }
    }
  );

  app.get(
    "/api/predictions/:matchId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const match = await storage.getMatch(req.params.matchId);
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }
        const isRevealed = match.status === "live" || match.status === "completed" || match.status === "delayed";
        const myPrediction = await storage.getUserPredictionForMatch(
          req.session.userId!,
          req.params.matchId
        );
        if (!isRevealed) {
          return res.json({
            isRevealed: false,
            myPrediction: myPrediction
              ? { id: myPrediction.id, predictedWinner: myPrediction.predictedWinner }
              : null,
            predictions: [],
          });
        }
        const allPredictions = await storage.getPredictionsForMatch(req.params.matchId);
        const userIds = [...new Set(allPredictions.map(p => p.userId))];
        const usersData: Record<string, { username: string; teamName: string }> = {};
        for (const uid of userIds) {
          const u = await storage.getUser(uid);
          if (u) usersData[uid] = { username: u.username, teamName: u.teamName || "" };
        }
        const predictions = allPredictions.map(p => ({
          id: p.id,
          userId: p.userId,
          username: usersData[p.userId]?.username || "Unknown",
          teamName: usersData[p.userId]?.teamName || "",
          predictedWinner: p.predictedWinner,
        }));
        return res.json({
          isRevealed: true,
          myPrediction: myPrediction
            ? { id: myPrediction.id, predictedWinner: myPrediction.predictedWinner }
            : null,
          predictions,
        });
      } catch (err: any) {
        console.error("Get predictions error:", err);
        return res.status(500).json({ message: "Failed to fetch predictions" });
      }
    }
  );

  // ---- LEADERBOARD ----
  app.get("/api/leaderboard", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      return res.json(leaderboard);
    } catch (e: any) {
      return res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // ---- SERVER TIME ----
  app.get("/api/server-time", (_req: Request, res: Response) => {
    return res.json({ serverTime: new Date().toISOString() });
  });

  // ---- CRICKET API: SYNC (IPL only) ----
  app.post(
    "/api/admin/sync-matches",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        await syncMatchesFromApi();
        await refreshStaleMatchStatuses();
        return res.json({
          message: "Match sync triggered successfully",
        });
      } catch (err: any) {
        console.error("Sync error:", err);
        return res.status(500).json({ message: "Sync failed" });
      }
    }
  );

  // ---- ADMIN: CREATE MATCH MANUALLY ----
  app.post(
    "/api/admin/matches",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const {
          team1,
          team1Short,
          team1Color,
          team2,
          team2Short,
          team2Color,
          venue,
          startTime,
          league,
        } = req.body;

        if (!team1 || !team2 || !startTime) {
          return res
            .status(400)
            .json({ message: "team1, team2, and startTime are required" });
        }

        const match = await storage.createMatch({
          team1,
          team1Short: team1Short || team1.substring(0, 3).toUpperCase(),
          team1Color: team1Color || "#333",
          team2,
          team2Short: team2Short || team2.substring(0, 3).toUpperCase(),
          team2Color: team2Color || "#666",
          venue: venue || "",
          startTime: new Date(startTime),
          status: "upcoming",
          league: league || "",
          totalPrize: "0",
          entryFee: 0,
          spotsTotal: 100,
          spotsFilled: 0,
        });

        return res.json({ match });
      } catch (err: any) {
        console.error("Create match error:", err);
        return res.status(500).json({ message: "Failed to create match" });
      }
    }
  );

  // ---- ADMIN: BROWSE API MATCHES (non-IPL, not yet in DB) ----
  app.get(
    "/api/admin/browse-api-matches",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const isIPL = (name: string, league: string) => {
          const n = (name + " " + league).toLowerCase();
          return n.includes("indian premier league") || n.includes(" ipl") || n.includes("ipl ");
        };

        // Fetch match-level results, series list, and DB matches in parallel
        const [apiMatches, seriesList, existingMatches] = await Promise.all([
          fetchUpcomingMatches(),
          fetchSeriesList(),
          storage.getAllMatches(),
        ]);

        const existingIds = new Set(existingMatches.map((m: any) => m.externalId).filter(Boolean));
        const now = Date.now();
        const ms30d = 30 * 24 * 60 * 60 * 1000;

        // Qualify non-IPL series whose startDate is within [-30 days, +30 days] of now, cap at 10
        // Sort ascending by startDate so nearest series are prioritised before the cap
        const qualifyingSeries = seriesList
          .filter((s) => {
            if (!s.startDate) return false;
            if (isIPL(s.name, "")) return false;
            const t = new Date(s.startDate).getTime();
            return t >= now - ms30d && t <= now + ms30d;
          })
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
          .slice(0, 10);

        console.log(`Browse API Matches: ${qualifyingSeries.length} qualifying non-IPL series to probe:`, qualifyingSeries.map((s) => s.name));

        // Fetch fixtures for all qualifying series in parallel
        const seriesFixtureSets = await Promise.all(
          qualifyingSeries.map((s) => fetchSeriesMatches(s.id, s.name))
        );

        // Merge match-level + all series fixtures into a Map by externalId (dedup)
        const combined = new Map<string, typeof apiMatches[0]>();
        for (const m of apiMatches) {
          if (m.externalId) combined.set(m.externalId, m);
        }
        for (const fixtures of seriesFixtureSets) {
          for (const m of fixtures) {
            if (m.externalId && !combined.has(m.externalId)) {
              combined.set(m.externalId, m);
            }
          }
        }

        console.log(`Browse API Matches: ${apiMatches.length} match-level + ${[...combined.values()].length - apiMatches.filter(m => m.externalId && combined.has(m.externalId)).length} series-only = ${combined.size} total before filters`);

        // Apply existing downstream filters unchanged
        const ms7d = 7 * 24 * 60 * 60 * 1000;
        const filtered = [...combined.values()].filter((m) => {
          if (existingIds.has(m.externalId)) return false;
          if (isIPL(m.team1 + " " + m.team2, m.league)) return false;
          if (m.status === "completed") return false;
          const t = new Date(m.startTime).getTime();
          return t >= now - 86400000 && t <= now + ms7d; // 24hr lookback so live matches can still be added
        });

        return res.json({ matches: filtered });
      } catch (err: any) {
        console.error("Browse API matches error:", err);
        return res.status(500).json({ message: "Failed to fetch API matches" });
      }
    }
  );

  // ---- ADMIN: IMPORT API MATCH ----
  app.post(
    "/api/admin/import-api-match",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { externalId, seriesId, team1, team1Short, team1Color, team2, team2Short, team2Color, venue, startTime, league } = req.body;
        if (!team1 || !team2 || !startTime) {
          return res.status(400).json({ message: "team1, team2, and startTime are required" });
        }
        const existing = await storage.getAllMatches();
        if (externalId && existing.some((m: any) => m.externalId === externalId)) {
          return res.status(409).json({ message: "Match already exists in database" });
        }
        const IPL_TEAM_SHORTS = ['RR','RCB','MI','CSK','KKR','SRH','DC','PBKS','GT','LSG'];
        const t1s = (team1Short || team1.substring(0, 3)).toUpperCase();
        const t2s = (team2Short || team2.substring(0, 3)).toUpperCase();
        const isIPLMatch = IPL_TEAM_SHORTS.includes(t1s) || IPL_TEAM_SHORTS.includes(t2s)
          || (league || "").toLowerCase().includes("indian premier")
          || (league || "").toLowerCase().includes("ipl");

        // Auto-detect tournamentName for IPL matches
        let autoTournamentName: string | null = null;
        if (isIPLMatch) {
          const existingIPLName = await db.execute(sql`
            SELECT tournament_name FROM matches
            WHERE tournament_name IS NOT NULL
              AND tournament_name != ''
              AND (
                LOWER(tournament_name) LIKE '%ipl%'
                OR LOWER(tournament_name) LIKE '%indian premier%'
              )
            ORDER BY start_time DESC
            LIMIT 1
          `);
          autoTournamentName = existingIPLName.rows.length > 0
            ? (existingIPLName.rows[0] as any).tournament_name
            : "Indian Premier League 2026";
        }

        const match = await storage.createMatch({
          externalId: externalId || null,
          seriesId: seriesId || null,
          team1,
          team1Short: t1s,
          team1Color: team1Color || "#333",
          team2,
          team2Short: t2s,
          team2Color: team2Color || "#666",
          venue: venue || "",
          startTime: new Date(startTime),
          status: "upcoming",
          league: league || "",
          totalPrize: "0",
          entryFee: 0,
          spotsTotal: 100,
          spotsFilled: 0,
          ...(autoTournamentName ? { tournamentName: autoTournamentName } : {}),
        } as any);

        // Auto-fetch squad so players are available immediately
        let playersLoaded = 0;
        let squadMessage = "No squad data found yet — use 'Fetch Squad' in Match Controls.";
        if (externalId) {
          try {
            const { fetchMatchSquad, fetchSeriesSquad } = await import("./cricket-api");
            let squad = await fetchMatchSquad(externalId);
            if (squad.length === 0 && seriesId) {
              const seriesPlayers = await fetchSeriesSquad(seriesId);
              const t1 = team1.toLowerCase();
              const t2 = team2.toLowerCase();
              const t1s = (team1Short || "").toLowerCase();
              const t2s = (team2Short || "").toLowerCase();
              squad = seriesPlayers.filter((p) => {
                const pTeam = p.team.toLowerCase();
                const pShort = p.teamShort.toLowerCase();
                return pTeam === t1 || pTeam === t2 ||
                  pTeam.includes(t1) || t1.includes(pTeam) ||
                  pTeam.includes(t2) || t2.includes(pTeam) ||
                  pShort === t1s || pShort === t2s;
              });
            }
            if (squad.length > 0) {
              await storage.upsertPlayersForMatch(match.id, squad.map((p) => ({
                matchId: match.id,
                externalId: p.externalId,
                name: p.name,
                team: p.team,
                teamShort: p.teamShort,
                role: p.role,
                credits: p.credits,
              })));
              playersLoaded = squad.length;
              squadMessage = `${playersLoaded} players loaded automatically.`;
            }
          } catch (e) {
            console.error("Auto squad fetch failed:", e);
          }
        }

        return res.json({ match, playersLoaded, squadMessage });
      } catch (err: any) {
        console.error("Import API match error:", err);
        return res.status(500).json({ message: "Failed to import match" });
      }
    }
  );

  // ---- ADMIN: BACKFILL TOURNAMENT NAMES ----
  app.post(
    "/api/admin/backfill-tournament-names",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const existingName = await db.execute(sql`
          SELECT tournament_name FROM matches
          WHERE tournament_name IS NOT NULL AND tournament_name != ''
            AND (LOWER(tournament_name) LIKE '%ipl%' OR LOWER(tournament_name) LIKE '%indian premier%')
          ORDER BY start_time DESC LIMIT 1
        `);
        const tournamentName = existingName.rows.length > 0
          ? (existingName.rows[0] as any).tournament_name
          : "Indian Premier League 2026";

        await db.execute(sql`
          UPDATE matches
          SET tournament_name = ${tournamentName}
          WHERE (tournament_name IS NULL OR tournament_name = '')
            AND (
              team1_short IN ('RR','RCB','MI','CSK','KKR','SRH','DC','PBKS','GT','LSG')
              OR team2_short IN ('RR','RCB','MI','CSK','KKR','SRH','DC','PBKS','GT','LSG')
            )
        `);
        return res.json({ message: `Backfilled "${tournamentName}" on all IPL matches missing it` });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // ---- ADMIN: UPDATE MATCH ----
  app.patch(
    "/api/admin/matches/:id",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const updates = req.body;
        if (updates.startTime) updates.startTime = new Date(updates.startTime);
        await storage.updateMatch(matchId, updates);
        return res.json({ message: "Match updated" });
      } catch (err: any) {
        console.error("Update match error:", err);
        return res.status(500).json({ message: "Failed to update match" });
      }
    }
  );

  // ---- ADMIN: DELETE MATCH ----
  app.delete(
    "/api/admin/matches/:id",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const forceDelete = req.query.force === "true";
        const teams = await storage.getAllTeamsForMatch(matchId);
        if (teams.length > 0 && !forceDelete) {
          return res.status(400).json({ message: `Cannot delete this match — ${teams.length} user team${teams.length === 1 ? '' : 's'} exist. Please use Void Match instead.` });
        }
        if (teams.length > 0 && forceDelete) {
          for (const team of teams) {
            await storage.deleteTeam(team.id);
          }
        }
        await storage.deleteMatchCascade(matchId);
        await storage.createAuditLog({
          adminUserId: req.session.userId!,
          actionType: "delete_match",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ forced: forceDelete, teamsRemoved: teams.length }),
        });
        return res.json({ message: "Match permanently deleted" });
      } catch (err: any) {
        console.error("Delete match error:", err);
        return res.status(500).json({ message: "Failed to delete match" });
      }
    }
  );

  // ---- ADMIN: FETCH SQUAD FROM API ----
  app.post(
    "/api/admin/matches/:id/fetch-squad",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      const matchId = req.params.id;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });
      if (!match.externalId) return res.status(400).json({ message: "This match has no external API ID — squad cannot be fetched automatically." });

      try {
        const { fetchMatchSquad, fetchSeriesSquad } = await import("./cricket-api");
        let squad = await fetchMatchSquad(match.externalId);
        let source = "CricAPI (match_squad)";
        console.log(`[Fetch Squad] Tier 1 match_squad returned ${squad.length} players for ${match.team1Short} vs ${match.team2Short}`);

        if (squad.length === 0 && match.seriesId) {
          const seriesPlayers = await fetchSeriesSquad(match.seriesId);
          const team1 = match.team1.toLowerCase();
          const team2 = match.team2.toLowerCase();
          const t1Short = match.team1Short.toLowerCase();
          const t2Short = match.team2Short.toLowerCase();
          squad = seriesPlayers.filter((p) => {
            const pTeam = p.team.toLowerCase();
            const pShort = p.teamShort.toLowerCase();
            return pTeam === team1 || pTeam === team2 ||
              pTeam.includes(team1) || team1.includes(pTeam) ||
              pTeam.includes(team2) || team2.includes(pTeam) ||
              pShort === t1Short || pShort === t2Short;
          });
          source = "CricAPI (series_squad)";
          console.log(`[Fetch Squad] Tier 1 series_squad filtered ${squad.length} players`);
        }

        if (squad.length === 0) {
          return res.json({
            message: `No squad data found for ${match.team1Short} vs ${match.team2Short}. API may not have squads yet.`,
            totalPlayers: 0,
            source: "none",
          });
        }

        await storage.upsertPlayersForMatch(matchId, squad.map((p) => ({
          matchId,
          externalId: p.externalId,
          name: p.name,
          team: p.team,
          teamShort: p.teamShort,
          role: p.role,
          credits: p.credits,
        })));

        const matchPlayers = await storage.getPlayersForMatch(matchId);
        return res.json({
          message: `Squad imported successfully! ${matchPlayers.length} players loaded for ${match.team1Short} vs ${match.team2Short}`,
          totalPlayers: matchPlayers.length,
          source,
        });
      } catch (err) {
        console.error("[Fetch Squad] error:", err);
        return res.status(500).json({ message: "Failed to fetch squad from API" });
      }
    }
  );

  // ---- ADMIN: ADD PLAYERS TO MATCH ----
  app.post(
    "/api/admin/matches/:id/players",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { players: playerList } = req.body;
        if (!playerList || !Array.isArray(playerList)) {
          return res.status(400).json({ message: "players array required" });
        }

        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const playersToUpsert = playerList.map((p: any) => ({
          matchId,
          externalId: p.externalId || undefined,
          name: p.name,
          apiName: p.apiName || null,
          team: p.team,
          teamShort: p.teamShort || p.team.substring(0, 3).toUpperCase(),
          role: p.role || "BAT",
          credits: p.credits || 8,
          points: p.points || 0,
          selectedBy: p.selectedBy || 0,
          recentForm: p.recentForm || [],
          isImpactPlayer: p.isImpactPlayer || false,
        }));

        // Use upsert so re-running the same import never creates duplicate rows.
        // Deduplication is by externalId first, then name+teamShort (case-insensitive).
        await storage.upsertPlayersForMatch(matchId, playersToUpsert);

        // Return team-wise counts from the live DB after upsert
        const allAfter = await storage.getPlayersForMatch(matchId);
        const byTeam: Record<string, number> = {};
        for (const p of allAfter) { byTeam[p.teamShort] = (byTeam[p.teamShort] ?? 0) + 1; }

        return res.json({
          message: `Upserted ${playersToUpsert.length} players`,
          totalPlayers: allAfter.length,
          byTeam,
        });
      } catch (err: any) {
        console.error("Add players error:", err);
        return res.status(500).json({ message: "Failed to add players" });
      }
    }
  );

  // ---- ADMIN: DELETE INDIVIDUAL PLAYER ----
  app.delete(
    "/api/admin/players/:playerId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        await storage.deletePlayer(req.params.playerId);
        return res.json({ message: "Player deleted" });
      } catch (err: any) {
        console.error("Delete player error:", err);
        return res.status(500).json({ message: "Failed to delete player" });
      }
    }
  );

  // ---- ADMIN: REFRESH PLAYING XI ----
  app.post(
    "/api/admin/matches/:id/refresh-playing-xi",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (!match.externalId) return res.status(400).json({ message: "No external match ID" });

        const { fetchPlayingXIFromScorecard, fetchPlayingXIFromMatchInfo } = await import("./cricket-api");
        let playingIds = await fetchPlayingXIFromScorecard(match.externalId);
        let source = "scorecard";
        if (playingIds.length === 0) {
          playingIds = await fetchPlayingXIFromMatchInfo(match.externalId);
          source = "match_info";
        }
        if (playingIds.length === 0) {
          return res.json({ message: "No Playing XI data available yet - match may not have started", count: 0 });
        }

        await storage.markPlayingXI(matchId, playingIds);

        const recalcAfterXI = (globalThis as any).__recalculateTeamTotals;
        if (recalcAfterXI) await recalcAfterXI(matchId, `${match.team1Short} vs ${match.team2Short}`);

        return res.json({ message: `Playing XI updated: ${playingIds.length} players marked, team points recalculated`, count: playingIds.length, source });
      } catch (err: any) {
        console.error("Refresh Playing XI error:", err);
        return res.status(500).json({ message: "Failed to refresh Playing XI" });
      }
    }
  );

  // ---- ADMIN: MANUAL PLAYING XI ENTRY ----
  app.post(
    "/api/admin/matches/:id/set-playing-xi",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const { playerIds } = req.body;
        if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
          return res.status(400).json({ message: "playerIds array required" });
        }

        if (playerIds.length < 11 || playerIds.length > 22) {
          return res.status(400).json({ message: "Expected 11-22 player IDs (Playing XI for both teams)" });
        }

        // Per-team validation: each team must contribute exactly 11 players
        const allMatchPlayers = await storage.getPlayersForMatch(matchId);
        const playerIdSet = new Set(playerIds as string[]);
        const teamCounts: Record<string, number> = {};
        for (const p of allMatchPlayers) {
          if (playerIdSet.has(p.id) && p.teamShort) {
            teamCounts[p.teamShort] = (teamCounts[p.teamShort] || 0) + 1;
          }
        }
        const teams = Object.keys(teamCounts);
        for (const team of teams) {
          if (teamCounts[team] !== 11) {
            return res.status(400).json({
              message: `${team} must have exactly 11 XI players (got ${teamCounts[team]})`,
            });
          }
        }
        if (teams.length !== 2) {
          return res.status(400).json({
            message: `XI must include players from exactly 2 teams (got ${teams.length})`,
          });
        }

        const updated = await storage.markPlayingXIByIds(matchId, playerIds);
        await storage.updateMatch(matchId, { playingXIManual: true });

        const recalcAfterManualXI = (globalThis as any).__recalculateTeamTotals;
        if (recalcAfterManualXI) await recalcAfterManualXI(matchId, `${match.team1Short} vs ${match.team2Short}`);

        try {
          const { notifyXIAndImpactUpdated } = await import('./notifications');
          const notifyMatch = await storage.getMatch(req.params.id);
          if (notifyMatch) {
            await notifyXIAndImpactUpdated(notifyMatch.team1Short, notifyMatch.team2Short);
          }
        } catch (notifyErr) {
          console.error('[FCM] XI notification failed silently:', notifyErr);
        }

        return res.json({
          message: `Playing XI manually set: ${updated} players marked, team points recalculated`,
          count: updated,
          source: "admin_manual",
        });
      } catch (err: any) {
        console.error("Manual Playing XI error:", err);
        return res.status(500).json({ message: "Failed to set Playing XI" });
      }
    }
  );

  app.post(
    "/api/admin/matches/:id/repair-teams",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const matchPlayers = await storage.getPlayersForMatch(matchId);
        if (matchPlayers.length === 0) {
          return res.json({ message: "No players found for this match", repaired: 0 });
        }

        const playerById = new Map(matchPlayers.map(p => [p.id, p]));
        const playerByExtId = new Map(matchPlayers.filter(p => p.externalId).map(p => [p.externalId!, p]));

        const allTeams = await storage.getAllTeamsForMatch(matchId);
        let repaired = 0;

        for (const team of allTeams) {
          const teamPlayerIds = team.playerIds as string[];
          let hasOrphans = false;
          for (const pid of teamPlayerIds) {
            if (!playerById.has(pid)) {
              hasOrphans = true;
              break;
            }
          }
          if (!hasOrphans) continue;

          const newPlayerIds: string[] = [];
          let newCaptainId = team.captainId;
          let newViceCaptainId = team.viceCaptainId;
          const usedPlayerIds = new Set<string>();

          for (const pid of teamPlayerIds) {
            if (playerById.has(pid)) {
              newPlayerIds.push(pid);
              usedPlayerIds.add(pid);
            } else {
              const byExt = playerByExtId.get(pid);
              if (byExt && !usedPlayerIds.has(byExt.id)) {
                newPlayerIds.push(byExt.id);
                usedPlayerIds.add(byExt.id);
                if (pid === team.captainId) newCaptainId = byExt.id;
                if (pid === team.viceCaptainId) newViceCaptainId = byExt.id;
              }
            }
          }

          if (newPlayerIds.length === teamPlayerIds.length) {
            await db.update(userTeams)
              .set({
                playerIds: newPlayerIds,
                captainId: newCaptainId,
                viceCaptainId: newViceCaptainId,
              })
              .where(eq(userTeams.id, team.id));
            repaired++;
          }
        }

        return res.json({
          message: `Repaired ${repaired} teams out of ${allTeams.length}`,
          repaired,
          total: allTeams.length,
        });
      } catch (err: any) {
        console.error("Repair teams error:", err);
        return res.status(500).json({ message: "Failed to repair teams" });
      }
    }
  );

  // ---- ADMIN: PURGE MATCH POINTS ----
  app.post(
    "/api/admin/matches/:id/purge-points",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const matchPlayers = await storage.getPlayersForMatch(matchId);
        let playersReset = 0;
        for (const p of matchPlayers) {
          if (p.points !== 0) {
            await storage.updatePlayer(p.id, { points: 0 });
            playersReset++;
          }
        }

        const allTeams = await storage.getAllTeamsForMatch(matchId);
        let teamsReset = 0;
        for (const t of allTeams) {
          if ((t.totalPoints || 0) !== 0) {
            await storage.updateUserTeamPoints(t.id, 0);
            teamsReset++;
          }
        }

        console.log(`[Admin] Purged points for ${match.team1Short} vs ${match.team2Short}: ${playersReset} players, ${teamsReset} teams zeroed`);
        return res.json({
          message: `Purged: ${playersReset} players and ${teamsReset} teams reset to 0`,
          playersReset,
          teamsReset,
        });
      } catch (err: any) {
        console.error("Purge points error:", err);
        return res.status(500).json({ message: "Failed to purge points" });
      }
    }
  );

  // ---- ADMIN: GET LAST PLAYING XI FOR A TEAM ----
  app.get(
    "/api/admin/teams/:teamShort/last-playing-xi",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const teamShort = req.params.teamShort;
        const excludeMatchId = req.query.excludeMatch as string | undefined;
        const allMatches = await storage.getAllMatches();
        const relevantMatches = allMatches
          .filter(m => (m.team1Short === teamShort || m.team2Short === teamShort) &&
                       (m.status === 'completed' || m.status === 'live') &&
                       m.id !== excludeMatchId)
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

        if (relevantMatches.length === 0) {
          return res.json({ found: false, message: "No previous match found", playerNames: [] });
        }

        const prevMatch = relevantMatches[0];
        const prevPlayers = await storage.getPlayersForMatch(prevMatch.id);
        const xiPlayers = prevPlayers.filter(p => p.isPlayingXI && p.teamShort === teamShort);
        const playerNames = xiPlayers.map(p => p.name);
        const impactPlayerRaw = prevPlayers.find(p => p.isImpactPlayer && !p.isPlayingXI && p.teamShort === teamShort);
        const impactPlayerName = impactPlayerRaw?.name ?? null;

        return res.json({
          found: true,
          matchId: prevMatch.id,
          matchLabel: `${prevMatch.team1Short} vs ${prevMatch.team2Short}`,
          playerNames,
          count: playerNames.length,
          impactPlayerName,
        });
      } catch (err: any) {
        console.error("Last playing XI error:", err);
        return res.status(500).json({ message: "Failed to fetch last playing XI" });
      }
    }
  );

  // ---- ADMIN: MAP PLAYER MANUALLY ----
  app.post(
    "/api/admin/matches/:matchId/map-player",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { matchId } = req.params;
        const { dbPlayerId, newName, newExternalId, newApiName } = req.body;
        if (!dbPlayerId) return res.status(400).json({ message: "dbPlayerId required" });

        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const player = await storage.getPlayersForMatch(matchId);
        const target = player.find(p => p.id === dbPlayerId);
        if (!target) return res.status(404).json({ message: "Player not found in this match" });

        const updates: any = {};
        if (newName) updates.name = newName;
        if (newExternalId) updates.externalId = newExternalId;
        if (newApiName !== undefined) updates.apiName = newApiName || null;

        if (Object.keys(updates).length > 0) {
          await storage.updatePlayer(dbPlayerId, updates);
          console.log(`[Admin] Mapped player ${target.name} -> name=${newName || target.name}, extId=${newExternalId || target.externalId}`);
        }

        return res.json({
          message: `Player updated: ${target.name} -> ${newName || target.name}`,
          updated: updates,
        });
      } catch (err: any) {
        console.error("Map player error:", err);
        return res.status(500).json({ message: "Failed to map player" });
      }
    }
  );

  app.get(
    "/api/admin/matches/:matchId/player-mapping",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { matchId } = req.params;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const dbPlayers = await storage.getPlayersForMatch(matchId);

        let scorecardNames: string[] = [];
        if (match.externalId) {
          try {
            const { fetchMatchScorecard } = await import("./cricket-api");
            const result = await fetchMatchScorecard(match.externalId);
            scorecardNames = Array.from(result.namePointsMap.keys());
          } catch (e) {}
        }

        return res.json({
          dbPlayers: dbPlayers.map(p => ({
            id: p.id,
            name: p.name,
            apiName: p.apiName,
            externalId: p.externalId,
            points: p.points,
            role: p.role,
            team: p.team,
            teamShort: p.teamShort,
            isPlayingXI: p.isPlayingXI,
          })),
          scorecardNames,
        });
      } catch (err: any) {
        console.error("Player mapping error:", err);
        return res.status(500).json({ message: "Failed to get player mapping" });
      }
    }
  );

  // ---- ADMIN: MARK MATCH AS COMPLETED ----
  app.post(
    "/api/admin/matches/:id/mark-completed",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const matchLabel = `${(match as any).team1Short} vs ${(match as any).team2Short}`;
        if (match.status !== "completed") {
          await storage.updateMatch(matchId, { status: "completed" });
          console.log(`[Admin] Match ${matchLabel} manually marked as completed`);
        }
        const existingReward = await storage.getRewardForMatch(matchId);
        if (existingReward) {
          return res.json({ message: `${matchLabel} already completed, reward already distributed to winner` });
        }
        try {
          await distributeMatchReward(matchId);
          console.log(`[Admin] Reward distribution triggered for ${matchLabel}`);
        } catch (rewardErr) {
          console.error(`[Admin] Reward distribution failed for match ${matchId}:`, rewardErr);
        }
        return res.json({ message: `${matchLabel} marked as completed, reward distribution triggered` });
      } catch (err: any) {
        console.error("Mark completed error:", err);
        return res.status(500).json({ message: "Failed to mark match as completed" });
      }
    }
  );

  // ---- DEBUG: RAW CRICBUZZ SCARD (Admin only) ----
  app.get(
    "/api/debug/cricbuzz-raw",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { default: cricbuzzFetchRaw } = await import("./cricket-api").then(m => ({
          default: async (path: string) => {
            const url = `https://cricbuzz-cricket.p.rapidapi.com${path}`;
            const resp = await fetch(url, {
              headers: {
                "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com",
                "x-rapidapi-key": process.env.RAPIDAPI_KEY || "",
              },
            });
            return resp.json();
          }
        }));
        const matchId = req.query.matchId || "149618";
        const [scard, leanback] = await Promise.all([
          cricbuzzFetchRaw(`/mcenter/v1/${matchId}/scard`),
          cricbuzzFetchRaw(`/mcenter/v1/${matchId}/leanback`),
        ]);
        const innings = (scard.scorecard || []).map((inn: any) => ({
          inningsId: inn.inningsId,
          batCount: (inn.batsman || []).length,
          bowlCount: (inn.bowling || []).length,
          firstBowler: (inn.bowling || [])[0] || null,
          firstBatter: (inn.batsman || [])[0] || null,
        }));
        return res.json({ matchId, innings, leanbackKeys: Object.keys(leanback.miniscore || {}), rawScard: scard, rawLeanback: leanback });
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }
  );

  // ---- DEBUG: FORCE SYNC (Admin only) ----
  app.post(
    "/api/debug/force-sync",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      const matchId = req.body?.matchId as string | undefined;
      try {
        console.log(`[Force Sync] Admin triggered manual sync${matchId ? ` for match ${matchId}` : ' for all live matches'}`);

        if (matchId) {
          const match = await storage.getMatch(matchId);
          if (!match) {
            return res.status(404).json({ message: "Match not found" });
          }

          if (match.status === "upcoming" || match.status === "delayed") {
            const { fetchMatchSquad, fetchSeriesSquad } = await import("./cricket-api");
            let squad = await fetchMatchSquad(match.externalId!);
            console.log(`[Force Sync] Match squad API returned ${squad.length} players for ${match.team1Short} vs ${match.team2Short}`);

            if (squad.length === 0 && match.seriesId) {
              console.log(`[Force Sync] Match squad empty, trying tournament/series squad for series ${match.seriesId}...`);
              const seriesPlayers = await fetchSeriesSquad(match.seriesId);
              const team1 = match.team1.toLowerCase();
              const team2 = match.team2.toLowerCase();
              const t1Short = match.team1Short.toLowerCase();
              const t2Short = match.team2Short.toLowerCase();
              squad = seriesPlayers.filter((p) => {
                const pTeam = p.team.toLowerCase();
                const pShort = p.teamShort.toLowerCase();
                return pTeam === team1 || pTeam === team2 ||
                  pTeam.includes(team1) || team1.includes(pTeam) ||
                  pTeam.includes(team2) || team2.includes(pTeam) ||
                  pShort === t1Short || pShort === t2Short;
              });
              console.log(`[Force Sync] Tournament squad: filtered ${squad.length} players for ${match.team1} vs ${match.team2} from ${seriesPlayers.length} total`);
            }

            if (squad.length > 0) {
              const playersToCreate = squad.map((p) => ({
                matchId,
                externalId: p.externalId,
                name: p.name,
                team: p.team,
                teamShort: p.teamShort,
                role: p.role,
                credits: p.credits,
              }));
              await storage.upsertPlayersForMatch(matchId, playersToCreate);
              const matchPlayers = await storage.getPlayersForMatch(matchId);
              return res.json({
                message: `Squad synced: ${matchPlayers.length} players loaded for ${match.team1Short} vs ${match.team2Short}`,
                match: {
                  id: match.id,
                  teams: `${match.team1Short} vs ${match.team2Short}`,
                  status: match.status,
                },
                totalPlayers: matchPlayers.length,
                teamsCount: 0,
              });
            } else {
              return res.json({
                message: `No squad data found for ${match.team1Short} vs ${match.team2Short}. The API may not have squads for this match yet.`,
                totalPlayers: 0,
              });
            }
          }
        }

        const heartbeat = (globalThis as any).__matchHeartbeat;
        if (!heartbeat) {
          return res.status(500).json({ message: "Heartbeat not initialized" });
        }
        await heartbeat(matchId);
        
        if (matchId) {
          const match = await storage.getMatch(matchId);
          const matchPlayers = await storage.getPlayersForMatch(matchId);
          const teams = await storage.getAllTeamsForMatch(matchId);
          return res.json({
            message: "Force sync completed",
            match: match ? {
              id: match.id,
              teams: `${match.team1Short} vs ${match.team2Short}`,
              status: match.status,
              scoreString: (match as any).scoreString || "",
              lastSyncAt: (match as any).lastSyncAt,
            } : null,
            playersWithPoints: matchPlayers.filter(p => p.points > 0).length,
            totalPlayers: matchPlayers.length,
            teamsCount: teams.length,
          });
        }
        
        return res.json({ message: "Force sync completed for all live matches" });
      } catch (err: any) {
        console.error("Force sync error:", err);
        return res.status(500).json({ message: "Force sync failed: " + err.message });
      }
    }
  );

  // ---- DEBUG: MATCH STATUS (Admin only) ----
  app.get(
    "/api/debug/match-status",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const allMatches = await storage.getAllMatches();
        const now = Date.now();
        const THIRTY_SIX_HOURS = 36 * 60 * 60 * 1000;
        const filteredMatches = allMatches.filter(m => {
          if (m.status !== 'completed') return true;
          const startMs = new Date(m.startTime).getTime();
          return (now - startMs) <= THIRTY_SIX_HOURS;
        });
        // Single query for all player counts — avoids N+1 DB calls
        const playerCountRows = await db
          .select({ matchId: playersTable.matchId, cnt: sql<number>`count(*)::int` })
          .from(playersTable)
          .groupBy(playersTable.matchId);
        const playerCountMap = new Map<string, number>();
        for (const row of playerCountRows) {
          if (row.matchId) playerCountMap.set(row.matchId, row.cnt);
        }

        const matchStatuses = filteredMatches.map(m => {
          const startMs = new Date(m.startTime).getTime();
          return {
            id: m.id,
            teams: `${m.team1Short} vs ${m.team2Short}`,
            status: m.status,
            scoreString: (m as any).scoreString || "",
            lastSyncAt: (m as any).lastSyncAt,
            startTime: m.startTime,
            hasExternalId: !!m.externalId,
            isLocked: now >= startMs,
            minutesUntilStart: Math.round((startMs - now) / 60000),
            playerCount: playerCountMap.get(m.id) ?? 0,
            impactFeaturesEnabled: m.impactFeaturesEnabled,
          };
        });
        return res.json({ matches: matchStatuses, serverTime: new Date().toISOString() });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // ---- ADMIN: API CALL TRACKING ----
  app.get(
    "/api/admin/api-calls",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { getInMemoryApiCallCount } = await import("./cricket-api");
        const dbCount = await storage.getApiCallCount();
        const inMemory = getInMemoryApiCallCount();
        return res.json({
          today: dbCount.count || inMemory,
          date: dbCount.date,
          lastCalledAt: dbCount.lastCalledAt,
          dailyLimit: 2000,
          tier1Key: !!process.env.CRICKET_API_KEY,
          tier2Key: !!process.env.CRICAPI_KEY_TIER2,
        });
      } catch (err: any) {
        console.error("API call tracking error:", err);
        return res.status(500).json({ message: "Failed to get API call data" });
      }
    }
  );

  // ---- REWARDS: AUTO-DISTRIBUTE ON MATCH COMPLETION ----
  async function distributeMatchReward(matchId: string) {
    try {
      const match = await storage.getMatch(matchId);
      const matchLabel = match ? `${(match as any).team1Short} vs ${(match as any).team2Short}` : matchId;
      console.log(`[Rewards] Starting distribution for ${matchLabel}...`);

      const existingMatchReward = await storage.getRewardForMatch(matchId);
      if (existingMatchReward) {
        console.log(`[Rewards] ${matchLabel}: Reward already distributed for this match (to userId ${existingMatchReward.claimedByUserId}), skipping — idempotent`);
        return;
      }

      const allTeams = await storage.getAllTeamsForMatch(matchId);
      if (allTeams.length === 0) {
        console.log(`[Rewards] No teams found for ${matchLabel}, skipping`);
        return;
      }
      console.log(`[Rewards] ${matchLabel}: ${allTeams.length} teams submitted`);

      const sorted = [...allTeams].sort((a, b) => {
        if ((b.totalPoints || 0) !== (a.totalPoints || 0)) {
          return (b.totalPoints || 0) - (a.totalPoints || 0);
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      const winner = sorted[0];
      if (!winner || (winner.totalPoints || 0) === 0) {
        console.log(`[Rewards] No valid winner for ${matchLabel} (top team points: ${winner?.totalPoints || 0})`);
        return;
      }
      console.log(`[Rewards] ${matchLabel}: Rank 1 = userId ${winner.userId} with ${winner.totalPoints} pts (team: ${winner.teamName})`);

      const reward = await storage.getRandomAvailableReward();
      if (!reward) {
        console.log(`[Rewards] ⚠ Vault empty, no reward distributed for match ${matchLabel} — add coupons via Admin Panel`);
        return;
      }

      await storage.claimReward(reward.id, winner.userId, matchId);
      console.log(`[Rewards] ✓ ${matchLabel}: "${reward.title}" (${reward.brand}) → userId ${winner.userId}`);
    } catch (err) {
      console.error(`[Rewards] ✗ Distribution FAILED for match ${matchId}:`, err);
    }
  }

  (globalThis as any).__distributeMatchReward = distributeMatchReward;

  // ---- ONE-TIME: Retroactive coupon distribution (runs on startup, idempotent) ----
  (async () => {
    try {
      const assignments = [
        {
          matchId: "3cc4d1b3-2959-43c5-9d7c-09f2ed4d0997",
          label: "ENG vs SL",
          rewardId: "5bb13e61-6a04-4229-8ed5-5425f6b8e451",
          rewardBrand: "Zomato",
        },
        {
          matchId: "56467706-bbab-44ff-a4e9-6b369b2470c9",
          label: "IND vs RSA",
          rewardId: "1e89dd29-3c92-48dd-82a6-0df4167ef083",
          rewardBrand: "Domino's",
        },
      ];

      for (const a of assignments) {
        const existing = await storage.getRewardForMatch(a.matchId);
        if (existing) {
          console.log(`[Retroactive] ${a.label}: Already distributed, skipping`);
          continue;
        }

        const allTeams = await storage.getAllTeamsForMatch(a.matchId);
        if (allTeams.length === 0) {
          console.log(`[Retroactive] ${a.label}: No teams found, skipping`);
          continue;
        }

        const sorted = [...allTeams].sort((x, y) => {
          if ((y.totalPoints || 0) !== (x.totalPoints || 0))
            return (y.totalPoints || 0) - (x.totalPoints || 0);
          return new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime();
        });

        const winner = sorted[0];
        await storage.claimReward(a.rewardId, winner.userId, a.matchId);
        console.log(`[Retroactive] ✓ ${a.label}: ${a.rewardBrand} → userId ${winner.userId} (${winner.totalPoints} pts)`);
      }
    } catch (err) {
      console.error("[Retroactive] One-time distribution failed:", err);
    }
  })();

  // ---- ADMIN: REWARDS VAULT ----
  app.get(
    "/api/admin/rewards",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const allRewards = await storage.getAllRewards();
        const available = allRewards.filter(r => !r.isClaimed);
        const claimed = allRewards.filter(r => r.isClaimed);

        const claimedWithInfo = [];
        for (const r of claimed) {
          let username = "Unknown";
          let matchLabel = "";
          if (r.claimedByUserId) {
            const user = await storage.getUser(r.claimedByUserId);
            if (user) username = user.username;
          }
          if (r.claimedMatchId) {
            const match = await storage.getMatch(r.claimedMatchId);
            if (match) matchLabel = `${match.team1Short} vs ${match.team2Short}`;
          }
          claimedWithInfo.push({ ...r, claimedByUsername: username, matchLabel });
        }

        return res.json({ available, claimed: claimedWithInfo });
      } catch (err: any) {
        console.error("Admin rewards error:", err);
        return res.status(500).json({ message: "Failed to fetch rewards" });
      }
    }
  );

  app.post(
    "/api/admin/rewards",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { brand, title, code, terms } = req.body;
        if (!brand || !title || !code) {
          return res.status(400).json({ message: "Brand, title, and code are required" });
        }
        const reward = await storage.createReward({ brand, title, code, terms: terms || "" });
        return res.json({ reward });
      } catch (err: any) {
        console.error("Create reward error:", err);
        return res.status(500).json({ message: "Failed to create reward" });
      }
    }
  );

  app.delete(
    "/api/admin/rewards/:id",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        await storage.deleteReward(req.params.id);
        return res.json({ message: "Reward deleted" });
      } catch (err: any) {
        console.error("Delete reward error:", err);
        return res.status(500).json({ message: "Failed to delete reward" });
      }
    }
  );

  // ---- USER: GET REWARD FOR A MATCH ----
  app.get(
    "/api/rewards/match/:matchId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.session.userId!;
        const reward = await storage.getRewardForUserMatch(userId, req.params.matchId);
        return res.json({ reward: reward || null });
      } catch (err: any) {
        console.error("Get match reward error:", err);
        return res.status(500).json({ message: "Failed to fetch reward" });
      }
    }
  );

  // ---- USER: GET ALL MY REWARDS ----
  app.get(
    "/api/rewards/my",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.session.userId!;
        const myRewards = await storage.getUserRewards(userId);

        const withMatchInfo = [];
        for (const r of myRewards) {
          let matchLabel = "";
          if (r.claimedMatchId) {
            const match = await storage.getMatch(r.claimedMatchId);
            if (match) matchLabel = `${match.team1Short} vs ${match.team2Short}`;
          }
          withMatchInfo.push({ ...r, matchLabel });
        }

        return res.json({ rewards: withMatchInfo });
      } catch (err: any) {
        console.error("My rewards error:", err);
        return res.status(500).json({ message: "Failed to fetch your rewards" });
      }
    }
  );

  // ---- ADMIN: CENTRALIZED TOURNAMENT POT PROCESSING ----
  app.post(
    "/api/tournament/process",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { matchId, tournamentName, stake, mode, penaltyUserIds, excludeUserIds } = req.body;
        if (!matchId || !tournamentName || !stake) {
          return res.status(400).json({ message: "matchId, tournamentName, and stake are required" });
        }
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (match.status !== "completed") {
          return res.status(400).json({ message: "Match must be COMPLETED before processing pot" });
        }
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        if (allTeams.length < 2) {
          return res.status(400).json({ message: `Not enough players. Found ${allTeams.length} team(s), need at least 2.` });
        }
        const entryStake = Number(stake) || 30;

        // Exclude users: entrants whose contribution is removed from the pot entirely
        const rawExcludeIds: string[] = Array.isArray(excludeUserIds) ? excludeUserIds : [];
        const contestUserIds = new Set(allTeams.map(t => t.userId));
        const validatedExcludeIds = rawExcludeIds.filter(uid => contestUserIds.has(uid));
        // effectiveTeams = all entrants minus excluded users — used for all ranking + pot maths
        const effectiveTeams = allTeams.filter(t => !validatedExcludeIds.includes(t.userId));

        // Penalty mode setup
        const potMode = mode === "entries_plus_penalty" ? "entries_plus_penalty" : "entries_only";
        const rawPenaltyIds: string[] = Array.isArray(penaltyUserIds) ? penaltyUserIds : [];

        // Penalty users must NOT already be active contest participants (prevent double-counting)
        const effectiveContestUserIds = new Set(effectiveTeams.map(t => t.userId));
        const validatedPenaltyIds = rawPenaltyIds.filter(uid => !effectiveContestUserIds.has(uid) && !validatedExcludeIds.includes(uid));

        const penaltyCount = potMode === "entries_plus_penalty" ? validatedPenaltyIds.length : 0;

        // Rank active contest participants by points (descending). Ties share the same rank.
        const uniquePointTiers = [...new Set(effectiveTeams.map(t => t.totalPoints || 0))].sort((a, b) => b - a);

        const rank1Points = uniquePointTiers[0] ?? 0; // Highest — winner(s)
        const rank2Points = uniquePointTiers[1] ?? null; // Second highest — neutral (±0)
        // Rank 3+ = everyone below rank2 — they each pay the stake

        const winningTeams = effectiveTeams.filter(t => (t.totalPoints || 0) === rank1Points);
        const neutralTeams = rank2Points !== null ? effectiveTeams.filter(t => (t.totalPoints || 0) === rank2Points) : [];
        const losingTeams = effectiveTeams.filter(t => (t.totalPoints || 0) < (rank2Points ?? rank1Points));

        // Total pot:
        //   Mode 1 (entries_only):         losers × stake
        //   Mode 2 (entries_plus_penalty): losers × stake + penaltyUsers × stake
        const losersContribution = losingTeams.length * entryStake;
        const penaltyContribution = penaltyCount * entryStake;
        const totalPot = losersContribution + penaltyContribution;
        const winnerPointsEach = totalPot > 0 && winningTeams.length > 0
          ? Math.round(totalPot / winningTeams.length)
          : 0;

        // If re-processing, delete previous ledger entries first (replace, not stack)
        if (match.potProcessed) {
          await storage.deleteLedgerEntriesForMatch(matchId);
        }

        const userMap = new Map<string, string>();
        for (const t of allTeams) {
          if (!userMap.has(t.userId)) {
            const u = await storage.getUser(t.userId);
            userMap.set(t.userId, u?.teamName || u?.username || "Unknown");
          }
        }
        // For penalty users, look them up too
        for (const uid of validatedPenaltyIds) {
          if (!userMap.has(uid)) {
            const u = await storage.getUser(uid);
            userMap.set(uid, u?.teamName || u?.username || "Unknown");
          }
        }

        // Rank 3+ contest participants lose their stake
        for (const t of losingTeams) {
          await storage.createLedgerEntry({
            userId: t.userId,
            userName: userMap.get(t.userId) || "Unknown",
            matchId,
            tournamentName,
            pointsChange: -entryStake,
          });
        }

        // Penalty users: deducted from pot only — they are NOT participants and NOT in leaderboard
        // Their deduction entry is recorded for auditability but flagged via negative pointsChange
        if (penaltyCount > 0) {
          for (const uid of validatedPenaltyIds) {
            await storage.createLedgerEntry({
              userId: uid,
              userName: userMap.get(uid) || "Unknown",
              matchId,
              tournamentName,
              pointsChange: -entryStake,
            });
          }
        }

        // Rank 1 winner(s) gain the full pot (split equally if tied)
        if (winnerPointsEach > 0) {
          for (const t of winningTeams) {
            await storage.createLedgerEntry({
              userId: t.userId,
              userName: userMap.get(t.userId) || "Unknown",
              matchId,
              tournamentName,
              pointsChange: winnerPointsEach,
            });
          }
        }

        // Rank 2 — no ledger entry, completely neutral
        await storage.updateMatch(matchId, {
          tournamentName,
          entryStake,
          potProcessed: true,
          potMode,
          potPenaltyUserIds: potMode === "entries_plus_penalty" ? validatedPenaltyIds : [],
        } as any);
        console.log(`[Tournament Pot] ${potMode} | ${match.team1Short} vs ${match.team2Short}: Rank1=${winningTeams.length} (+${winnerPointsEach}), Rank2=${neutralTeams.length} neutral, Rank3+=${losingTeams.length} (-${entryStake}), penalty=${penaltyCount} (-${entryStake} each), excluded=${validatedExcludeIds.length}, totalPot=${totalPot}`);
        return res.json({
          message: "Pot processed successfully",
          mode: potMode,
          winners: winningTeams.length,
          neutral: neutralTeams.length,
          losers: losingTeams.length,
          penaltyUsers: penaltyCount,
          excludedUsers: validatedExcludeIds.length,
          winnerPoints: winnerPointsEach,
          loserPoints: losingTeams.length > 0 ? -entryStake : 0,
          totalPot,
          totalTeams: allTeams.length,
          activeTeams: effectiveTeams.length,
        });
      } catch (err: any) {
        console.error("Process pot error:", err);
        return res.status(500).json({ message: "Failed to process tournament pot" });
      }
    }
  );

  // ---- ADMIN: RESET ENTIRE TOURNAMENT POT ----
  // Deletes ALL ledger entries for a tournament and marks every match in it as unprocessed.
  // Penalty user lists are also cleared. Admin can then re-process each match from scratch.
  app.post(
    "/api/tournament/reset",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { tournamentName } = req.body;
        if (!tournamentName || typeof tournamentName !== "string" || !tournamentName.trim()) {
          return res.status(400).json({ message: "tournamentName is required" });
        }
        const tName = tournamentName.trim();

        // 1. Wipe all ledger entries for this tournament
        await storage.deleteLedgerEntriesForTournament(tName);

        // 2. Find every match belonging to this tournament and reset pot state
        const tournamentMatches = await storage.getMatchesByTournamentName(tName);
        let resetCount = 0;
        for (const m of tournamentMatches) {
          if (m.potProcessed || (m as any).potPenaltyUserIds?.length) {
            await storage.updateMatch(m.id, {
              potProcessed: false,
              potPenaltyUserIds: [] as any,
            } as any);
            resetCount++;
          }
        }

        console.log(`[Tournament Reset] '${tName}': cleared ${resetCount} match(es), wiped all ledger entries`);
        return res.json({
          message: `Tournament pot reset successfully`,
          tournamentName: tName,
          matchesReset: resetCount,
          ledgerEntriesDeleted: true,
        });
      } catch (err: any) {
        console.error("Tournament reset error:", err);
        return res.status(500).json({ message: "Failed to reset tournament pot" });
      }
    }
  );

  // ---- ADMIN: GET COMPLETED MATCHES FOR POT MANAGEMENT (unprocessed + re-processable) ----
  app.get(
    "/api/admin/matches/unprocessed",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const allMatches = await storage.getAllMatches();
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        // Include ALL completed matches in window (both unprocessed and already-processed for re-processing)
        const completed = allMatches.filter(m =>
          m.status === "completed" &&
          new Date(m.startTime) >= tenDaysAgo
        );
        const withParticipation = [];
        for (const m of completed) {
          const teams = await storage.getAllTeamsForMatch(m.id);
          if (teams.length > 0) {
            withParticipation.push({
              id: m.id,
              team1Short: m.team1Short,
              team2Short: m.team2Short,
              startTime: m.startTime,
              teamCount: teams.length,
              potProcessed: m.potProcessed,
              potMode: (m as any).potMode || "entries_only",
              entrantUserIds: [...new Set(teams.map(t => t.userId))],
            });
          }
        }
        return res.json({ matches: withParticipation });
      } catch (err: any) {
        console.error("Unprocessed matches error:", err);
        return res.status(500).json({ message: "Failed to fetch unprocessed matches" });
      }
    }
  );

  // ---- ADMIN: GET ALL USERS (for penalty user selection) ----
  app.get(
    "/api/admin/users",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const allUsers = await storage.getAllUsers();
        return res.json({
          users: allUsers.map(u => ({
            id: u.id,
            username: u.username,
            teamName: u.teamName,
          })),
        });
      } catch (err: any) {
        console.error("Admin users error:", err);
        return res.status(500).json({ message: "Failed to fetch users" });
      }
    }
  );

  // ---- PUBLIC: TOURNAMENT NAMES ----
  app.get(
    "/api/tournament/names",
    isAuthenticated,
    async (_req: Request, res: Response) => {
      try {
        const names = await storage.getDistinctTournamentNames();
        return res.json({ names });
      } catch (err: any) {
        console.error("Tournament names error:", err);
        return res.status(500).json({ message: "Failed to fetch tournament names" });
      }
    }
  );

  // ---- PUBLIC: TOURNAMENT STANDINGS ----
  app.get(
    "/api/tournament/standings",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const name = req.query.name as string;
        if (!name) return res.status(400).json({ message: "Tournament name required" });
        const standings = await storage.getTournamentStandings(name);
        return res.json({ standings });
      } catch (err: any) {
        console.error("Tournament standings error:", err);
        return res.status(500).json({ message: "Failed to fetch tournament standings" });
      }
    }
  );

  app.post(
    "/api/admin/fix-player-ids",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const oldPlayerMapping = req.body.oldPlayerMapping as Record<string, string> | undefined;
        if (!oldPlayerMapping || Object.keys(oldPlayerMapping).length === 0) {
          return res.status(400).json({ message: "Provide oldPlayerMapping: { oldId: playerName }" });
        }

        const allTeams = await db.select().from(userTeams);
        const allPlayers = await db.select().from(playersTable);

        const playerIdToName: Record<string, string> = {};
        for (const p of allPlayers) {
          playerIdToName[p.id] = p.name;
        }

        const playersByMatchAndName: Record<string, Record<string, string>> = {};
        for (const p of allPlayers) {
          if (!playersByMatchAndName[p.matchId]) playersByMatchAndName[p.matchId] = {};
          playersByMatchAndName[p.matchId][p.name.toLowerCase().trim()] = p.id;
        }

        let updatedCount = 0;
        let skippedCount = 0;
        const issues: string[] = [];

        for (const team of allTeams) {
          const currentIds = team.playerIds as string[];
          const allIdsValid = currentIds.every(pid => playerIdToName[pid]);
          if (allIdsValid) {
            skippedCount++;
            continue;
          }

          const matchPlayerNames = playersByMatchAndName[team.matchId] || {};
          const newPlayerIds: string[] = [];
          let newCaptainId = team.captainId;
          let newViceCaptainId = team.viceCaptainId;
          let allMapped = true;

          for (const oldId of currentIds) {
            if (playerIdToName[oldId]) {
              newPlayerIds.push(oldId);
              continue;
            }

            const oldName = oldPlayerMapping[oldId];
            if (!oldName) {
              allMapped = false;
              issues.push(`Team ${team.name}: No name mapping for old ID ${oldId}`);
              newPlayerIds.push(oldId);
              continue;
            }

            const newId = matchPlayerNames[oldName.toLowerCase().trim()];
            if (newId) {
              newPlayerIds.push(newId);
              if (team.captainId === oldId) newCaptainId = newId;
              if (team.viceCaptainId === oldId) newViceCaptainId = newId;
            } else {
              allMapped = false;
              issues.push(`Team ${team.name}: Player "${oldName}" not found in match ${team.matchId.substring(0, 8)}`);
              newPlayerIds.push(oldId);
            }
          }

          if (allMapped && newPlayerIds.length === currentIds.length) {
            await db.update(userTeams)
              .set({
                playerIds: newPlayerIds,
                captainId: newCaptainId,
                viceCaptainId: newViceCaptainId,
              })
              .where(eq(userTeams.id, team.id));
            updatedCount++;
          }
        }

        return res.json({
          message: `Migration complete`,
          totalTeams: allTeams.length,
          updated: updatedCount,
          skipped: skippedCount,
          issueCount: issues.length,
          issues: issues.slice(0, 50),
        });
      } catch (err: any) {
        console.error("Fix player IDs error:", err);
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/reset-password",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      const { phone, newPassword } = req.body;
      if (!phone || !newPassword) return res.status(400).json({ message: "phone and newPassword required" });
      try {
        await db.update(users).set({ password: newPassword }).where(eq(users.phone, phone));
        return res.json({ message: "Password reset", phone });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/verify-all-users",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const result = await db.update(users).set({ isVerified: true }).where(eq(users.isVerified, false));
        return res.json({ message: "All users verified" });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get(
    "/api/admin/pending-users",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const pending = await db.select({
          id: users.id,
          username: users.username,
          phone: users.phone,
          email: users.email,
          joinedAt: users.joinedAt,
        }).from(users).where(eq(users.isVerified, false));
        return res.json({ users: pending });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/approve-user",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: "userId required" });
        await db.update(users).set({ isVerified: true }).where(eq(users.id, userId));
        return res.json({ message: "User approved" });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/reject-user",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: "userId required" });
        await db.delete(userTeams).where(eq(userTeams.userId, userId));
        await db.delete(users).where(eq(users.id, userId));
        return res.json({ message: "User rejected and deleted" });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get(
    "/api/admin/users",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const allUsers = await db.select({
          id: users.id,
          username: users.username,
          phone: users.phone,
          email: users.email,
          teamName: users.teamName,
          isVerified: users.isVerified,
          isAdmin: users.isAdmin,
          password: users.password,
        }).from(users);
        return res.json({ users: allUsers });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // ---- ADMIN: USER ID LOOKUP ----
  app.get(
    "/api/admin/user-lookup",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const username = (req.query.username as string || "").toLowerCase().trim();
        if (!username) return res.status(400).json({ message: "Provide ?username=xxx" });
        const allUsers = await db.select({ id: users.id, username: users.username, teamName: users.teamName })
          .from(users)
          .where(sql`LOWER(${users.username}) = ${username} OR LOWER(${users.teamName}) = ${username}`);
        return res.json({ users: allUsers });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/cleanup-test-users",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const realUserIds = req.body.keepUserIds as string[];
        if (!realUserIds || realUserIds.length === 0) {
          return res.status(400).json({ message: "Provide keepUserIds array" });
        }
        const allUsersResult = await db.select({ id: users.id }).from(users);
        const toDelete = allUsersResult.filter(u => !realUserIds.includes(u.id)).map(u => u.id);
        let deleted = 0;
        for (const uid of toDelete) {
          await db.delete(userTeams).where(eq(userTeams.userId, uid));
          await db.delete(users).where(eq(users.id, uid));
          deleted++;
        }
        return res.json({ message: `Deleted ${deleted} test users`, kept: realUserIds.length });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // ======== IMPACT FEATURES: USER ENDPOINTS ========

  app.get(
    "/api/weekly-usage",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const usage = await storage.getOrCreateWeeklyUsage(req.session.userId!);
        const weekStart = storage.getISTWeekStart();
        const weekEnd = storage.getISTWeekEnd(weekStart);
        return res.json({
          weekStart,
          weekEnd,
          multiTeamUsageCount: usage.multiTeamUsageCount,
          multiTeamRemaining: Math.max(0, 3 - usage.multiTeamUsageCount),
          invisibleModeUsageCount: usage.invisibleModeUsageCount,
          canUseInvisibleMode: storage.canUseInvisibleMode(usage),
          canUseMultiTeam: storage.canUseMultiTeam(usage),
        });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get(
    "/api/matches/:id/player-statuses",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const statuses = await storage.getMatchPlayerStatuses(req.params.id);
        return res.json({ statuses });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // ======== IMPACT FEATURES: ADMIN ENDPOINTS ========

  app.post(
    "/api/admin/matches/:id/toggle-impact",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const { enabled } = req.body;
        if (typeof enabled !== "boolean") {
          return res.status(400).json({ message: "enabled (boolean) required" });
        }
        await storage.setImpactFeaturesEnabled(matchId, enabled);
        await storage.createAuditLog({
          adminUserId: req.session.userId!,
          actionType: "toggle_impact_features",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ enabled }),
        });
        return res.json({ message: `Impact features ${enabled ? "enabled" : "disabled"}` });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/matches/:id/player-status",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const { playerId, playerIds, adminStatus, officialImpactSubUsed } = req.body;

        const validStatuses = ["playing_xi", "impact_sub", "not_active"];
        if (adminStatus && !validStatuses.includes(adminStatus)) {
          return res.status(400).json({ message: `adminStatus must be one of: ${validStatuses.join(", ")}` });
        }

        if (playerIds && Array.isArray(playerIds)) {
          await storage.bulkSetAdminStatus(matchId, playerIds, adminStatus);
          if (adminStatus) {
            for (const pid of playerIds) {
              await storage.updatePlayer(pid, {
                isPlayingXI: adminStatus === "playing_xi",
                isImpactPlayer: adminStatus === "impact_sub",
              });
            }
          }
          await storage.createAuditLog({
            adminUserId: req.session.userId!,
            actionType: "bulk_set_player_status",
            entityType: "player",
            matchId,
            metadata: JSON.stringify({ playerIds, adminStatus }),
          });
          return res.json({ message: `Updated ${playerIds.length} players to ${adminStatus}` });
        }

        if (!playerId) {
          return res.status(400).json({ message: "playerId or playerIds required" });
        }

        // Enforce max 5 impact_sub per team
        if (adminStatus === "impact_sub") {
          const allPlayers = await storage.getPlayersForMatch(matchId);
          const targetPlayer = allPlayers.find((p) => p.id === playerId);
          if (targetPlayer) {
            const allStatuses = await storage.getMatchPlayerStatuses(matchId);
            const teamPlayerIds = new Set(
              allPlayers.filter((p) => p.teamShort === targetPlayer.teamShort).map((p) => p.id)
            );
            const teamImpactCount = allStatuses.filter(
              (s) => s.adminStatus === "impact_sub" && teamPlayerIds.has(s.playerId) && s.playerId !== playerId
            ).length;
            if (teamImpactCount >= 6) {
              return res.status(400).json({
                message: `${targetPlayer.teamShort} already has 5 impact players. Remove one before adding another.`,
              });
            }
          }
        }

        // Enforce mutual exclusivity: if setting playing_xi, ensure not already impact_sub in DB
        // (frontend prevents this but belt-and-suspenders)

        const data: any = { matchId, playerId, sourceType: "admin" };
        if (adminStatus) data.adminStatus = adminStatus;
        if (typeof officialImpactSubUsed === "boolean") data.officialImpactSubUsed = officialImpactSubUsed;

        const status = await storage.upsertMatchPlayerStatus(data);

        // When officialImpactSubUsed is toggled ON, ensure isImpactPlayer=true
        // on the player record so recalculateTeamTotals impact guard passes
        if (officialImpactSubUsed === true) {
          await storage.updatePlayer(playerId, { isImpactPlayer: true });
          // Trigger immediate recalculation so users see updated points right away
          try {
            const recalc = (globalThis as any).__recalculateTeamTotals;
            if (recalc) await recalc(matchId, 'impact sub activated');
          } catch (e) {
            console.error('[Impact] Recalc after toggle failed:', e);
          }
        }

        if (adminStatus) {
          await storage.updatePlayer(playerId, {
            isPlayingXI: adminStatus === "playing_xi",
            isImpactPlayer: adminStatus === "impact_sub",
          });
        }

        await storage.createAuditLog({
          adminUserId: req.session.userId!,
          actionType: officialImpactSubUsed !== undefined ? "set_impact_sub" : "set_player_status",
          entityType: "player",
          entityId: playerId,
          matchId,
          metadata: JSON.stringify({ adminStatus, officialImpactSubUsed }),
        });
        return res.json({ status });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/matches/:id/void",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const { isVoid } = req.body;
        if (typeof isVoid !== "boolean") {
          return res.status(400).json({ message: "isVoid (boolean) required" });
        }
        await storage.setMatchVoid(matchId, isVoid);
        if (isVoid) {
          const allTeams = await storage.getAllTeamsForMatch(matchId);
          for (const team of allTeams) {
            await storage.updateUserTeamPoints(team.id, 0);
          }
        }
        await storage.createAuditLog({
          adminUserId: req.session.userId!,
          actionType: isVoid ? "void_match" : "unvoid_match",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ isVoid }),
        });
        return res.json({ message: isVoid ? "Match voided, all points zeroed" : "Match un-voided" });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/matches/:id/admin-unlock",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const { unlock } = req.body;
        if (typeof unlock !== "boolean") {
          return res.status(400).json({ message: "unlock (boolean) required" });
        }
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        // TEMP: firstScorecardAt 6-minute guard bypassed for force-unlock — revert after use

        console.log(`[Admin] Match ${match.id} ${unlock ? 'unlocked' : 'locked'} by admin at ${new Date().toISOString()}`);
        await storage.updateMatch(matchId, {
          adminUnlockOverride: unlock,
          unlockedAt: unlock ? new Date() : null,
        } as any);
        await storage.createAuditLog({
          adminUserId: req.session.userId!,
          actionType: unlock ? "admin_unlock_match" : "admin_lock_match",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ unlock }),
        });
        return res.json({ message: unlock ? "Match entry window unlocked" : "Match entry window locked" });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/matches/:id/revised-start-time",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const { revisedStartTime } = req.body;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (revisedStartTime !== null && revisedStartTime !== undefined) {
          const eligibility = checkUnlockEligibility(match as any);
          if (!eligibility.allowed) {
            return res.status(409).json({ message: eligibility.reason });
          }
          const parsed = new Date(revisedStartTime);
          if (isNaN(parsed.getTime())) {
            return res.status(400).json({ message: "Invalid date format" });
          }
          await storage.updateMatch(matchId, { revisedStartTime: parsed } as any);
          await storage.createAuditLog({
            adminUserId: req.session.userId!,
            actionType: "set_revised_start_time",
            entityType: "match",
            entityId: matchId,
            matchId,
            metadata: JSON.stringify({ revisedStartTime: parsed.toISOString() }),
          });
          return res.json({ message: `Revised start time set to ${parsed.toISOString()}` });
        } else {
          await storage.updateMatch(matchId, { revisedStartTime: null } as any);
          await storage.createAuditLog({
            adminUserId: req.session.userId!,
            actionType: "clear_revised_start_time",
            entityType: "match",
            entityId: matchId,
            matchId,
            metadata: JSON.stringify({ cleared: true }),
          });
          return res.json({ message: "Revised start time cleared" });
        }
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/matches/:id/set-winner",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const { winner } = req.body;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (winner && winner !== match.team1Short && winner !== match.team2Short) {
          return res.status(400).json({ message: "Winner must be team1Short or team2Short" });
        }
        await storage.setOfficialWinner(matchId, winner || null);
        // When a winner is set the match is definitively over — mark it completed so:
        //   1. The frontend stops showing it as LIVE
        //   2. Tournament Pot Management can see it as an unprocessed completed match
        // Clearing the winner (winner=null) reverts to "live" so admin can re-settle if needed.
        if (winner) {
          await storage.updateMatch(matchId, { status: "completed" } as any);
        } else if (match.status === "completed") {
          await storage.updateMatch(matchId, { status: "live" } as any);
        }
        await storage.createAuditLog({
          adminUserId: req.session.userId!,
          actionType: "set_winner",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ winner }),
        });
        return res.json({ message: `Official winner set to ${winner || "none"}` });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/matches/:id/apply-winning-bonus",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (!match.officialWinner) {
          return res.status(400).json({ message: "Set the official winner first before applying the winning bonus" });
        }

        const WINNING_BONUS = 4;
        // Add +4 to all Playing XI players from the winning team
        const updated = await db
          .update(playersTable)
          .set({ points: sql`${playersTable.points} + ${WINNING_BONUS}` })
          .where(
            and(
              eq(playersTable.matchId, matchId),
              eq(playersTable.teamShort, match.officialWinner),
              eq(playersTable.isPlayingXI, true)
            )
          )
          .returning({ id: playersTable.id, name: playersTable.name });

        // Recalculate team totals
        const recalcFn = (globalThis as any).__recalculateTeamTotals;
        if (recalcFn) {
          await recalcFn(matchId, `${match.team1Short} vs ${match.team2Short}`);
        }

        await storage.createAuditLog({
          adminUserId: req.session.userId!,
          actionType: "apply_winning_bonus",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ winner: match.officialWinner, playersUpdated: updated.length, bonusPerPlayer: WINNING_BONUS }),
        });

        return res.json({
          message: `+${WINNING_BONUS} winning bonus applied to ${updated.length} players (${match.officialWinner} Playing XI)`,
          playersUpdated: updated.length,
          players: updated.map(p => p.name),
        });
      } catch (err: any) {
        console.error("Apply winning bonus error:", err);
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/matches/:id/recalculate",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const matchLabel = `${match.team1Short} vs ${match.team2Short}`;
        const recalcFn = (globalThis as any).__recalculateTeamTotals;
        if (recalcFn) {
          await recalcFn(matchId, matchLabel);
        } else {
          return res.status(500).json({ message: "Recalculation engine not initialized" });
        }

        const allTeams = await storage.getAllTeamsForMatch(matchId);
        if (match.officialWinner) {
          for (const team of allTeams) {
            const prediction = await storage.getUserPredictionForMatch(team.userId, matchId);
            const predPts = (prediction && prediction.predictedWinner === match.officialWinner) ? 50 : 0;
            await db.update(userTeams).set({ predictionPoints: predPts }).where(eq(userTeams.id, team.id));
          }
        }

        await storage.createAuditLog({
          adminUserId: req.session.userId!,
          actionType: "recalculate",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ teamsUpdated: allTeams.length, impactEnabled: match.impactFeaturesEnabled, isVoid: match.isVoid }),
        });

        return res.json({ message: `Recalculated ${allTeams.length} teams`, updated: allTeams.length });
      } catch (err: any) {
        console.error("Recalc error:", err);
        return res.status(500).json({ message: "Recalculation failed" });
      }
    }
  );

  app.get("/api/admin/match-health", isAdmin, async (req: Request, res: Response) => {
    try {
      const allMatches = await storage.getAllMatches();
      const now = Date.now();
      const liveAndRecent = allMatches.filter(m => {
        const isIPL = (m.league || '').toLowerCase().includes('indian premier league') ||
                      (m.league || '').toLowerCase().includes('ipl');
        const isRelevant = m.status === "live" || m.status === "completed" ||
                           m.status === "delayed" || m.status === "upcoming";
        const withinWindow = new Date(m.startTime).getTime() >= now - 48 * 60 * 60 * 1000;
        return isIPL && isRelevant && withinWindow;
      }).slice(0, 10);

      const health = await Promise.all(liveAndRecent.map(async (m) => {
        const players = await storage.getPlayersForMatch(m.id);
        const teams = await storage.getAllTeamsForMatch(m.id);
        const xiPlayers = players.filter(p => p.isPlayingXI === true);
        const impactPlayers = players.filter(p => p.isImpactPlayer === true);
        const playersWithPoints = players.filter(p => (p.points || 0) > 0);
        const playersWithFullPoints = players.filter(p => (p.points || 0) > 4);

        let activeImpactName: string | null = null;
        for (const p of impactPlayers) {
          const status = await storage.getMatchPlayerStatus(m.id, p.id);
          if (status?.officialImpactSubUsed) {
            activeImpactName = p.name;
            break;
          }
        }

        return {
          matchId: m.id,
          label: `${m.team1Short} vs ${m.team2Short}`,
          status: m.status,
          startTime: m.startTime,
          lastSyncAt: (m as any).lastSyncAt || null,
          totalPlayers: players.length,
          xiSet: xiPlayers.length,
          impactCandidates: impactPlayers.length,
          activeImpactSub: activeImpactName,
          playersWithPoints: playersWithPoints.length,
          playersWithFullPoints: playersWithFullPoints.length,
          totalTeams: teams.length,
          impactEnabled: (m as any).impactFeaturesEnabled === true,
          scoreString: (m as any).scoreString || null,
        };
      }));

      return res.json({ health });
    } catch (err) {
      console.error("Match health error:", err);
      return res.status(500).json({ message: "Failed to fetch match health" });
    }
  });

  // Re-score: re-fetch scorecard + re-run player points + recalculate team totals (bypasses protection for ended matches)
  app.post(
    "/api/admin/matches/:id/rescore",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const matchLabel = `${match.team1Short} vs ${match.team2Short}`;
        const updateLiveScoreFn = (globalThis as any).__updateLiveScore;
        const updateFantasyPointsFn = (globalThis as any).__updateFantasyPoints;
        const recalcFn = (globalThis as any).__recalculateTeamTotals;

        if (!updateLiveScoreFn || !updateFantasyPointsFn || !recalcFn) {
          return res.status(500).json({ message: "Scoring engine not initialized" });
        }

        const { pointsMap, namePointsMap } = await updateLiveScoreFn(match);
        if (pointsMap.size === 0 && namePointsMap.size === 0) {
          return res.status(422).json({ message: "No scorecard data available for this match — cannot re-score" });
        }

        const updatedCount = await updateFantasyPointsFn(matchId, matchLabel, pointsMap, namePointsMap, true /* matchEnded=true, bypasses protection */);
        await recalcFn(matchId, matchLabel);

        await storage.createAuditLog({
          adminUserId: req.session.userId!,
          actionType: "rescore",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ playersUpdated: updatedCount }),
        });

        return res.json({ message: `Re-scored ${updatedCount} players and recalculated all teams`, playersUpdated: updatedCount });
      } catch (err: any) {
        console.error("Re-score error:", err);
        return res.status(500).json({ message: "Re-score failed: " + err.message });
      }
    }
  );

  app.get(
    "/api/admin/matches/:id/audit-log",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const logs = await storage.getAuditLogsForMatch(req.params.id);
        return res.json({ logs });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get(
    "/api/admin/audit-log",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const logs = await storage.getAllAuditLogs(limit);
        return res.json({ logs });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // ---- ADMIN: ABSORB DUPLICATE ----
  // Fixes "externalId drift" duplicates: copies the externalId + status from the duplicate
  // onto the original (this) match, then clears the duplicate's externalId so the
  // automatic status-refresh skips it. Safe to call multiple times.
  app.post(
    "/api/admin/matches/:id/absorb-duplicate",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const original = await storage.getMatch(matchId);
        if (!original) return res.status(404).json({ message: "Match not found" });

        const allMatches = await storage.getAllMatches();
        const origDay = new Date(original.startTime).toISOString().split('T')[0];

        // Find the duplicate: same teams (either order) on the same day, different DB id
        const duplicate = allMatches.find((m: any) => {
          if (m.id === matchId) return false;
          const mDay = new Date(m.startTime).toISOString().split('T')[0];
          if (mDay !== origDay) return false;
          return (
            (m.team1Short === (original as any).team1Short && m.team2Short === (original as any).team2Short) ||
            (m.team1Short === (original as any).team2Short && m.team2Short === (original as any).team1Short)
          );
        });

        if (!duplicate) {
          return res.status(404).json({ message: "No duplicate found for this match on the same day" });
        }

        // Copy externalId + status from duplicate → original
        const updates: Record<string, any> = {};
        if ((duplicate as any).externalId) updates.externalId = (duplicate as any).externalId;
        if ((duplicate as any).status && (duplicate as any).status !== (original as any).status) {
          updates.status = (duplicate as any).status;
        }
        if ((duplicate as any).statusNote) updates.statusNote = (duplicate as any).statusNote;

        await storage.updateMatch(matchId, updates as any);

        // Clear duplicate's externalId so refreshStaleMatchStatuses skips it
        await storage.updateMatch((duplicate as any).id, { externalId: null } as any);

        await storage.createAuditLog({
          adminUserId: req.session.userId!,
          actionType: "absorb_duplicate",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({
            duplicateMatchId: (duplicate as any).id,
            absorbedExternalId: (duplicate as any).externalId,
            absorbedStatus: (duplicate as any).status,
          }),
        });

        return res.json({
          message: `Fixed: externalId + status copied from duplicate. Duplicate match ID: ${(duplicate as any).id}`,
          duplicateMatchId: (duplicate as any).id,
          absorbedExternalId: (duplicate as any).externalId,
          absorbedStatus: (duplicate as any).status,
        });
      } catch (err: any) {
        console.error("Absorb duplicate error:", err);
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/matches/:id/lock-multi-team",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const allTeams = await storage.getAllTeamsForMatch(matchId);

        const userTeamCounts = new Map<string, number>();
        for (const t of allTeams) {
          userTeamCounts.set(t.userId, (userTeamCounts.get(t.userId) || 0) + 1);
        }

        let usagesIncremented = 0;
        for (const [userId, count] of userTeamCounts) {
          if (count > 1) {
            await storage.incrementMultiTeamUsage(userId);
            usagesIncremented++;
          }
        }

        await storage.createAuditLog({
          adminUserId: req.session.userId!,
          actionType: "lock_multi_team_usage",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ usersWithMultiTeams: usagesIncremented }),
        });

        return res.json({ message: `Locked multi-team usage for ${usagesIncremented} users` });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get(
    "/api/admin/players/export",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const allPlayers = await db
          .select({
            playerId: playersTable.id,
            playerName: playersTable.name,
            teamName: playersTable.team,
            teamShort: playersTable.teamShort,
            role: playersTable.role,
            credits: playersTable.credits,
            points: playersTable.points,
            selectedBy: playersTable.selectedBy,
            externalId: playersTable.externalId,
            isImpactPlayer: playersTable.isImpactPlayer,
            isPlayingXI: playersTable.isPlayingXI,
          })
          .from(playersTable)
          .orderBy(playersTable.team, playersTable.name);

        // Group by team for summary
        const playersByTeam = new Map<string, (typeof allPlayers)>();
        for (const player of allPlayers) {
          if (!playersByTeam.has(player.teamName)) {
            playersByTeam.set(player.teamName, []);
          }
          playersByTeam.get(player.teamName)!.push(player);
        }

        const summary = {
          totalPlayers: allPlayers.length,
          totalTeams: playersByTeam.size,
          teamBreakdown: Array.from(playersByTeam.entries()).map(([team, players]) => ({
            team,
            count: players.length,
          })),
          players: allPlayers,
        };

        return res.json(summary);
      } catch (err: any) {
        console.error("Player export error:", err);
        return res.status(500).json({ message: "Failed to export players" });
      }
    }
  );

  // ---- REPLACEMENT PLAYERS — seed into all current upcoming/live matches ----
  // These players were manually sourced (API feed missed them).
  // externalId = the canonical playerId used for image lookup (getPlayerImage).
  // Role mapping: Bowling Allrounder → AR, Bowler → BOWL.
  const REPLACEMENT_PLAYERS = [
    { externalId: '9f2db0cf-2b7a-4722-9134-211f612102b9', name: 'Dasun Shanaka',       team: 'Rajasthan Royals',      teamShort: 'RR',  role: 'AR',   credits: 8.5 },
    { externalId: 'fbde22e3-60f9-4f4c-b26a-fad73644cbee', name: 'Saurabh Dubey',        team: 'Kolkata Knight Riders', teamShort: 'KKR', role: 'BOWL', credits: 8.0 },
    { externalId: '50e38c9d-bf39-44b8-b5e6-0c9f36b8cbdf', name: 'Blessing Muzarabani',  team: 'Kolkata Knight Riders', teamShort: 'KKR', role: 'BOWL', credits: 8.0 },
    { externalId: '7cb23ef6-2cd5-4aeb-9047-a5054d220f98', name: 'David Payne',           team: 'Sunrisers Hyderabad',   teamShort: 'SRH', role: 'BOWL', credits: 8.0 },
    { externalId: '0284af4f-d4eb-4894-bacc-a468c1020951', name: 'Spencer Johnson',       team: 'Chennai Super Kings',   teamShort: 'CSK', role: 'BOWL', credits: 8.0 },
    { externalId: '80193c8f-687d-47c3-a7e9-b098a83c7812', name: 'Navdeep Saini',         team: 'Kolkata Knight Riders', teamShort: 'KKR', role: 'BOWL', credits: 8.0 },
    { externalId: '3df5944d-dcc5-41fd-aec1-060b4c513536', name: 'Kulwant Khejroliya',    team: 'Gujarat Titans',        teamShort: 'GT',  role: 'BOWL', credits: 8.0 },
  ] as const;

  async function seedReplacementPlayers(): Promise<void> {
    try {
      const allMatches = await storage.getAllMatches();
      const activeMatches = allMatches.filter((m: any) =>
        m.status === 'upcoming' || m.status === 'live'
      );

      for (const player of REPLACEMENT_PLAYERS) {
        const relevantMatches = activeMatches.filter((m: any) =>
          m.team1Short === player.teamShort || m.team2Short === player.teamShort
        );
        for (const match of relevantMatches) {
          await storage.upsertPlayersForMatch(match.id, [{
            matchId: match.id,
            externalId: player.externalId,
            name: player.name,
            team: player.team,
            teamShort: player.teamShort,
            role: player.role,
            credits: player.credits,
          }]);
        }
      }
      console.log(`[ReplacementPlayers] Seeded ${REPLACEMENT_PLAYERS.length} players into ${activeMatches.length} active matches`);
    } catch (err) {
      console.error('[ReplacementPlayers] Seed error:', err);
    }
  }

  // ---- ADMIN: Force-sync squad for a specific match from the cricket API ----
  app.post(
    '/api/admin/matches/:id/sync-squad',
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      const matchId = req.params.id;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: 'Match not found' });
      if (!match.externalId) return res.status(400).json({ message: 'Match has no externalId — cannot sync from API' });
      try {
        const { fetchMatchSquad, fetchSeriesSquad } = await import('./cricket-api');
        let squad = await fetchMatchSquad(match.externalId);
        let squadSource = 'match_squad';
        if (squad.length === 0 && match.seriesId) {
          const seriesPlayers = await fetchSeriesSquad(match.seriesId);
          const t1 = match.team1.toLowerCase();
          const t2 = match.team2.toLowerCase();
          squad = seriesPlayers.filter((p) => {
            const pt = p.team.toLowerCase();
            return pt === t1 || pt === t2 || pt.includes(t1) || t1.includes(pt) || pt.includes(t2) || t2.includes(pt);
          });
          squadSource = 'series_squad';
        }
        if (squad.length === 0) {
          return res.status(502).json({ message: `API returned 0 players for this match (tried ${squadSource})` });
        }
        await storage.upsertPlayersForMatch(matchId, squad.map((p) => ({
          matchId, externalId: p.externalId, name: p.name, team: p.team,
          teamShort: p.teamShort, role: p.role, credits: p.credits,
        })));
        const updated = await storage.getPlayersForMatch(matchId);
        return res.json({ message: `Synced ${updated.length} players for ${match.team1} vs ${match.team2} via ${squadSource}` });
      } catch (err: any) {
        console.error('[sync-squad] error:', err);
        return res.status(500).json({ message: 'Squad sync failed', error: err.message });
      }
    }
  );

  // ---- STARTUP: sync squads for all upcoming/live matches with < 15 players ----
  // Runs outside the 48h heartbeat window so freshly-added matches are populated immediately.
  async function syncMissingSquads(): Promise<void> {
    const SQUAD_MIN = 15;
    try {
      const allMatches = await storage.getAllMatches();
      const candidates = allMatches.filter((m: any) =>
        (m.status === 'upcoming' || m.status === 'live') && m.externalId
      );
      const { fetchMatchSquad, fetchSeriesSquad } = await import('./cricket-api');
      for (const match of candidates) {
        const existing = await storage.getPlayersForMatch(match.id);
        if (existing.length >= SQUAD_MIN) continue;
        try {
          let squad = await fetchMatchSquad(match.externalId!);
          let squadSource = 'match_squad';
          if (squad.length === 0 && match.seriesId) {
            const seriesPlayers = await fetchSeriesSquad(match.seriesId);
            const t1 = match.team1.toLowerCase();
            const t2 = match.team2.toLowerCase();
            squad = seriesPlayers.filter((p: any) => {
              const pt = p.team.toLowerCase();
              return pt === t1 || pt === t2 || pt.includes(t1) || t1.includes(pt) || pt.includes(t2) || t2.includes(pt);
            });
            squadSource = 'series_squad';
          }
          if (squad.length > 0) {
            await storage.upsertPlayersForMatch(match.id, squad.map((p: any) => ({
              matchId: match.id, externalId: p.externalId, name: p.name, team: p.team,
              teamShort: p.teamShort, role: p.role, credits: p.credits,
            })));
            console.log(`[SquadSync] ${match.team1Short} vs ${match.team2Short}: upserted ${squad.length} players via ${squadSource}`);
          } else {
            console.log(`[SquadSync] ${match.team1Short} vs ${match.team2Short}: API returned 0 players — will retry later`);
          }
        } catch (err) {
          console.error(`[SquadSync] Error for ${match.team1Short} vs ${match.team2Short}:`, err);
        }
      }
    } catch (err) {
      console.error('[SquadSync] Startup sync error:', err);
    }
  }

  // Auto-seed on startup (idempotent — upsert deduplicates by externalId or name+teamShort)
  seedReplacementPlayers();
  // NOTE: syncMissingSquads() is NOT called at startup — the current API subscription does not
  // include match_squad / series_squad endpoints ("Subscription invalid").  Squad data must be
  // added manually via POST /api/admin/matches/:id/players, or triggered via
  // POST /api/admin/matches/:id/sync-squad after a subscription upgrade.

  // Admin endpoint — call this after new matches are added to the schedule
  app.post(
    '/api/admin/seed-replacement-players',
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      await seedReplacementPlayers();
      return res.json({ message: 'Replacement players seeded into all active matches' });
    }
  );

  // ---- ADMIN: Award base +4 points to all XI players immediately ----
  app.post(
    '/api/admin/matches/:id/award-base-points',
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: 'Match not found' });
        const players = await storage.getPlayersForMatch(matchId);
        const xiPlayers = players.filter(p => p.isPlayingXI);
        if (xiPlayers.length === 0) return res.status(400).json({ message: 'No Playing XI set for this match. Set XI first.' });
        let updated = 0;
        for (const p of xiPlayers) {
          if (!p.points || p.points < 4) {
            await storage.updatePlayer(p.id, { points: 4 });
            updated++;
          }
        }
        const matchLabel = `${match.team1Short} vs ${match.team2Short}`;
        const recalcFn = (globalThis as any).__recalculateTeamTotals;
        if (recalcFn) await recalcFn(matchId, matchLabel);
        return res.json({ message: `Awarded +4 base points to ${updated} XI players`, xiCount: xiPlayers.length, updated });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // ---- ADMIN: Manual player points entry (by player name match) ----
  app.post(
    '/api/admin/matches/:id/manual-points',
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: 'Match not found' });
        // entries: [{ playerId?, name?, points: number }]
        const entries: { playerId?: string; name?: string; points: number }[] = req.body.entries || [];
        if (!entries.length) return res.status(400).json({ message: 'No entries provided' });
        const players = await storage.getPlayersForMatch(matchId);
        const results: { name: string; points: number; matched: boolean }[] = [];
        for (const entry of entries) {
          let player = entry.playerId ? players.find(p => p.id === entry.playerId) : null;
          if (!player && entry.name) {
            const nameLower = entry.name.toLowerCase().trim();
            player = players.find(p => p.name.toLowerCase().includes(nameLower) || nameLower.includes(p.name.toLowerCase().split(' ').pop()!));
          }
          if (player) {
            await storage.updatePlayer(player.id, { points: entry.points, isPlayingXI: true });
            results.push({ name: player.name, points: entry.points, matched: true });
          } else {
            results.push({ name: entry.name || entry.playerId || 'unknown', points: entry.points, matched: false });
          }
        }
        const matchLabel = `${match.team1Short} vs ${match.team2Short}`;
        const recalcFn = (globalThis as any).__recalculateTeamTotals;
        if (recalcFn) await recalcFn(matchId, matchLabel);
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        return res.json({
          message: `Manual points applied. ${results.filter(r => r.matched).length}/${entries.length} players matched.`,
          results,
          teamCount: allTeams.length,
        });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}
