const CRICKET_API_BASE = "https://api.cricapi.com/v1";

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

  if (isMatchDelayed(apiStatusText)) {
    return { status: 'delayed', statusNote };
  }

  if (matchStarted && hasScoreData) {
    return { status: 'live', statusNote };
  }

  if (matchStarted && !hasScoreData) {
    return { status: 'delayed', statusNote: statusNote || 'Waiting for play to begin' };
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
  MI: "#004BA0",
  CSK: "#FFCB05",
  RCB: "#EC1C24",
  KKR: "#3A225D",
  DC: "#17449B",
  RR: "#EA1A85",
  SRH: "#FF822A",
  PBKS: "#ED1B24",
  GT: "#1B2133",
  LSG: "#A72056",
  IND: "#0066B3",
  AUS: "#FFCC00",
  ENG: "#003366",
  PAK: "#006633",
  SA: "#006A4E",
  NZ: "#000000",
  WI: "#7B0041",
  SL: "#003DA5",
  BAN: "#006A4E",
  AFG: "#0066FF",
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
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey) {
    console.log("CRICKET_API_KEY not set, skipping API fetch");
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
          console.log(`Cricket API blocked: ${(json as any).reason} - will retry later`);
          if ((json as any).reason?.includes("Blocked")) {
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
  const apiKey = process.env.CRICKET_API_KEY;
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

    if (json.status !== "success" || !json.data?.matchList) return [];

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

export async function syncMatchesFromApi(retryCount = 0): Promise<void> {
  const { storage } = await import("./storage");
  
  console.log("Auto-syncing matches from Cricket API...");
  try {
    const apiMatches = await fetchUpcomingMatches();
    if (apiMatches.length === 0 && retryCount < 3) {
      const delayMin = retryCount === 0 ? 1 : retryCount === 1 ? 5 : 15;
      console.log(`No matches returned - will retry in ${delayMin} minute(s) (attempt ${retryCount + 1}/3)`);
      setTimeout(() => syncMatchesFromApi(retryCount + 1), delayMin * 60 * 1000);
      return;
    }

    const existing = await storage.getAllMatches();
    const { created, updated } = await upsertMatches(apiMatches, existing);
    console.log(`Cricket API sync: ${created} new, ${updated} updated from general endpoints`);

    const refreshedExisting = created > 0 ? await storage.getAllMatches() : existing;
    let seriesCreated = 0;
    let seriesUpdated = 0;
    for (const series of TRACKED_SERIES) {
      try {
        const seriesMatches = await fetchSeriesMatches(series.id, series.name);
        if (seriesMatches.length > 0) {
          const result = await upsertMatches(seriesMatches, refreshedExisting);
          seriesCreated += result.created;
          seriesUpdated += result.updated;
          if (result.created > 0) {
            refreshedExisting.push(...await storage.getAllMatches());
          }
        }
      } catch (err) {
        console.error(`Series sync error for ${series.name}:`, err);
      }
    }

    if (seriesCreated > 0 || seriesUpdated > 0) {
      console.log(`Series sync: ${seriesCreated} new, ${seriesUpdated} updated from tracked series`);
    }
  } catch (err) {
    console.error("Auto-sync failed:", err);
  }
}

export async function fetchMatchInfo(
  matchId: string
): Promise<CricApiMatch | null> {
  const apiKey = process.env.CRICKET_API_KEY;
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

let lastStatusRefresh = 0;
const STATUS_REFRESH_INTERVAL = 2 * 60 * 1000;

export async function refreshStaleMatchStatuses(): Promise<void> {
  const now = Date.now();
  if (now - lastStatusRefresh < STATUS_REFRESH_INTERVAL) return;
  lastStatusRefresh = now;

  const { storage } = await import("./storage");
  const apiKey = process.env.CRICKET_API_KEY;
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
      if (statusNote && statusNote !== (m as any).statusNote) updates.statusNote = statusNote;

      if (Object.keys(updates).length > 0) {
        await storage.updateMatch(m.id, updates);
        console.log(`Status refresh: ${m.team1} vs ${m.team2}: ${m.status} -> ${newStatus} [${statusNote}]`);
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
  const apiKey = process.env.CRICKET_API_KEY;
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
  const apiKey = process.env.CRICKET_API_KEY;
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

  for (const inning of scorecard) {
    const bat = inning.batting?.find((b) => b.batsman?.id === playerId);
    if (bat) {
      points += bat.r;
      points += bat["4s"];
      points += bat["6s"] * 2;
      if (bat.r >= 100) points += 16;
      else if (bat.r >= 50) points += 8;
      else if (bat.r >= 30) points += 4;
      if (bat.r === 0 && bat.b > 0) points -= 2;
      if (bat.sr > 170) points += 6;
      else if (bat.sr > 150) points += 4;
      else if (bat.sr > 130) points += 2;
      else if (bat.sr < 50 && bat.b >= 10) points -= 6;
      else if (bat.sr < 60 && bat.b >= 10) points -= 4;
    }

    const bowl = inning.bowling?.find((b) => b.bowler?.id === playerId);
    if (bowl) {
      points += bowl.w * 25;
      if (bowl.w >= 5) points += 16;
      else if (bowl.w >= 4) points += 8;
      else if (bowl.w >= 3) points += 4;
      if (bowl.m > 0) points += bowl.m * 12;
      if (bowl.eco < 5) points += 6;
      else if (bowl.eco < 6) points += 4;
      else if (bowl.eco < 7) points += 2;
      else if (bowl.eco > 12) points -= 6;
      else if (bowl.eco > 11) points -= 4;
      else if (bowl.eco > 10) points -= 2;
    }

    const catcher = inning.catching?.find((c) => c.catcher?.id === playerId);
    if (catcher) {
      points += (catcher.catches || 0) * 8;
    }
  }

  return points;
}

export async function fetchMatchScorecard(
  externalMatchId: string
): Promise<Map<string, number>> {
  const apiKey = process.env.CRICKET_API_KEY;
  const pointsMap = new Map<string, number>();
  if (!apiKey) return pointsMap;

  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await fetch(url);
    if (!res.ok) return pointsMap;

    const json = (await res.json()) as CricApiResponse<ScorecardData>;
    if (json.status !== "success" || !json.data?.scorecard) return pointsMap;

    console.log(`Scorecard API: fetched ${json.data.scorecard.length} innings for match ${externalMatchId}`);

    const allPlayerIds = new Set<string>();
    for (const inning of json.data.scorecard) {
      inning.batting?.forEach((b) => allPlayerIds.add(b.batsman?.id));
      inning.bowling?.forEach((b) => allPlayerIds.add(b.bowler?.id));
      inning.catching?.forEach((c) => allPlayerIds.add(c.catcher?.id));
    }

    for (const pid of allPlayerIds) {
      if (pid) {
        const pts = calculateFantasyPoints(pid, json.data.scorecard);
        pointsMap.set(pid, pts);
      }
    }

    return pointsMap;
  } catch (err) {
    console.error("Scorecard API error:", err);
    return pointsMap;
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
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = (await res.json()) as CricApiResponse<ScorecardData>;
    if (json.status !== "success" || !json.data) return null;

    const scorecard = json.data.scorecard || [];
    const innings = scorecard.map((inn) => ({
      inning: inn.inning,
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
    }));

    return {
      score: json.data.score || [],
      innings,
      status: json.data.name || "",
    };
  } catch (err) {
    console.error("Live scorecard error:", err);
    return null;
  }
}
