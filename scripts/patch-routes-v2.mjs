import { readFileSync, writeFileSync } from 'fs';
let c = readFileSync('server/routes.ts', 'utf8');

// ── 1: Replace the entire module-level name-matching block ────────────────────
// From "type MatchConfidence" through closing "}" of matchPlayerToHistorical
const BIG_START = `type MatchConfidence = "high" | "medium" | "low" | "none";`;
const BIG_END   = `  return { stats: null, confidence: "none", resolvedVia: "collision-unresolved" };\n}\n\n\nexport async function registerRoutes`;

const bigStartIdx = c.indexOf(BIG_START);
const bigEndIdx   = c.indexOf(BIG_END, bigStartIdx) + BIG_END.length;

if (bigStartIdx === -1 || bigEndIdx === -1) {
  console.log('ERROR: big block markers not found', bigStartIdx, bigEndIdx);
  process.exit(1);
}
console.log('Big block:', bigStartIdx, '->', bigEndIdx, 'len:', bigEndIdx - bigStartIdx);

const NEW_BLOCK = `type MatchConfidence = "high" | "medium" | "low" | "none";
type MatchResult = {
  stats: HistoricalStats | null;
  confidence: MatchConfidence;
  resolvedVia: string;
};

// ── Canonicalization ──────────────────────────────────────────────────────────
function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\\./g, " ")
    .replace(/[^a-z\\s]/g, "")
    .replace(/\\s+/g, " ")
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
  const rows = await db.execute(sql\`
    SELECT db_name, cricsheet_name, team_short
    FROM player_name_mappings
    WHERE cricsheet_name != '' AND confidence != 'unresolved'
  \`);
  const map = new Map<string, string>();
  for (const row of rows.rows as any[]) {
    map.set(\`\${canonicalize(row.db_name)}|\${row.team_short}\`, row.cricsheet_name);
    map.set(canonicalize(row.db_name), row.cricsheet_name);
  }
  dbMappingsCache = map;
  console.log(\`[AI Mapping] Loaded \${rows.rows.length} mappings from DB\`);
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
    console.log("[AI Mapping] Starting auto-mapping...");

    const dbPlayersRows = await db.execute(sql\`
      SELECT DISTINCT p.name, p.team_short
      FROM players p
      INNER JOIN matches m ON p.match_id = m.id
      WHERE p.name IS NOT NULL
        AND (
          m.tournament_name ILIKE '%ipl%'
          OR m.league ILIKE '%indian premier league%'
          OR p.team_short IN ('RR','RCB','MI','CSK','KKR','SRH','DC','PBKS','GT','LSG')
        )
    \`);

    const cricsheetRows = await db.execute(sql\`
      SELECT DISTINCT player_name, team FROM player_historical_stats
    \`);

    const cricsheetByCanonicalTeam = new Map<string, string[]>();
    for (const row of cricsheetRows.rows as any[]) {
      const teamKey = canonicalize(row.team);
      if (!cricsheetByCanonicalTeam.has(teamKey)) cricsheetByCanonicalTeam.set(teamKey, []);
      cricsheetByCanonicalTeam.get(teamKey)!.push(row.player_name);
    }

    const allCricsheetPlayers: string[] = [];
    for (const players of cricsheetByCanonicalTeam.values()) allCricsheetPlayers.push(...players);

    let autoMapped = 0, alreadyMapped = 0, unresolved = 0;

    for (const dbRow of dbPlayersRows.rows as any[]) {
      const dbName: string = dbRow.name;
      const teamShort: string = dbRow.team_short;
      const canonicalDb = canonicalize(dbName);

      const existing = await db.execute(sql\`
        SELECT confidence FROM player_name_mappings
        WHERE db_name = \${dbName} AND team_short = \${teamShort}
      \`);
      if (existing.rows.length > 0 && (existing.rows[0] as any).confidence === 'manual') {
        alreadyMapped++;
        continue;
      }

      const cricsheetTeamNames = TEAM_SHORT_TO_CRICSHEET[teamShort] || [];
      let teamPlayers: string[] = [];
      for (const expectedTeam of cricsheetTeamNames) {
        for (const [cricTeam, players] of cricsheetByCanonicalTeam.entries()) {
          if (cricTeam.includes(expectedTeam) || expectedTeam.includes(cricTeam)) {
            teamPlayers = [...teamPlayers, ...players];
          }
        }
      }
      teamPlayers = [...new Set(teamPlayers)];

      const searchPool = teamPlayers.length > 0 ? teamPlayers : allCricsheetPlayers;

      let bestMatch: string | null = null;
      let bestConfidence = "unresolved";

      for (const cp of searchPool) {
        if (canonicalize(cp) === canonicalDb) { bestMatch = cp; bestConfidence = "high"; break; }
      }

      if (!bestMatch) {
        const dbSurname = extractSurname(dbName);
        const dbInit = extractInitial(dbName);
        const surnameMatches = searchPool.filter(cp => extractSurname(cp) === dbSurname);
        if (surnameMatches.length === 1) {
          bestMatch = surnameMatches[0];
          bestConfidence = extractInitial(surnameMatches[0]) === dbInit ? "high" : "medium";
        } else if (surnameMatches.length > 1) {
          const initMatches = surnameMatches.filter(cp => extractInitial(cp) === dbInit);
          if (initMatches.length === 1) { bestMatch = initMatches[0]; bestConfidence = "high"; }
        }
      }

      await db.execute(sql\`
        INSERT INTO player_name_mappings (db_name, cricsheet_name, team_short, confidence, source)
        VALUES (
          \${dbName},
          \${bestMatch ?? ''},
          \${teamShort},
          \${bestConfidence},
          'auto'
        )
        ON CONFLICT (db_name, team_short) DO UPDATE SET
          cricsheet_name = EXCLUDED.cricsheet_name,
          confidence = EXCLUDED.confidence,
          source = CASE WHEN player_name_mappings.source = 'admin' THEN 'admin' ELSE 'auto' END,
          updated_at = NOW()
        WHERE player_name_mappings.source != 'admin'
      \`);

      if (bestMatch) autoMapped++;
      else unresolved++;
    }

    dbMappingsCache = null;
    console.log(\`[AI Mapping] Done: \${autoMapped} mapped, \${alreadyMapped} manual kept, \${unresolved} unresolved\`);
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
    const teamKey = \`\${canonicalDb}|\${teamShort}\`;
    const mappingTarget = dbMappings.get(teamKey) || dbMappings.get(canonicalDb);
    if (mappingTarget && mappingTarget !== "") {
      const row = canonicalIndex.get(canonicalize(mappingTarget)) || cache.get(mappingTarget);
      if (row && row.matches_played > 0) {
        const confidence: MatchConfidence = row.matches_played >= 10 ? "high" : row.matches_played >= 5 ? "medium" : "low";
        console.log(\`[AI Match] "\${dbName}" → "\${row.player_name}" \${confidence.toUpperCase()} via DB-MAPPING (\${row.matches_played} matches)\`);
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
      console.log(\`[AI Match] "\${dbName}" → "\${row.player_name}" \${confidence.toUpperCase()} via ALIAS (\${row.matches_played} matches)\`);
      return { stats: row, confidence, resolvedVia: "alias" };
    }
  }

  // Step 2: Exact canonical match
  const exactMatch = canonicalIndex.get(canonicalDb);
  if (exactMatch && exactMatch.matches_played > 0) {
    const confidence: MatchConfidence = exactMatch.matches_played >= 10 ? "high" : exactMatch.matches_played >= 5 ? "medium" : "low";
    console.log(\`[AI Match] "\${dbName}" → "\${exactMatch.player_name}" \${confidence.toUpperCase()} via EXACT (\${exactMatch.matches_played} matches)\`);
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
    console.log(\`[AI Match] "\${dbName}" → NONE (no match found)\`);
    return { stats: null, confidence: "none", resolvedVia: "no-match" };
  }

  if (candidates.length === 1) {
    const row = candidates[0];
    const mp = row.matches_played;
    if (mp === 0) return { stats: null, confidence: "none", resolvedVia: "zero-matches" };
    const cricInit = extractInitial(row.player_name);
    if (dbInit === cricInit) {
      const confidence: MatchConfidence = mp >= 10 ? "high" : mp >= 5 ? "medium" : "low";
      console.log(\`[AI Match] "\${dbName}" → "\${row.player_name}" \${confidence.toUpperCase()} via SURNAME+INITIAL (\${mp} matches)\`);
      return { stats: row, confidence, resolvedVia: "surname-initial" };
    }
    if (!dbHasInitialOnly) {
      console.log(\`[AI Match] "\${dbName}" → "\${row.player_name}" MEDIUM via SURNAME-ONLY (\${mp} matches)\`);
      return { stats: row, confidence: "medium", resolvedVia: "surname-only" };
    }
    console.log(\`[AI Match] "\${dbName}" → NONE (initial conflict)\`);
    return { stats: null, confidence: "none", resolvedVia: "initial-conflict" };
  }

  const initMatches = candidates.filter(c => extractInitial(c.player_name) === dbInit);
  if (initMatches.length === 1) {
    const row = initMatches[0];
    const mp = row.matches_played;
    if (mp === 0) return { stats: null, confidence: "none", resolvedVia: "zero-matches" };
    const confidence: MatchConfidence = mp >= 10 ? "high" : mp >= 5 ? "medium" : "low";
    console.log(\`[AI Match] "\${dbName}" → "\${row.player_name}" \${confidence.toUpperCase()} via COLLISION-RESOLVED (\${mp} matches)\`);
    return { stats: row, confidence, resolvedVia: "collision-resolved" };
  }

  console.log(\`[AI Match] "\${dbName}" → NONE (collision unresolved — \${candidates.length} candidates)\`);
  return { stats: null, confidence: "none", resolvedVia: "collision-unresolved" };
}


export async function registerRoutes`;

