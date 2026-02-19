const CRICKET_API_BASE = "https://api.cricapi.com/v1";

let tier1Blocked = false;
let tier1BlockedUntil = 0;

function getApiKeys(): { primary: string | undefined; fallback: string | undefined } {
  return {
    primary: process.env.CRICKET_API_KEY,
    fallback: process.env.CRICAPI_KEY_TIER2,
  };
}

function getActiveApiKey(): string | undefined {
  const keys = getApiKeys();
  if (keys.primary && (!tier1Blocked || Date.now() > tier1BlockedUntil)) {
    tier1Blocked = false;
    return keys.primary;
  }
  if (keys.fallback) {
    console.log("[CricAPI] Using Tier 2 fallback key");
    return keys.fallback;
  }
  return keys.primary;
}

function markTier1Blocked() {
  tier1Blocked = true;
  tier1BlockedUntil = Date.now() + 60 * 60 * 1000;
  console.log("[CricAPI] Tier 1 key quota hit — switching to Tier 2 for 1 hour");
}

async function cricApiFetch<T>(path: string, extraParams: string = ""): Promise<{ data: T | null; info?: any; usedTier: number }> {
  const keys = getApiKeys();
  const keyOrder: { key: string; tier: number }[] = [];

  if (keys.primary && (!tier1Blocked || Date.now() > tier1BlockedUntil)) {
    keyOrder.push({ key: keys.primary, tier: 1 });
  }
  if (keys.fallback) {
    keyOrder.push({ key: keys.fallback, tier: 2 });
  }
  if (keyOrder.length === 0 && keys.primary) {
    keyOrder.push({ key: keys.primary, tier: 1 });
  }

  for (const { key, tier } of keyOrder) {
    try {
      const sep = path.includes("?") ? "&" : "?";
      const url = `${CRICKET_API_BASE}/${path}${sep}apikey=${key}${extraParams ? "&" + extraParams : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[CricAPI T${tier}] HTTP ${res.status} for ${path}`);
        continue;
      }
      const json = await res.json() as any;

      if (json.status === "failure" || json.status === "error") {
        const msg = (json.reason || json.message || "").toLowerCase();
        if (msg.includes("limit") || msg.includes("quota") || msg.includes("blocked") || msg.includes("exceed")) {
          console.log(`[CricAPI T${tier}] Quota exceeded: ${json.reason || json.message}`);
          if (tier === 1) markTier1Blocked();
          continue;
        }
      }

      if (json.info) {
        console.log(`[CricAPI T${tier}] ${path.split("?")[0]}: hits ${json.info.hitsUsed || json.info.hitsToday}/${json.info.hitsLimit}`);
      }
      return { data: json.data ?? json, info: json.info, usedTier: tier };
    } catch (e: any) {
      console.error(`[CricAPI T${tier}] Fetch error for ${path}:`, e.message);
      continue;
    }
  }
  return { data: null, usedTier: 0 };
}

interface CricApiMatch {
  id: string;
  name: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  teamInfo?: Array<{
    name: string;
    shortname: string;
    img: string;
  }>;
  score?: Array<{
    r: number;
    w: number;
    o: number;
    inning: string;
  }>;
  series_id?: string;
  matchType?: string;
  matchStarted?: boolean;
  matchEnded?: boolean;
}

const DELAY_KEYWORDS = [
  'rain', 'delay', 'delayed', 'no result', 'abandoned', 'postponed',
  'wet outfield', 'weather', 'inspection', 'covers', 'drizzle',
  'toss yet', 'start delayed', 'play yet to', 'yet to begin',
];

function isMatchDelayed(apiStatusText: string): boolean {
  const lower = (apiStatusText || '').toLowerCase();
  return DELAY_KEYWORDS.some(kw => lower.includes(kw));
}

function determineMatchStatus(
  matchStarted: boolean | undefined,
  matchEnded: boolean | undefined,
  apiStatusText: string,
  hasScoreData: boolean
): { status: string; statusNote: string } {
  const statusNote = apiStatusText || '';

  if (matchEnded) {
    return { status: 'completed', statusNote };
  }

  if (matchStarted) {
    if (hasScoreData) {
      return { status: 'live', statusNote };
    }
    if (isMatchDelayed(apiStatusText)) {
      return { status: 'delayed', statusNote };
    }
    return { status: 'live', statusNote: statusNote || 'Toss completed' };
  }

  if (isMatchDelayed(apiStatusText)) {
    return { status: 'delayed', statusNote };
  }

  return { status: 'upcoming', statusNote };
}

