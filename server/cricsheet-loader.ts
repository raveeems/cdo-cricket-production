import https from "https";
import http from "http";
import AdmZip from "adm-zip";
import { pool } from "./db";

// ─── CDO Scoring Formula ──────────────────────────────────────────────────────

function calcBattingPoints(
  runs: number,
  balls: number,
  fours: number,
  sixes: number,
  isOut: boolean,
  dismissalType: string
): number {
  let pts = 0;
  pts += runs;
  pts += fours * 4;
  pts += sixes * 6;

  if (runs >= 100) pts += 16;
  else if (runs >= 75) pts += 12;
  else if (runs >= 50) pts += 8;
  else if (runs >= 25) pts += 4;

  const notBatterFault = ["run out", "retired hurt", "retired out", "obstructing the field"];
  if (runs === 0 && isOut && !notBatterFault.includes(dismissalType)) {
    pts -= 2;
  }

  if (balls >= 10) {
    const sr = (runs / balls) * 100;
    if (sr > 170) pts += 6;
    else if (sr > 150) pts += 4;
    else if (sr >= 130) pts += 2;
    else if (sr >= 60 && sr <= 70) pts -= 2;
    else if (sr >= 50 && sr <= 59) pts -= 4;
    else if (sr < 50) pts -= 6;
  }

  return pts;
}

function calcBowlingPoints(
  wickets: number,
  overs: number,
  runsConceded: number,
  maidens: number,
  dotBalls: number,
  lbwOrBowledWickets: number
): number {
  let pts = 0;
  pts += wickets * 30;

  if (wickets >= 5) pts += 16;
  else if (wickets >= 4) pts += 8;
  else if (wickets >= 3) pts += 4;

  pts += maidens * 12;
  pts += dotBalls;
  pts += lbwOrBowledWickets * 8;

  if (overs >= 2) {
    const eco = runsConceded / overs;
    if (eco < 5) pts += 6;
    else if (eco <= 6) pts += 4;
    else if (eco <= 7) pts += 2;
    else if (eco >= 10 && eco <= 11) pts -= 2;
    else if (eco > 11 && eco <= 12) pts -= 4;
    else if (eco > 12) pts -= 6;
  }

  return pts;
}

function calcFieldingPoints(
  catches: number,
  stumpings: number,
  runOutsDirect: number,
  runOutsIndirect: number
): number {
  let pts = 0;
  pts += catches * 8;
  if (catches >= 3) pts += 4;
  pts += stumpings * 12;
  pts += runOutsDirect * 12;
  pts += runOutsIndirect * 6;
  return pts;
}

// ─── Phase Detection ──────────────────────────────────────────────────────────
// Cricsheet overs are 0-indexed: over 0 = first over of the match

function getPhase(overNumber: number): "powerplay" | "middle" | "death" {
  if (overNumber <= 5) return "powerplay";  // overs 1-6
  if (overNumber <= 14) return "middle";    // overs 7-15
  return "death";                           // overs 16-20
}

// ─── Download Helper ──────────────────────────────────────────────────────────

function downloadBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(downloadBuffer(res.headers.location!));
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

// ─── Progress Tracker ─────────────────────────────────────────────────────────

export interface LoaderProgress {
  total: number;
  processed: number;
  failed: number;
  status: "idle" | "running" | "done" | "error";
  message: string;
}

let loaderProgress: LoaderProgress = {
  total: 0, processed: 0, failed: 0,
  status: "idle", message: "Not started"
};