c = c.slice(0, bigStartIdx) + NEW_BLOCK + c.slice(bigEndIdx);
console.log('Big block replaced. registerRoutes present:', c.includes('export async function registerRoutes(app: Express)'));

// ── 2: Admin endpoints — update unresolved query (created_at → updated_at) ────
const ADMIN_OLD = `        const rows = await db.execute(sql\`
          SELECT db_name, team_short, confidence, source, created_at
          FROM player_name_mappings
          WHERE confidence = 'unresolved' OR cricsheet_name = ''
          ORDER BY team_short, db_name
        \`);`;
const ADMIN_NEW = `        const rows = await db.execute(sql\`
          SELECT db_name, team_short, confidence, source, updated_at
          FROM player_name_mappings
          WHERE confidence = 'unresolved' OR cricsheet_name = ''
          ORDER BY team_short, db_name
        \`);`;
if (c.includes(ADMIN_OLD)) {
  c = c.replace(ADMIN_OLD, ADMIN_NEW);
  console.log('Admin unresolved query updated');
} else {
  console.log('Admin unresolved query already updated or not found - skipping');
}

// ── 3: Add teamShort to all matchPlayerToHistorical calls in ai-team endpoint ─
// Pattern: calls with (p.name, historicalCache, dbMappings) → add p.teamShort
const CALL_OLD = 'matchPlayerToHistorical(p.name, historicalCache, dbMappings)';
const CALL_NEW = 'matchPlayerToHistorical(p.name, historicalCache, dbMappings, p.teamShort)';
let callCount = 0;
while (c.includes(CALL_OLD)) { c = c.replace(CALL_OLD, CALL_NEW); callCount++; }
console.log(`teamShort added to ${callCount} call sites`);

// ── 4: Diagnostics endpoint — add dbMappings fetch + teamShort ────────────────
const DIAG_OLD = `        const results = matchPlayers.map(p => {
          const { stats, confidence, resolvedVia } = matchPlayerToHistorical(p.name, historicalCache);`;
const DIAG_NEW = `        const dbMappings = await getDbMappingsCache();
        const results = matchPlayers.map(p => {
          const { stats, confidence, resolvedVia } = matchPlayerToHistorical(p.name, historicalCache, dbMappings, p.teamShort);`;
if (!c.includes(DIAG_OLD)) { console.log('ERROR: diagnostics OLD not found'); process.exit(1); }
c = c.replace(DIAG_OLD, DIAG_NEW);
console.log('Diagnostics endpoint updated');

writeFileSync('server/routes.ts', c, 'utf8');
console.log('SUCCESS. routes.ts final length:', c.length);