interface CricApiResponse<T> {
  apikey: string;
  data: T;
  status: string;
  info: {
    hitsToday: number;
    hitsUsed: number;
    hitsLimit: number;
  };
}

const TEAM_COLORS: Record<string, string> = {
  IND: "#0077FF",
  PAK: "#009900",
  AUS: "#FFD700",
  ENG: "#CC0000",
  SA: "#006400",
  NZ: "#000000",
  WI: "#800000",
  SL: "#000080",
  BAN: "#006400",
  AFG: "#0066CC",
  NED: "#FF8000",
  CSK: "#FFFF3C",
  RCB: "#EC1C24",
  MI: "#004B8D",
  KKR: "#3A225D",
  SRH: "#F7A721",
  RR: "#EA1A85",
  DC: "#00008B",
  PBKS: "#DD1F2D",
  LSG: "#3FD5F3",
  GT: "#1B2133",
};

function getTeamColor(shortName: string): string {
  return TEAM_COLORS[shortName.toUpperCase()] || "#333333";
}

function getTeamShort(fullName: string): string {
  const mapping: Record<string, string> = {
    "Mumbai Indians": "MI",
    "Chennai Super Kings": "CSK",
    "Royal Challengers Bengaluru": "RCB",
    "Royal Challengers Bangalore": "RCB",
    "Kolkata Knight Riders": "KKR",
    "Delhi Capitals": "DC",
    "Rajasthan Royals": "RR",
    "Sunrisers Hyderabad": "SRH",
    "Punjab Kings": "PBKS",
    "Gujarat Titans": "GT",
    "Lucknow Super Giants": "LSG",
    India: "IND",
    Australia: "AUS",
    England: "ENG",
    Pakistan: "PAK",
    "South Africa": "SA",
    "New Zealand": "NZ",
    "West Indies": "WI",
    "Sri Lanka": "SL",
    Bangladesh: "BAN",
    Afghanistan: "AFG",
  };

  if (mapping[fullName]) return mapping[fullName];

  const words = fullName.split(" ");
  if (words.length === 1) return fullName.substring(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .substring(0, 4);
}

export async function fetchUpcomingMatches(): Promise<
  Array<{
    externalId: string;
    seriesId: string;
    team1: string;
    team1Short: string;
    team1Color: string;
    team2: string;
    team2Short: string;
    team2Color: string;
    venue: string;
    startTime: Date;
    status: string;
    statusNote: string;
    league: string;
  }>
> {
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    console.log("No CricAPI key available, skipping API fetch");
    return [];
  }

  try {
    const allApiMatches: CricApiMatch[] = [];
    const seenIds = new Set<string>();

    const endpoints = [
      `${CRICKET_API_BASE}/currentMatches?apikey=${apiKey}&offset=0`,
      `${CRICKET_API_BASE}/matches?apikey=${apiKey}&offset=0`,
      `${CRICKET_API_BASE}/matches?apikey=${apiKey}&offset=25`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.error("Cricket API error:", res.status, res.statusText, url);
          continue;
        }
        const json = (await res.json()) as CricApiResponse<CricApiMatch[]>;
        if (json.status === "success" && json.data) {
          const epName = url.includes('currentMatches') ? 'currentMatches' : `matches(offset=${url.includes('offset=25') ? '25' : '0'})`;
          console.log(
            `Cricket API: fetched ${json.data.length} from ${epName}, hits: ${json.info?.hitsUsed}/${json.info?.hitsLimit}`
          );
          for (const m of json.data) {
            if (!seenIds.has(m.id)) {
              seenIds.add(m.id);
              allApiMatches.push(m);
            }
          }
        } else if ((json as any).reason) {
          const reason = (json as any).reason || "";
          console.log(`Cricket API blocked: ${reason} - will retry later`);
          if (reason.includes("Blocked") || reason.toLowerCase().includes("limit")) {
            markTier1Blocked();
            break;
          }
        }
      } catch (e) {
        console.error("Cricket API endpoint error:", e);
      }
    }

    if (allApiMatches.length === 0) {
      console.log("No matches from any Cricket API endpoint");
      return [];
    }

    console.log(`Cricket API: ${allApiMatches.length} unique matches total`);

    return allApiMatches
      .filter((m) => m.teams && m.teams.length >= 2 && m.dateTimeGMT)
      .map((m) => {
        const team1 = m.teams[0];
        const team2 = m.teams[1];
        const team1Info = m.teamInfo?.find((t) => t.name === team1);
        const team2Info = m.teamInfo?.find((t) => t.name === team2);
        const team1Short = team1Info?.shortname || getTeamShort(team1);
        const team2Short = team2Info?.shortname || getTeamShort(team2);

        const hasScoreData = !!(m.score && m.score.length > 0 && m.score.some(s => s.r > 0 || s.w > 0 || s.o > 0));
        const { status, statusNote } = determineMatchStatus(
          m.matchStarted,
          m.matchEnded,
          m.status,
          hasScoreData
        );

        const nameParts = m.name?.split(",").map((s: string) => s.trim()) || [];
        let league = nameParts[nameParts.length - 1] || nameParts[0] || "";
        if (nameParts.length >= 3) {
          league = nameParts.slice(2).join(", ");
        } else if (nameParts.length === 2) {
          league = nameParts[1];
        }

        return {
          externalId: m.id,
          seriesId: m.series_id || "",
          team1,
          team1Short,
          team1Color: getTeamColor(team1Short),
          team2,
          team2Short,
          team2Color: getTeamColor(team2Short),
          venue: m.venue || "",
          startTime: new Date(m.dateTimeGMT),
          status,
          statusNote,
          league,
        };
      });
  } catch (err) {
    console.error("Cricket API fetch error:", err);
    return [];
  }
}

