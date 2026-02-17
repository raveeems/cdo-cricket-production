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
    team1: string;
    team1Short: string;
    team1Color: string;
    team2: string;
    team2Short: string;
    team2Color: string;
    venue: string;
    startTime: Date;
    status: string;
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
          console.log(
            `Cricket API: fetched ${json.data.length} from ${url.includes('currentMatches') ? 'currentMatches' : 'matches'}, hits: ${json.info?.hitsUsed}/${json.info?.hitsLimit}`
          );
          for (const m of json.data) {
            if (!seenIds.has(m.id)) {
              seenIds.add(m.id);
              allApiMatches.push(m);
            }
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
        const team1Short =
          m.teamInfo?.[0]?.shortname || getTeamShort(team1);
        const team2Short =
          m.teamInfo?.[1]?.shortname || getTeamShort(team2);

        let status = "upcoming";
        if (m.matchStarted && !m.matchEnded) status = "live";
        if (m.matchEnded) status = "completed";

        return {
          externalId: m.id,
          team1,
          team1Short,
          team1Color: getTeamColor(team1Short),
          team2,
          team2Short,
          team2Color: getTeamColor(team2Short),
          venue: m.venue || "",
          startTime: new Date(m.dateTimeGMT),
          status,
          league: m.name?.split(",")[0] || "",
        };
      });
  } catch (err) {
    console.error("Cricket API fetch error:", err);
    return [];
  }
}

export async function syncMatchesFromApi(): Promise<void> {
  const { storage } = await import("./storage");
  
  console.log("Auto-syncing matches from Cricket API...");
  try {
    const apiMatches = await fetchUpcomingMatches();
    if (apiMatches.length === 0) {
      console.log("No matches returned from Cricket API (check API key)");
      return;
    }

    const existing = await storage.getAllMatches();
    let created = 0;

    for (const m of apiMatches) {
      const dup = existing.find((e) => e.externalId === m.externalId);
      if (!dup) {
        await storage.createMatch({
          externalId: m.externalId,
          team1: m.team1,
          team1Short: m.team1Short,
          team1Color: m.team1Color,
          team2: m.team2,
          team2Short: m.team2Short,
          team2Color: m.team2Color,
          venue: m.venue,
          startTime: m.startTime,
          status: m.status,
          league: m.league,
          totalPrize: "0",
          entryFee: 0,
          spotsTotal: 100,
          spotsFilled: 0,
        });
        created++;
      } else {
        if (dup.status !== m.status) {
          await storage.updateMatch(dup.id, { status: m.status });
        }
        if (new Date(dup.startTime).getTime() !== m.startTime.getTime()) {
          await storage.updateMatch(dup.id, { startTime: m.startTime } as any);
        }
      }
    }

    console.log(`Cricket API sync: ${created} new matches added, ${apiMatches.length} total from API`);
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