export function getLoaderProgress(): LoaderProgress {
  return { ...loaderProgress };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function loadCricsheetData(): Promise<void> {
  if (loaderProgress.status === "running") return; // prevent double trigger

  loaderProgress = {
    total: 0, processed: 0, failed: 0,
    status: "running", message: "Downloading Cricsheet IPL data..."
  };

  try {
    // Step 1 — Download
    console.log("[Cricsheet] Downloading IPL JSON zip from cricsheet.org...");
    const zipBuffer = await downloadBuffer("https://cricsheet.org/downloads/ipl_json.zip");
    console.log(`[Cricsheet] Downloaded ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`);

    loaderProgress.message = "Unzipping...";

    // Step 2 — Unzip in memory
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries().filter(e =>
      e.entryName.endsWith(".json") &&
      !e.entryName.toLowerCase().includes("readme") &&
      !e.entryName.toLowerCase().includes("info")
    );

    loaderProgress.total = entries.length;
    loaderProgress.message = `Parsing ${entries.length} match files...`;
    console.log(`[Cricsheet] Found ${entries.length} match JSON files`);

    // Step 3 — Process each match
    for (const entry of entries) {
      try {
        const raw = zip.readAsText(entry);
        const matchData = JSON.parse(raw);
        await processMatch(matchData);
        loaderProgress.processed++;

        if (loaderProgress.processed % 100 === 0) {
          loaderProgress.message = `Processed ${loaderProgress.processed}/${loaderProgress.total} matches...`;
          console.log(`[Cricsheet] ${loaderProgress.processed}/${loaderProgress.total}`);
        }
      } catch (err: any) {
        console.error(`[Cricsheet] Failed: ${entry.entryName} — ${err.message}`);
        loaderProgress.failed++;
      }
    }

    // Step 4 — Rebuild summary stats
    loaderProgress.message = "Rebuilding player_historical_stats...";
    await rebuildHistoricalStats();

    const { invalidateHistoricalStatsCache } = await import("./routes");
    invalidateHistoricalStatsCache();
    loaderProgress.status = "done";
    loaderProgress.message = `Complete. ${loaderProgress.processed} matches loaded, ${loaderProgress.failed} failed.`;
    console.log(`[Cricsheet] ${loaderProgress.message}`);

  } catch (err: any) {
    loaderProgress.status = "error";
    loaderProgress.message = `Fatal error: ${err.message}`;
    console.error("[Cricsheet] Fatal error:", err);
  }
}

// ─── Process One Match ────────────────────────────────────────────────────────

async function processMatch(matchData: any): Promise<void> {
  const info = matchData.info;
  if (!info) return;

  // Only IPL matches
  const eventName: string = info.event?.name || info.competition?.name || "";
  if (!eventName.toLowerCase().includes("indian premier league") &&
      !eventName.toLowerCase().includes("ipl")) return;

  const teams: string[] = info.teams || [];
  if (teams.length !== 2) return;

  const matchDate: string = info.dates?.[0] || "";
  const season: string = String(info.season || matchDate.split("-")[0] || "unknown");

  // Stable unique ID for this match
  const cricsheetMatchId = `${matchDate}_${teams[0]}_${teams[1]}`.replace(/\s+/g, "_");

  // ── Per-player stat accumulators ──────────────────────────────────────────

  type PlayerStats = {
    team: string;
    opponent: string;
    battingPosition: number;
    runs: number; balls: number; fours: number; sixes: number;
    powerplayRuns: number; powerplayBalls: number;
    middleRuns: number; middleBalls: number;
    deathRuns: number; deathBalls: number;
    isOut: boolean; dismissalType: string;
    wickets: number; runsConceded: number;
    maidens: number; dotBalls: number;
    powerplayWickets: number; deathWickets: number;
    lbwOrBowledWickets: number;
    catches: number; stumpings: number;
    runOutsDirect: number; runOutsIndirect: number;
    bowledOvers: Set<number>;
  };

  const players: Record<string, PlayerStats> = {};

  function getOrCreate(name: string, team: string, opponent: string): PlayerStats {
    if (!players[name]) {
      players[name] = {
        team, opponent,
        battingPosition: 0,
        runs: 0, balls: 0, fours: 0, sixes: 0,
        powerplayRuns: 0, powerplayBalls: 0,
        middleRuns: 0, middleBalls: 0,
        deathRuns: 0, deathBalls: 0,
        isOut: false, dismissalType: "",
        wickets: 0, runsConceded: 0,
        maidens: 0, dotBalls: 0,
        powerplayWickets: 0, deathWickets: 0,
        lbwOrBowledWickets: 0,
        catches: 0, stumpings: 0,
        runOutsDirect: 0, runOutsIndirect: 0,
        bowledOvers: new Set(),
      };
    }
    return players[name];
  }

  // ── Parse each innings ────────────────────────────────────────────────────

  for (const inning of (matchData.innings || [])) {
    const battingTeam: string = inning.team;
    const bowlingTeam: string = teams.find(t => t !== battingTeam) || "";

    // Track batting order within this innings
    const battingOrder: Record<string, number> = {};
    let positionCounter = 1;

    // Track runs per over per bowler for maiden detection
    // overNum → { bowler, runsInOver, legalDeliveries }
    const overInfo: Record<number, { bowler: string; runs: number; legal: number }> = {};

    for (const over of (inning.overs || [])) {
      const overNum: number = over.over; // 0-indexed
      const phase = getPhase(overNum);
      const deliveries: any[] = over.deliveries || [];
      if (deliveries.length === 0) continue;

      const overBowler: string = deliveries[0].bowler;
      overInfo[overNum] = { bowler: overBowler, runs: 0, legal: 0 };

      for (const delivery of deliveries) {
        const batter: string = delivery.batter;
        const bowler: string = delivery.bowler;

        const batterStats = getOrCreate(batter, battingTeam, bowlingTeam);
        const bowlerStats = getOrCreate(bowler, bowlingTeam, battingTeam);

        // Assign batting position (first appearance only)
        if (!battingOrder[batter]) {
          battingOrder[batter] = positionCounter++;
          batterStats.battingPosition = battingOrder[batter];
        }

        const isWide = delivery.extras?.wides !== undefined;
        const isNoBall = delivery.extras?.noballs !== undefined;
        const batsmanRuns: number = delivery.runs?.batter || 0;
        const totalRuns: number = delivery.runs?.total || 0;

        // ── Batting ────────────────────────────────────────────────────────
        if (!isWide) {
          batterStats.balls++;
          if (phase === "powerplay") {
            batterStats.powerplayRuns += batsmanRuns;
            batterStats.powerplayBalls++;
          } else if (phase === "middle") {
            batterStats.middleRuns += batsmanRuns;
            batterStats.middleBalls++;
          } else {
            batterStats.deathRuns += batsmanRuns;
            batterStats.deathBalls++;
          }
        }
        batterStats.runs += batsmanRuns;
        if (batsmanRuns === 4) batterStats.fours++;
        if (batsmanRuns === 6) batterStats.sixes++;

        // ── Bowling ────────────────────────────────────────────────────────
        bowlerStats.bowledOvers.add(overNum);
        if (!isWide) {
          bowlerStats.runsConceded += totalRuns;
          overInfo[overNum].runs += totalRuns;
          if (!isNoBall) {
            overInfo[overNum].legal++;
            if (totalRuns === 0) bowlerStats.dotBalls++;
          }
        }

        // ── Wickets ────────────────────────────────────────────────────────
        for (const wicket of (delivery.wickets || [])) {
          const kind: string = wicket.kind || "";
          const playerOut: string = wicket.player_out || "";
          const isRunOut = kind === "run out";

          // Bowler credit (not for run outs)
          if (!isRunOut && playerOut === batter) {
            bowlerStats.wickets++;
            if (phase === "powerplay") bowlerStats.powerplayWickets++;
            if (phase === "death") bowlerStats.deathWickets++;
            if (kind === "lbw" || kind === "bowled") bowlerStats.lbwOrBowledWickets++;
          }

          // Batter dismissal
          if (playerOut === batter) {
            batterStats.isOut = true;
            batterStats.dismissalType = kind;
          }

          // Fielding credits
          const fielders: any[] = wicket.fielders || [];
          if (kind === "caught") {
            for (const f of fielders) {
              if (f.name) getOrCreate(f.name, bowlingTeam, battingTeam).catches++;
            }
          } else if (kind === "stumped") {
            for (const f of fielders) {
              if (f.name) getOrCreate(f.name, bowlingTeam, battingTeam).stumpings++;
            }
          } else if (kind === "run out") {
            if (fielders.length === 1 && fielders[0].name) {
              getOrCreate(fielders[0].name, bowlingTeam, battingTeam).runOutsDirect++;
            } else {
              for (const f of fielders) {
                if (f.name) getOrCreate(f.name, bowlingTeam, battingTeam).runOutsIndirect++;
              }
            }
          }
        }
      }
    }

    // ── Maiden detection (after full innings parsed) ───────────────────────
    for (const [overNum, info] of Object.entries(overInfo)) {
      if (info.legal >= 6 && info.runs === 0 && info.bowler) {
        const bowlerStats = players[info.bowler];
        if (bowlerStats) bowlerStats.maidens++;
      }
    }
  }

  // ── Upsert all players into DB ────────────────────────────────────────────

  const client = await pool.connect();
  try {
    for (const [playerName, s] of Object.entries(players)) {
      const oversBowled = s.bowledOvers.size;

      const battingPts = calcBattingPoints(
        s.runs, s.balls, s.fours, s.sixes, s.isOut, s.dismissalType
      );
      const bowlingPts = calcBowlingPoints(
        s.wickets, oversBowled, s.runsConceded,
        s.maidens, s.dotBalls, s.lbwOrBowledWickets
      );
      const fieldingPts = calcFieldingPoints(
        s.catches, s.stumpings, s.runOutsDirect, s.runOutsIndirect
      );
      const cdoPoints = battingPts + bowlingPts + fieldingPts + 4; // +4 playing XI

      await client.query(`
        INSERT INTO player_match_history (
          cricsheet_match_id, season, match_date, team, opponent, player_name,
          batting_position,
          runs, balls_faced, fours, sixes,
          powerplay_runs, powerplay_balls,
          middle_runs, middle_balls,
          death_runs, death_balls,
          wickets, overs_bowled, runs_conceded, maidens, dot_balls,
          powerplay_wickets, death_wickets, lbw_or_bowled_wickets,
          catches, stumpings, run_outs_direct, run_outs_indirect,
          is_out, dismissal_type, cdo_points
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,
          $12,$13,$14,$15,$16,$17,
          $18,$19,$20,$21,$22,
          $23,$24,$25,
          $26,$27,$28,$29,
          $30,$31,$32
        )
        ON CONFLICT (cricsheet_match_id, player_name, team) DO UPDATE SET
          batting_position        = EXCLUDED.batting_position,
          runs                    = EXCLUDED.runs,
          balls_faced             = EXCLUDED.balls_faced,
          fours                   = EXCLUDED.fours,
          sixes                   = EXCLUDED.sixes,
          powerplay_runs          = EXCLUDED.powerplay_runs,
          powerplay_balls         = EXCLUDED.powerplay_balls,
          middle_runs             = EXCLUDED.middle_runs,
          middle_balls            = EXCLUDED.middle_balls,
          death_runs              = EXCLUDED.death_runs,
          death_balls             = EXCLUDED.death_balls,
          wickets                 = EXCLUDED.wickets,
          overs_bowled            = EXCLUDED.overs_bowled,
          runs_conceded           = EXCLUDED.runs_conceded,
          maidens                 = EXCLUDED.maidens,
          dot_balls               = EXCLUDED.dot_balls,
          powerplay_wickets       = EXCLUDED.powerplay_wickets,
          death_wickets           = EXCLUDED.death_wickets,
          lbw_or_bowled_wickets   = EXCLUDED.lbw_or_bowled_wickets,
          catches                 = EXCLUDED.catches,
          stumpings               = EXCLUDED.stumpings,
          run_outs_direct         = EXCLUDED.run_outs_direct,
          run_outs_indirect       = EXCLUDED.run_outs_indirect,
          is_out                  = EXCLUDED.is_out,
          dismissal_type          = EXCLUDED.dismissal_type,
          cdo_points              = EXCLUDED.cdo_points
      `, [
        cricsheetMatchId, season, matchDate, s.team, s.opponent, playerName,
        s.battingPosition,
        s.runs, s.balls, s.fours, s.sixes,
        s.powerplayRuns, s.powerplayBalls,
        s.middleRuns, s.middleBalls,
        s.deathRuns, s.deathBalls,
        s.wickets, oversBowled, s.runsConceded, s.maidens, s.dotBalls,
        s.powerplayWickets, s.deathWickets, s.lbwOrBowledWickets,
        s.catches, s.stumpings, s.runOutsDirect, s.runOutsIndirect,
        s.isOut, s.dismissalType, cdoPoints
      ]);
    }
  } finally {
    client.release();
  }
}

// ─── Rebuild Historical Stats ─────────────────────────────────────────────────

async function rebuildHistoricalStats(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO player_historical_stats (
        player_name, team,
        matches_played, total_cdo_points, avg_cdo_points,
        avg_powerplay_runs, avg_middle_runs, avg_death_runs,
        avg_powerplay_wickets, avg_death_wickets,
        typical_batting_position,
        batting_position_certainty,
        bowling_quota_certainty,
        updated_at
      )
      SELECT
        player_name, team,
        COUNT(*)                                              AS matches_played,
        SUM(cdo_points)                                       AS total_cdo_points,
        ROUND(AVG(cdo_points)::numeric, 2)                   AS avg_cdo_points,
        ROUND(AVG(powerplay_runs)::numeric, 2)               AS avg_powerplay_runs,
        ROUND(AVG(middle_runs)::numeric, 2)                  AS avg_middle_runs,
        ROUND(AVG(death_runs)::numeric, 2)                   AS avg_death_runs,
        ROUND(AVG(powerplay_wickets)::numeric, 3)            AS avg_powerplay_wickets,
        ROUND(AVG(death_wickets)::numeric, 3)                AS avg_death_wickets,
        COALESCE(ROUND(AVG(NULLIF(batting_position, 0))::numeric, 1), 0) AS typical_batting_position,
        -- batting_position_certainty: % of last 10 matches where batted in positions 1-4
        COALESCE(
          ROUND(
            (SUM(CASE WHEN batting_position BETWEEN 1 AND 4 THEN 1 ELSE 0 END)::float
             / NULLIF(COUNT(*), 0)) ::numeric, 3
          ), 0
        ) AS batting_position_certainty,
        -- bowling_quota_certainty: % of last 10 matches where bowled >= 3 overs
        COALESCE(
          ROUND(
            (SUM(CASE WHEN overs_bowled >= 3 THEN 1 ELSE 0 END)::float
             / NULLIF(COUNT(*), 0))::numeric, 3
          ), 0
        ) AS bowling_quota_certainty,
        NOW()
      FROM player_match_history
      GROUP BY player_name, team
      ON CONFLICT (player_name, team) DO UPDATE SET
        matches_played              = EXCLUDED.matches_played,
        total_cdo_points            = EXCLUDED.total_cdo_points,
        avg_cdo_points              = EXCLUDED.avg_cdo_points,
        avg_powerplay_runs          = EXCLUDED.avg_powerplay_runs,
        avg_middle_runs             = EXCLUDED.avg_middle_runs,
        avg_death_runs              = EXCLUDED.avg_death_runs,
        avg_powerplay_wickets       = EXCLUDED.avg_powerplay_wickets,
        avg_death_wickets           = EXCLUDED.avg_death_wickets,
        typical_batting_position    = EXCLUDED.typical_batting_position,
        batting_position_certainty  = EXCLUDED.batting_position_certainty,
        bowling_quota_certainty     = EXCLUDED.bowling_quota_certainty,
        updated_at                  = NOW()
    `);
    console.log("[Cricsheet] player_historical_stats rebuilt.");
  } finally {
    client.release();
  }
}

export async function rebuildHistoricalStatsPublic(): Promise<void> {
  console.log("[Cricsheet] Manual rebuild of player_historical_stats triggered...");
  await rebuildHistoricalStats();
  const { invalidateHistoricalStatsCache } = await import("./routes");
  invalidateHistoricalStatsCache();
  console.log("[Cricsheet] Manual rebuild complete.");
}