const TRACKED_SERIES: Array<{ id: string; name: string }> = [
  { id: "0cdf6736-ad9b-4e95-a647-5ee3a99c5510", name: "ICC Men's T20 World Cup 2026" },
];

export async function fetchSeriesMatches(
  seriesId: string,
  seriesName: string
): Promise<
  Array<{
    externalId: string;
    seriesId: string;
    team1: string;
    team1Short: string;
    team1Color: string;
    team2: string;
    team2Short: string;
    team2Color: string;
    venue: string;
    startTime: Date;
    status: string;
    statusNote: string;
    league: string;
  }>
> {
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];

  try {
    const url = `${CRICKET_API_BASE}/series_info?apikey=${apiKey}&id=${seriesId}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const json = (await res.json()) as CricApiResponse<{
      info: { name: string };
      matchList: Array<{
        id: string;
        name: string;
        venue: string;
        dateTimeGMT: string;
        teams: string[];
        teamInfo?: Array<{ name: string; shortname: string; img: string }>;
        matchStarted?: boolean;
        matchEnded?: boolean;
        status: string;
      }>;
    }>;

    if (json.status !== "success" || !json.data?.matchList) {
      const reason = ((json as any).reason || (json as any).message || "").toLowerCase();
      if (reason.includes("limit") || reason.includes("quota") || reason.includes("blocked")) {
        markTier1Blocked();
      }
      return [];
    }

    console.log(`Series Info API: fetched ${json.data.matchList.length} matches for ${seriesName}, hits: ${json.info?.hitsUsed}/${json.info?.hitsLimit}`);

    return json.data.matchList
      .filter((m) => m.teams && m.teams.length >= 2 && m.dateTimeGMT && !m.teams.includes("Tbc"))
      .map((m) => {
        const team1 = m.teams[0];
        const team2 = m.teams[1];
        const team1Info = m.teamInfo?.find((t) => t.name === team1);
        const team2Info = m.teamInfo?.find((t) => t.name === team2);
        const team1Short = team1Info?.shortname || getTeamShort(team1);
        const team2Short = team2Info?.shortname || getTeamShort(team2);

        const { status, statusNote } = determineMatchStatus(
          m.matchStarted,
          m.matchEnded,
          m.status,
          false
        );

        const nameParts = m.name?.split(",").map((s: string) => s.trim()) || [];
        let league = nameParts[nameParts.length - 1] || nameParts[0] || "";
        if (nameParts.length >= 3) {
          league = nameParts.slice(2).join(", ");
        } else if (nameParts.length === 2) {
          league = nameParts[1];
        }

        return {
          externalId: m.id,
          seriesId,
          team1,
          team1Short,
          team1Color: getTeamColor(team1Short),
          team2,
          team2Short,
          team2Color: getTeamColor(team2Short),
          venue: m.venue || "",
          startTime: new Date(m.dateTimeGMT),
          status,
          statusNote,
          league,
        };
      });
  } catch (err) {
    console.error("Series Info API error:", err);
    return [];
  }
}

async function upsertMatches(
  apiMatches: Array<{
    externalId: string;
    seriesId: string;
    team1: string;
    team1Short: string;
    team1Color: string;
    team2: string;
    team2Short: string;
    team2Color: string;
    venue: string;
    startTime: Date;
    status: string;
    statusNote: string;
    league: string;
  }>,
  existingMatches: any[]
): Promise<{ created: number; updated: number }> {
  const { storage } = await import("./storage");
  let created = 0;
  let updated = 0;

  for (const m of apiMatches) {
    const dup = existingMatches.find((e) => e.externalId === m.externalId);
    if (!dup) {
      await storage.createMatch({
        externalId: m.externalId,
        seriesId: m.seriesId,
        team1: m.team1,
        team1Short: m.team1Short,
        team1Color: m.team1Color,
        team2: m.team2,
        team2Short: m.team2Short,
        team2Color: m.team2Color,
        venue: m.venue,
        startTime: m.startTime,
        status: m.status,
        statusNote: m.statusNote,
        league: m.league,
        totalPrize: "0",
        entryFee: 0,
        spotsTotal: 100,
        spotsFilled: 0,
      });
      created++;
    } else {
      const updates: Record<string, any> = {};
      if (dup.status !== m.status) updates.status = m.status;
      if (m.statusNote && dup.statusNote !== m.statusNote) updates.statusNote = m.statusNote;
      if (new Date(dup.startTime).getTime() !== m.startTime.getTime()) updates.startTime = m.startTime;
      if (dup.league !== m.league) updates.league = m.league;
      if (m.seriesId && dup.seriesId !== m.seriesId) updates.seriesId = m.seriesId;
      if (m.venue && dup.venue !== m.venue) updates.venue = m.venue;
      if (Object.keys(updates).length > 0) {
        await storage.updateMatch(dup.id, updates);
        console.log(`Match ${m.team1} vs ${m.team2}: updated [${Object.keys(updates).join(', ')}]`);
        updated++;
      }
    }
  }

  return { created, updated };
}

const T20_WC_SERIES_ID = "0cdf6736-ad9b-4e95-a647-5ee3a99c5510";

export async function syncMatchesFromApi(retryCount = 0): Promise<void> {
  const { storage } = await import("./storage");
  
  console.log("Auto-syncing matches (ICC T20 WC only — 1 API call)...");
  try {
    const existing = await storage.getAllMatches();
    let totalCreated = 0;
    let totalUpdated = 0;

    for (const series of TRACKED_SERIES) {
      try {
        const seriesMatches = await fetchSeriesMatches(series.id, series.name);
        if (seriesMatches.length > 0) {
          const result = await upsertMatches(seriesMatches, existing);
          totalCreated += result.created;
          totalUpdated += result.updated;
          console.log(`${series.name}: ${result.created} new, ${result.updated} updated (${seriesMatches.length} matches total)`);
        } else if (retryCount < 2) {
          const delayMin = retryCount === 0 ? 5 : 15;
          console.log(`No T20 WC matches returned - will retry in ${delayMin} minute(s) (attempt ${retryCount + 1}/2)`);
          setTimeout(() => syncMatchesFromApi(retryCount + 1), delayMin * 60 * 1000);
          return;
        }
      } catch (err) {
        console.error(`Series sync error for ${series.name}:`, err);
      }
    }

    if (totalCreated === 0 && totalUpdated === 0) {
      console.log("T20 WC sync: no changes");
    }
  } catch (err) {
    console.error("Auto-sync failed:", err);
  }
}

export async function fetchMatchInfo(
  matchId: string
): Promise<CricApiMatch | null> {
  const apiKey = getActiveApiKey();
  if (!apiKey) return null;

  try {
    const url = `${CRICKET_API_BASE}/match_info?apikey=${apiKey}&id=${matchId}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = (await res.json()) as CricApiResponse<CricApiMatch>;
    if (json.status !== "success") return null;
    return json.data;
  } catch (err) {
    console.error("Cricket API match info error:", err);
    return null;
  }
}

