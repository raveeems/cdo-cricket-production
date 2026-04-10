import { readFileSync, writeFileSync } from 'fs';
let c = readFileSync('server/routes.ts', 'utf8');

// ── Part A: Insert DB mappings cache + runAutoMapping after invalidateCanonicalIndex ──
const PART_A_OLD = `export function invalidateCanonicalIndex(): void {
  canonicalCacheIndex = null;
}`;
const PART_A_NEW = `export function invalidateCanonicalIndex(): void {
  canonicalCacheIndex = null;
}

// ── DB-backed name mappings cache ─────────────────────────────────────────────
let dbMappingsCache: Map<string, string> | null = null;

export function invalidateMappingsCache(): void {
  dbMappingsCache = null;
}

async function getDbMappingsCache(): Promise<Map<string, string>> {
  if (dbMappingsCache) return dbMappingsCache;
  const rows = await db.execute(sql\`
    SELECT db_name, cricsheet_name FROM player_name_mappings
  \`);
  const map = new Map<string, string>();
  for (const row of rows.rows as any[]) {
    map.set(canonicalize(row.db_name), row.cricsheet_name);
  }
  dbMappingsCache = map;
  console.log(\`[AI Mapping] Loaded \${map.size} mappings from DB\`);
  return map;
}

// ── Auto-mapping job ──────────────────────────────────────────────────────────
export async function runAutoMapping(): Promise<void> {
  try {
    const dbPlayersRows = await db.execute(sql\`
      SELECT DISTINCT name, team_short FROM players WHERE name IS NOT NULL
    \`);
    const cricsheetRows = await db.execute(sql\`
      SELECT DISTINCT player_name, team FROM player_historical_stats
    \`);

    const cricsheetByTeam = new Map<string, string[]>();
    for (const row of cricsheetRows.rows as any[]) {
      const teamKey = canonicalize(row.team);
      if (!cricsheetByTeam.has(teamKey)) cricsheetByTeam.set(teamKey, []);
      cricsheetByTeam.get(teamKey)!.push(row.player_name);
    }

    const TEAM_NAME_MAP: Record<string, string[]> = {
      "RR":   ["rajasthan royals"],
      "RCB":  ["royal challengers bangalore", "royal challengers bengaluru"],
      "MI":   ["mumbai indians"],
      "CSK":  ["chennai super kings"],
      "KKR":  ["kolkata knight riders"],
      "SRH":  ["sunrisers hyderabad"],
      "DC":   ["delhi capitals", "delhi daredevils"],
      "PBKS": ["punjab kings", "kings xi punjab"],
      "GT":   ["gujarat titans"],
      "LSG":  ["lucknow super giants"],
    };

    let autoMapped = 0, alreadyMapped = 0, unresolved = 0;

    for (const dbRow of dbPlayersRows.rows as any[]) {
      const dbName: string = dbRow.name;
      const teamShort: string = dbRow.team_short;
      const canonicalDb = canonicalize(dbName);

      const existingRows = await db.execute(sql\`
        SELECT id FROM player_name_mappings WHERE db_name = \${dbName} AND team_short = \${teamShort}
      \`);
      if (existingRows.rows.length > 0) { alreadyMapped++; continue; }

      const teamKeys = TEAM_NAME_MAP[teamShort] || [];
      let teamPlayers: string[] = [];
      for (const teamKey of teamKeys) {
        for (const [k, v] of cricsheetByTeam.entries()) {
          if (k.includes(teamKey) || teamKey.includes(k)) teamPlayers = [...teamPlayers, ...v];
        }
      }
      if (teamPlayers.length === 0) {
        for (const v of cricsheetByTeam.values()) teamPlayers = [...teamPlayers, ...v];
      }

      let bestMatch: string | null = null;
      let bestConfidence = "none";

      for (const cp of teamPlayers) {
        if (canonicalize(cp) === canonicalDb) { bestMatch = cp; bestConfidence = "high"; break; }
      }

      if (!bestMatch) {
        const dbSurname = extractSurname(dbName);
        const dbInit = extractInitial(dbName);
        const surnameMatches = teamPlayers.filter(cp => extractSurname(cp) === dbSurname);
        if (surnameMatches.length === 1) {
          bestMatch = surnameMatches[0];
          bestConfidence = extractInitial(surnameMatches[0]) === dbInit ? "high" : "medium";
        } else if (surnameMatches.length > 1) {
          const initMatches = surnameMatches.filter(cp => extractInitial(cp) === dbInit);
          if (initMatches.length === 1) { bestMatch = initMatches[0]; bestConfidence = "high"; }
        }
      }

      if (bestMatch && bestConfidence !== "none") {
        await db.execute(sql\`
          INSERT INTO player_name_mappings (db_name, cricsheet_name, team_short, confidence, source)
          VALUES (\${dbName}, \${bestMatch}, \${teamShort}, \${bestConfidence}, 'auto')
          ON CONFLICT (db_name, team_short) DO UPDATE SET
            cricsheet_name = EXCLUDED.cricsheet_name,
            confidence = EXCLUDED.confidence,
            updated_at = NOW()
        \`);
        autoMapped++;
      } else {
        await db.execute(sql\`
          INSERT INTO player_name_mappings (db_name, cricsheet_name, team_short, confidence, source)
          VALUES (\${dbName}, '', \${teamShort}, 'unresolved', 'auto')
          ON CONFLICT (db_name, team_short) DO NOTHING
        \`);
        unresolved++;
      }
    }

    dbMappingsCache = null;
    console.log(\`[AI Mapping] Auto-mapping complete: \${autoMapped} mapped, \${alreadyMapped} already mapped, \${unresolved} unresolved\`);
  } catch (err) {
    console.error("[AI Mapping] Auto-mapping error:", err.message);
  }
}`;