export async function fetchPlayingXI(
  externalMatchId: string
): Promise<string[]> {
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];

  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const json = (await res.json()) as CricApiResponse<ScorecardData>;
    if (json.status !== "success" || !json.data?.scorecard) return [];

    const playerIds = new Set<string>();
    for (const inning of json.data.scorecard) {
      inning.batting?.forEach((b) => {
        if (b.batsman?.id) playerIds.add(b.batsman.id);
      });
      inning.bowling?.forEach((b) => {
        if (b.bowler?.id) playerIds.add(b.bowler.id);
      });
      inning.catching?.forEach((c) => {
        if (c.catcher?.id) playerIds.add(c.catcher.id);
      });
    }

    console.log(`Playing XI extraction: found ${playerIds.size} player IDs from scorecard for match ${externalMatchId}`);
    return Array.from(playerIds);
  } catch (err) {
    console.error("Playing XI fetch error:", err);
    return [];
  }
}

export async function refreshPlayingXIForLiveMatches(): Promise<void> {
  const { storage } = await import("./storage");

  const allMatches = await storage.getAllMatches();
  const liveMatches = allMatches.filter(
    (m) => (m.status === "live" || m.status === "delayed") && m.externalId
  );

  if (liveMatches.length === 0) return;

  for (const match of liveMatches) {
    try {
      if ((match as any).playingXIManual) {
        console.log(`Playing XI skipped (admin manual): ${match.team1} vs ${match.team2}`);
        continue;
      }

      const existingCount = await storage.getPlayingXICount(match.id);
      if (existingCount >= 22) continue;

      const playingIds = await fetchPlayingXI(match.externalId!);
      if (playingIds.length >= 2) {
        await storage.markPlayingXI(match.id, playingIds);
        console.log(`Playing XI updated for ${match.team1} vs ${match.team2}: ${playingIds.length} players marked`);
      }
    } catch (err) {
      console.error(`Playing XI refresh failed for match ${match.id}:`, err);
    }
  }
}

let lastStatusRefresh = 0;
const STATUS_REFRESH_INTERVAL = 5 * 60 * 1000;

export async function refreshStaleMatchStatuses(): Promise<void> {
  const now = Date.now();
  if (now - lastStatusRefresh < STATUS_REFRESH_INTERVAL) return;
  lastStatusRefresh = now;

  const { storage } = await import("./storage");
  const apiKey = getActiveApiKey();
  if (!apiKey) return;

  const allMatches = await storage.getAllMatches();
  const staleMatches = allMatches.filter((m) => {
    if (m.status === "completed") return false;
    const start = new Date(m.startTime).getTime();
    const elapsed = now - start;
    if (m.status === "live") return true;
    if (m.status === "delayed") return true;
    if (m.status === "upcoming" && elapsed > -30 * 60 * 1000) return true;
    return false;
  });

  if (staleMatches.length === 0) return;
  console.log(`Refreshing status for ${staleMatches.length} active/stale matches...`);

  for (const m of staleMatches) {
    if (!m.externalId) continue;
    try {
      const info = await fetchMatchInfo(m.externalId);
      if (!info) continue;

      const hasScoreData = !!(info.score && info.score.length > 0 && info.score.some(s => s.r > 0 || s.w > 0 || s.o > 0));
      const { status: newStatus, statusNote } = determineMatchStatus(
        info.matchStarted,
        info.matchEnded,
        info.status,
        hasScoreData
      );

      const updates: Record<string, any> = {};
      if (newStatus !== m.status) updates.status = newStatus;
      if (statusNote && statusNote !== m.statusNote) updates.statusNote = statusNote;

      if (Object.keys(updates).length > 0) {
        await storage.updateMatch(m.id, updates);
        console.log(`Status refresh: ${m.team1} vs ${m.team2}: ${m.status} -> ${newStatus} [${statusNote}]`);
      }

      if (newStatus === "live" || (info.matchStarted && !info.matchEnded)) {
        const xiCount = await storage.getPlayingXICount(m.id);
        if (xiCount < 22) {
          const playingIds = await fetchPlayingXI(m.externalId);
          if (playingIds.length >= 2) {
            await storage.markPlayingXI(m.id, playingIds);
            console.log(`Playing XI updated for ${m.team1} vs ${m.team2}: ${playingIds.length} players`);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to refresh status for match ${m.id}:`, err);
    }
  }
}

interface SquadPlayer {
  id: string;
  name: string;
  role: string;
}

interface SquadTeam {
  teamName: string;
  shortname: string;
  players: SquadPlayer[];
}

function mapCricApiRole(role: string): string {
  const r = (role || "").toLowerCase();
  if (r.includes("wk") || r.includes("keeper")) return "WK";
  if (r.includes("allrounder") || r.includes("all-rounder")) return "AR";
  if (r.includes("bowl")) return "BOWL";
  if (r.includes("bat")) return "BAT";
  return "BAT";
}

function assignCredits(role: string): number {
  switch (role) {
    case "WK": return 8.5;
    case "BAT": return 9;
    case "AR": return 9;
    case "BOWL": return 8.5;
    default: return 8;
  }
}

export async function fetchSeriesSquad(
  seriesId: string
): Promise<Array<{
  externalId: string;
  name: string;
  team: string;
  teamShort: string;
  role: string;
  credits: number;
}>> {
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];

  try {
    const url = `${CRICKET_API_BASE}/series_squad?apikey=${apiKey}&id=${seriesId}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Series Squad API error:", res.status);
      return [];
    }

    const json = (await res.json()) as CricApiResponse<SquadTeam[]>;
    if (json.status !== "success" || !json.data) {
      console.error("Series Squad API non-success:", json.status);
      return [];
    }

    console.log(`Series Squad API: fetched ${json.data.length} teams for series ${seriesId}`);

    const allPlayers: Array<{
      externalId: string;
      name: string;
      team: string;
      teamShort: string;
      role: string;
      credits: number;
    }> = [];

    for (const team of json.data) {
      if (!team.players) continue;
      for (const p of team.players) {
        const role = mapCricApiRole(p.role);
        allPlayers.push({
          externalId: p.id,
          name: p.name,
          team: team.teamName,
          teamShort: team.shortname || getTeamShort(team.teamName),
          role,
          credits: assignCredits(role),
        });
      }
    }

    return allPlayers;
  } catch (err) {
    console.error("Series Squad API error:", err);
    return [];
  }
}

export async function fetchPlayingXIFromMatchInfo(
  externalMatchId: string
): Promise<string[]> {
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];

  try {
    const url = `${CRICKET_API_BASE}/match_info?apikey=${apiKey}&id=${externalMatchId}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const json = await res.json() as any;
    if (json.status !== "success" || !json.data) return [];

    const playerIds: string[] = [];
    if (json.data.teamInfo) {
      for (const team of json.data.teamInfo) {
        if (team.playing11 && Array.isArray(team.playing11)) {
          for (const p of team.playing11) {
            if (p.id) playerIds.push(p.id);
          }
        }
      }
    }

    if (playerIds.length > 0) {
      console.log(`Playing XI from match_info: ${playerIds.length} players for ${externalMatchId}`);
    }
    return playerIds;
  } catch (err) {
    console.error("match_info Playing XI error:", err);
    return [];
  }
}

export async function fetchMatchSquad(
  externalMatchId: string
): Promise<Array<{
  externalId: string;
  name: string;
  team: string;
  teamShort: string;
  role: string;
  credits: number;
}>> {
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];

  try {
    const url = `${CRICKET_API_BASE}/match_squad?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Squad API error:", res.status);
      return [];
    }

    const json = (await res.json()) as CricApiResponse<SquadTeam[]>;
    if (json.status !== "success" || !json.data) {
      console.error("Squad API non-success:", json.status);
      return [];
    }

    console.log(`Squad API: fetched ${json.data.length} teams for match ${externalMatchId}`);

    const allPlayers: Array<{
      externalId: string;
      name: string;
      team: string;
      teamShort: string;
      role: string;
      credits: number;
    }> = [];

    for (const team of json.data) {
      if (!team.players) continue;
      for (const p of team.players) {
        const role = mapCricApiRole(p.role);
        allPlayers.push({
          externalId: p.id,
          name: p.name,
          team: team.teamName,
          teamShort: team.shortname || getTeamShort(team.teamName),
          role,
          credits: assignCredits(role),
        });
      }
    }

    return allPlayers;
  } catch (err) {
    console.error("Squad API error:", err);
    return [];
  }
}

interface ScorecardBatting {
  batsman: { id: string; name: string };
  r: number;
  b: number;
  "4s": number;
  "6s": number;
  sr: number;
  dismissal?: string;
}

interface ScorecardBowling {
  bowler: { id: string; name: string };
  o: number;
  m: number;
  r: number;
  w: number;
  eco: number;
}

interface ScorecardInning {
  inning: string;
  batting: ScorecardBatting[];
  bowling: ScorecardBowling[];
  catching?: Array<{ catcher: { id: string; name: string }; catches: number }>;
  extras?: number;
  extrasDetail?: { b?: number; lb?: number; w?: number; nb?: number; p?: number };
  totals?: { r: number; w: number; o: number };
}

interface ScorecardData {
  id: string;
  name: string;
  score: Array<{ r: number; w: number; o: number; inning: string }>;
  scorecard: ScorecardInning[];
}

function calculateFantasyPoints(
  playerId: string,
  scorecard: ScorecardInning[]
): number {
  let points = 0;
  let totalCatches = 0;

  for (const inning of scorecard) {
    const bat = inning.batting?.find((b) => b.batsman?.id === playerId);
    if (bat) {
      points += bat.r;
      points += bat["4s"];
      points += bat["6s"] * 2;
      if (bat.r >= 100) points += 16;
      if (bat.r >= 50) points += 8;
      if (bat.r >= 30) points += 4;
      if (bat.r === 0 && bat.b > 0) points -= 2;
      if (bat.b >= 10) {
        if (bat.sr > 170) points += 6;
        else if (bat.sr > 150) points += 4;
        else if (bat.sr >= 130) points += 2;
        else if (bat.sr >= 60 && bat.sr < 70) points -= 2;
        else if (bat.sr >= 50 && bat.sr < 60) points -= 4;
        else if (bat.sr < 50) points -= 6;
      }
    }

    const bowl = inning.bowling?.find((b) => b.bowler?.id === playerId);
    if (bowl) {
      points += bowl.w * 30;
      if (bowl.w >= 5) points += 16;
      if (bowl.w >= 4) points += 8;
      if (bowl.w >= 3) points += 4;
      if (bowl.m > 0) points += bowl.m * 12;
      const totalOvers = bowl.o;
      if (totalOvers >= 2) {
        if (bowl.eco < 5) points += 6;
        else if (bowl.eco >= 5 && bowl.eco < 6) points += 4;
        else if (bowl.eco >= 6 && bowl.eco <= 7) points += 2;
        else if (bowl.eco >= 10 && bowl.eco <= 11) points -= 2;
        else if (bowl.eco > 11 && bowl.eco <= 12) points -= 4;
        else if (bowl.eco > 12) points -= 6;
      }
      const battingEntries = inning.batting || [];
      for (const b of battingEntries) {
        const d = (b.dismissal || "").toLowerCase();
        if (d.startsWith("lbw") || d.startsWith("b ")) {
          if (bowl.bowler?.name && d.includes(bowl.bowler.name.toLowerCase())) {
            points += 8;
          }
        }
      }
    }

    const catcher = inning.catching?.find((c) => c.catcher?.id === playerId);
    if (catcher) {
      const catches = catcher.catches || 0;
      points += catches * 8;
      totalCatches += catches;
    }

    const battingEntries = inning.batting || [];
    for (const b of battingEntries) {
      const d = (b.dismissal || "").toLowerCase();
      if (d.includes("st ") && d.includes(playerId)) {
        points += 12;
      }
      if (d.includes("run out")) {
        if (d.includes(playerId)) {
          points += 12;
        }
      }
    }
  }

  if (totalCatches >= 3) points += 4;

  return points;
}

export async function fetchPlayingXIFromScorecard(
  externalMatchId: string
): Promise<string[]> {
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];

  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const json = (await res.json()) as CricApiResponse<ScorecardData>;
    if (json.status !== "success" || !json.data?.scorecard) return [];

    const playerIds = new Set<string>();
    for (const inning of json.data.scorecard) {
      inning.batting?.forEach((b) => { if (b.batsman?.id) playerIds.add(b.batsman.id); });
      inning.bowling?.forEach((b) => { if (b.bowler?.id) playerIds.add(b.bowler.id); });
      inning.catching?.forEach((c) => { if (c.catcher?.id) playerIds.add(c.catcher.id); });
    }

    if (playerIds.size > 0) {
      console.log(`Playing XI from scorecard: ${playerIds.size} players for ${externalMatchId}`);
    }
    return Array.from(playerIds);
  } catch (err) {
    console.error("Scorecard Playing XI error:", err);
    return [];
  }
}