if (!c.includes(PART_A_OLD)) { console.log('ERROR Part A not found'); process.exit(1); }
c = c.replace(PART_A_OLD, PART_A_NEW);
console.log('Part A done');

// ── Part B: Update matchPlayerToHistorical signature + add Step 0 ─────────────
const PART_B_OLD = `function matchPlayerToHistorical(
  dbName: string,
  cache: Map<string, HistoricalStats>
): MatchResult {
  const canonicalIndex = buildCanonicalIndex(cache);
  const canonicalDb = canonicalize(dbName);

  // Step 1: Alias table`;
const PART_B_NEW = `function matchPlayerToHistorical(
  dbName: string,
  cache: Map<string, HistoricalStats>,
  dbMappings?: Map<string, string>
): MatchResult {
  const canonicalIndex = buildCanonicalIndex(cache);
  const canonicalDb = canonicalize(dbName);

  // Step 0: DB mappings table (highest priority — team-aware)
  if (dbMappings) {
    const dbMappingTarget = dbMappings.get(canonicalDb);
    if (dbMappingTarget && dbMappingTarget !== "") {
      const row = canonicalIndex.get(canonicalize(dbMappingTarget)) || cache.get(dbMappingTarget);
      if (row) {
        const mp = row.matches_played;
        if (mp > 0) {
          const confidence: MatchConfidence = mp >= 10 ? "high" : mp >= 5 ? "medium" : "low";
          console.log(\`[AI Match] "\${dbName}" → "\${row.player_name}" \${confidence.toUpperCase()} via DB-MAPPING (\${mp} matches)\`);
          return { stats: row, confidence, resolvedVia: "db-mapping" };
        }
      }
    }
  }

  // Step 1: Alias table`;

if (!c.includes(PART_B_OLD)) { console.log('ERROR Part B not found'); process.exit(1); }
c = c.replace(PART_B_OLD, PART_B_NEW);
console.log('Part B done');

// ── Part C1: Fetch dbMappings before roleAvgMap ───────────────────────────────
const C1_OLD = `        const roleAvgMap: Record<string, { sum: number; count: number }> = {`;
const C1_NEW = `        // Load DB name mappings for this match
        const dbMappings = await getDbMappingsCache();

        const roleAvgMap: Record<string, { sum: number; count: number }> = {`;
if (!c.includes(C1_OLD)) { console.log('ERROR Part C1 not found'); process.exit(1); }
c = c.replace(C1_OLD, C1_NEW);
console.log('Part C1 done');

// ── Part C2: Both matchPlayerToHistorical calls in scoring section ────────────
const C2_OLD = `          const { stats, confidence } = matchPlayerToHistorical(p.name, historicalCache);
          const careerAvg = stats ? stats.avg_cdo_points : roleDefaults[p.role];`;
const C2_NEW = `          const { stats, confidence } = matchPlayerToHistorical(p.name, historicalCache, dbMappings);
          const careerAvg = stats ? stats.avg_cdo_points : roleDefaults[p.role];`;
let count = 0;
while (c.includes(C2_OLD)) { c = c.replace(C2_OLD, C2_NEW); count++; }
if (count === 0) { console.log('ERROR Part C2 not found'); process.exit(1); }
console.log(`Part C2 done (${count} occurrences)`);

// ── Part D: Admin endpoints before ai-diagnostics ────────────────────────────
const PART_D_OLD = `  // ── AI Match Diagnostics endpoint ───────────────────────────────────────────
  app.get(
    "/api/admin/ai-diagnostics/:matchId",`;
const PART_D_NEW = `  // ── Player name mappings admin endpoints ────────────────────────────────────

  app.get(
    "/api/admin/player-mappings/unresolved",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const rows = await db.execute(sql\`
          SELECT db_name, team_short, confidence, source, created_at
          FROM player_name_mappings
          WHERE confidence = 'unresolved' OR cricsheet_name = ''
          ORDER BY team_short, db_name
        \`);
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
        await db.execute(sql\`
          INSERT INTO player_name_mappings (db_name, cricsheet_name, team_short, confidence, source)
          VALUES (\${dbName}, \${cricsheetName}, \${teamShort}, 'manual', 'admin')
          ON CONFLICT (db_name, team_short) DO UPDATE SET
            cricsheet_name = EXCLUDED.cricsheet_name,
            confidence = 'manual',
            source = 'admin',
            updated_at = NOW()
        \`);
        dbMappingsCache = null;
        return res.json({ message: \`Mapped "\${dbName}" → "\${cricsheetName}" for \${teamShort}\` });
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
    "/api/admin/ai-diagnostics/:matchId",`;

if (!c.includes(PART_D_OLD)) { console.log('ERROR Part D not found'); process.exit(1); }
c = c.replace(PART_D_OLD, PART_D_NEW);
console.log('Part D done');

writeFileSync('server/routes.ts', c, 'utf8');
console.log('SUCCESS. Final length:', c.length);