export async function fetchMatchScorecard(
  externalMatchId: string
): Promise<{ pointsMap: Map<string, number>; namePointsMap: Map<string, number> }> {
  const apiKey = getActiveApiKey();
  const pointsMap = new Map<string, number>();
  const namePointsMap = new Map<string, number>();
  if (!apiKey) return { pointsMap, namePointsMap };

  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await fetch(url);
    if (!res.ok) return { pointsMap, namePointsMap };

    const json = (await res.json()) as CricApiResponse<ScorecardData>;
    if (json.status !== "success" || !json.data?.scorecard) return { pointsMap, namePointsMap };

    console.log(`Scorecard API: fetched ${json.data.scorecard.length} innings for match ${externalMatchId}`);

    const allPlayers = new Map<string, string>();
    for (const inning of json.data.scorecard) {
      inning.batting?.forEach((b) => { if (b.batsman?.id) allPlayers.set(b.batsman.id, b.batsman.name || ""); });
      inning.bowling?.forEach((b) => { if (b.bowler?.id) allPlayers.set(b.bowler.id, b.bowler.name || ""); });
      inning.catching?.forEach((c) => { if (c.catcher?.id) allPlayers.set(c.catcher.id, c.catcher.name || ""); });
    }

    for (const [pid, pname] of allPlayers) {
      const pts = calculateFantasyPoints(pid, json.data.scorecard);
      pointsMap.set(pid, pts);
      if (pname) {
        const normalizedName = pname.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
        namePointsMap.set(normalizedName, pts);
      }
    }

    return { pointsMap, namePointsMap };
  } catch (err) {
    console.error("Scorecard API error:", err);
    return { pointsMap, namePointsMap };
  }
}

export async function fetchLiveScorecard(externalMatchId: string): Promise<{
  score: Array<{ r: number; w: number; o: number; inning: string }>;
  innings: Array<{
    inning: string;
    batting: Array<{
      name: string;
      r: number;
      b: number;
      fours: number;
      sixes: number;
      sr: number;
      dismissal: string;
      fantasyPoints: number;
    }>;
    bowling: Array<{
      name: string;
      o: number;
      m: number;
      r: number;
      w: number;
      eco: number;
      fantasyPoints: number;
    }>;
  }>;
  status: string;
} | null> {
  const apiKey = getActiveApiKey();
  if (!apiKey) return null;

  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = (await res.json()) as CricApiResponse<ScorecardData>;
    if (json.status !== "success" || !json.data) return null;

    const scorecard = json.data.scorecard || [];
    const scoreArr = json.data.score || [];
    const innings = scorecard.map((inn, idx) => {
      const batterRuns = (inn.batting || []).reduce((sum, b) => sum + (b.r || 0), 0);
      const matchScore = scoreArr.find(s => s.inning === inn.inning) || scoreArr[idx];
      const totalFromApi = matchScore ? matchScore.r : batterRuns;
      const extrasTotal = totalFromApi - batterRuns;

      const rawExtras = (inn as any).extras;
      const apiExtrasTotal = rawExtras?.total ?? rawExtras?.r;
      const finalExtras = apiExtrasTotal != null ? apiExtrasTotal : (extrasTotal > 0 ? extrasTotal : 0);

      return {
        inning: inn.inning,
        extras: finalExtras,
        totals: matchScore ? { r: matchScore.r, w: matchScore.w, o: matchScore.o } : undefined,
        batting: (inn.batting || []).map((b) => ({
          name: b.batsman?.name || "",
          r: b.r,
          b: b.b,
          fours: b["4s"],
          sixes: b["6s"],
          sr: b.sr,
          dismissal: b.dismissal || "not out",
          fantasyPoints: b.batsman?.id ? calculateFantasyPoints(b.batsman.id, scorecard) : 0,
        })),
        bowling: (inn.bowling || []).map((b) => ({
          name: b.bowler?.name || "",
          o: b.o,
          m: b.m,
          r: b.r,
          w: b.w,
          eco: b.eco,
          fantasyPoints: b.bowler?.id ? calculateFantasyPoints(b.bowler.id, scorecard) : 0,
        })),
      };
    });

    return {
      score: scoreArr,
      innings,
      status: json.data.name || "",
    };
  } catch (err) {
    console.error("Live scorecard error:", err);
    return null;
  }
}
