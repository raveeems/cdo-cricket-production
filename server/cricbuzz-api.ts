const CRICBUZZ_BASE = "https://cricbuzz-cricket.p.rapidapi.com";

const CRICBUZZ_HEADERS = {
  "x-rapidapi-key": process.env.CRICBUZZ_RAPIDAPI_KEY || "",
  "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com",
};

interface CricbuzzMatchInfo {
  matchId: number;
  seriesId: number;
  seriesName: string;
  matchDesc: string;
  matchFormat: string;
  startDate: string;
  endDate: string;
  state: string;
  status: string;
  team1: {
    teamId: number;
    teamName: string;
    teamSName: string;
    imageId?: number;
  };
  team2: {
    teamId: number;
    teamName: string;
    teamSName: string;
    imageId?: number;
  };
  venueInfo?: {
    ground: string;
    city: string;
  };
  stateTitle?: string;
  currBatTeamId?: number;
}

async function cricbuzzFetch<T>(path: string): Promise<T | null> {
  try {
    if (!CRICBUZZ_HEADERS["x-rapidapi-key"]) {
      console.log("Cricbuzz API: No API key configured");
      return null;
    }
    const url = `${CRICBUZZ_BASE}${path}`;
    const res = await fetch(url, { headers: CRICBUZZ_HEADERS });
    if (!res.ok) {
      console.log(`Cricbuzz API error: ${res.status} for ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("Cricbuzz API fetch error:", err);
    return null;
  }
}

export async function cricbuzzGetRecentMatches(): Promise<any> {
  return cricbuzzFetch("/matches/v1/recent");
}

export async function cricbuzzGetUpcomingMatches(): Promise<any> {
  return cricbuzzFetch("/matches/v1/upcoming");
}

export async function cricbuzzGetLiveMatches(): Promise<any> {
  return cricbuzzFetch("/matches/v1/live");
}

export async function cricbuzzGetScorecard(matchId: number): Promise<any> {
  return cricbuzzFetch(`/mcenter/v1/${matchId}/scard`);
}

export async function cricbuzzGetMatchInfo(matchId: number): Promise<any> {
  return cricbuzzFetch(`/mcenter/v1/${matchId}`);
}

function extractMatches(data: any): CricbuzzMatchInfo[] {
  const matches: CricbuzzMatchInfo[] = [];
  if (!data?.typeMatches) return matches;

  for (const typeMatch of data.typeMatches) {
    if (!typeMatch.seriesMatches) continue;
    for (const series of typeMatch.seriesMatches) {
      const wrapper = series.seriesAdWrapper;
      if (!wrapper?.matches) continue;
      for (const m of wrapper.matches) {
        if (m.matchInfo) {
          matches.push(m.matchInfo);
        }
      }
    }
  }
  return matches;
}

interface VerifyResult {
  source: "cricbuzz";
  found: boolean;
  matchId?: number;
  team1?: string;
  team1Short?: string;
  team2?: string;
  team2Short?: string;
  venue?: string;
  status?: string;
  statusText?: string;
  startDate?: string;
  playingXI?: {
    matched: number;
    playerNames: string[];
  };
  scorecardSynced?: boolean;
  scorecard?: {
    innings: Array<{
      inning: string;
      batting: Array<{
        name: string;
        runs: number;
        balls: number;
        fours: number;
        sixes: number;
        sr: number;
        dismissal: string;
      }>;
      bowling: Array<{
        name: string;
        overs: number;
        maidens: number;
        runs: number;
        wickets: number;
        economy: number;
      }>;
    }>;
  };
}

export async function findCricbuzzMatch(
  team1Short: string,
  team2Short: string,
  matchDate?: string
): Promise<CricbuzzMatchInfo | null> {
  const t1 = team1Short.toUpperCase();
  const t2 = team2Short.toUpperCase();

  const [recentData, upcomingData, liveData] = await Promise.all([
    cricbuzzGetRecentMatches(),
    cricbuzzGetUpcomingMatches(),
    cricbuzzGetLiveMatches(),
  ]);

  const allMatches = [
    ...extractMatches(liveData),
    ...extractMatches(recentData),
    ...extractMatches(upcomingData),
  ];

  return allMatches.find((m) => {
    const s1 = m.team1?.teamSName?.toUpperCase();
    const s2 = m.team2?.teamSName?.toUpperCase();
    const teamsMatch =
      (s1 === t1 && s2 === t2) || (s1 === t2 && s2 === t1);
    if (!teamsMatch) return false;

    if (matchDate) {
      const mDate = new Date(parseInt(m.startDate)).toISOString().split("T")[0];
      const targetDate = new Date(matchDate).toISOString().split("T")[0];
      return mDate === targetDate;
    }
    return true;
  }) || null;
}

export async function verifyMatch(
  team1Short: string,
  team2Short: string,
  matchDate?: string
): Promise<VerifyResult> {
  const match = await findCricbuzzMatch(team1Short, team2Short, matchDate);

  if (!match) {
    return { source: "cricbuzz", found: false };
  }

  return {
    source: "cricbuzz",
    found: true,
    matchId: match.matchId,
    team1: match.team1.teamName,
    team1Short: match.team1.teamSName,
    team2: match.team2.teamName,
    team2Short: match.team2.teamSName,
    venue: match.venueInfo
      ? `${match.venueInfo.ground}, ${match.venueInfo.city}`
      : undefined,
    status: match.state,
    statusText: match.status,
    startDate: new Date(parseInt(match.startDate)).toISOString(),
  };
}

function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function playerNameMatch(cricbuzzName: string, dbName: string): boolean {
  const n1 = normalizePlayerName(cricbuzzName);
  const n2 = normalizePlayerName(dbName);

  if (n1 === n2) return true;

  const parts1 = n1.split(" ");
  const parts2 = n2.split(" ");

  if (parts1.length > 0 && parts2.length > 0) {
    const lastName1 = parts1[parts1.length - 1];
    const lastName2 = parts2[parts2.length - 1];
    if (lastName1 === lastName2 && lastName1.length > 2) {
      if (parts1[0][0] === parts2[0][0]) return true;
    }
  }

  if (n1.includes(n2) || n2.includes(n1)) return true;

  return false;
}

export async function extractPlayingXIFromCricbuzz(
  cricbuzzMatchId: number
): Promise<string[]> {
  const data = await cricbuzzGetScorecard(cricbuzzMatchId);
  if (!data?.scoreCard) return [];

  const playerNames = new Set<string>();

  for (const sc of data.scoreCard) {
    if (sc.batsman) {
      for (const bat of sc.batsman) {
        if (bat.batName) playerNames.add(bat.batName);
      }
    }
    if (sc.bowler) {
      for (const bowl of sc.bowler) {
        if (bowl.bowlName) playerNames.add(bowl.bowlName);
      }
    }
  }

  return Array.from(playerNames);
}

export async function markPlayingXIFromCricbuzz(
  matchId: string,
  cricbuzzMatchId: number
): Promise<{ matched: number; playerNames: string[] }> {
  const { storage } = await import("./storage");

  const cricbuzzPlayers = await extractPlayingXIFromCricbuzz(cricbuzzMatchId);
  if (cricbuzzPlayers.length === 0) {
    return { matched: 0, playerNames: [] };
  }

  const dbPlayers = await storage.getPlayersForMatch(matchId);
  const matchedPlayerIds: string[] = [];
  const matchedNames: string[] = [];

  for (const cbName of cricbuzzPlayers) {
    const found = dbPlayers.find((p) => playerNameMatch(cbName, p.name));
    if (found && found.externalId) {
      matchedPlayerIds.push(found.externalId);
      matchedNames.push(found.name);
    }
  }

  if (matchedPlayerIds.length > 0) {
    await storage.markPlayingXI(matchId, matchedPlayerIds);
    console.log(`Cricbuzz Playing XI: matched ${matchedPlayerIds.length} players for match ${matchId}`);
  }

  return {
    matched: matchedPlayerIds.length,
    playerNames: matchedNames,
  };
}

export async function fetchCricbuzzLiveScorecard(
  cricbuzzMatchId: number
): Promise<{
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
  const data = await cricbuzzGetScorecard(cricbuzzMatchId);
  if (!data?.scoreCard) return null;

  const score: Array<{ r: number; w: number; o: number; inning: string }> = [];
  const innings: any[] = [];

  for (const sc of data.scoreCard) {
    const inningName = sc.batTeamDetails?.batTeamName
      ? `${sc.batTeamDetails.batTeamName} Inning`
      : `Innings ${sc.inningsId}`;

    if (sc.scoreDetails) {
      score.push({
        r: sc.scoreDetails.runs || 0,
        w: sc.scoreDetails.wickets || 0,
        o: sc.scoreDetails.overs || 0,
        inning: inningName,
      });
    }

    const batting = (sc.batsman || []).map((bat: any) => ({
      name: bat.batName || "",
      r: bat.runs || 0,
      b: bat.balls || 0,
      fours: bat.fours || 0,
      sixes: bat.sixes || 0,
      sr: bat.strikeRate || 0,
      dismissal: bat.outDesc || "not out",
      fantasyPoints: 0,
    }));

    const bowling = (sc.bowler || []).map((bowl: any) => ({
      name: bowl.bowlName || "",
      o: bowl.overs || 0,
      m: bowl.maidens || 0,
      r: bowl.runs || 0,
      w: bowl.wickets || 0,
      eco: bowl.economy || 0,
      fantasyPoints: 0,
    }));

    innings.push({ inning: inningName, batting, bowling });
  }

  return {
    score,
    innings,
    status: data.matchHeader?.status || "",
  };
}

export async function verifyAndSyncMatch(
  dbMatchId: string,
  team1Short: string,
  team2Short: string,
  matchDate?: string,
  syncScorecard?: boolean
): Promise<VerifyResult> {
  const match = await findCricbuzzMatch(team1Short, team2Short, matchDate);

  if (!match) {
    return { source: "cricbuzz", found: false };
  }

  const result: VerifyResult = {
    source: "cricbuzz",
    found: true,
    matchId: match.matchId,
    team1: match.team1.teamName,
    team1Short: match.team1.teamSName,
    team2: match.team2.teamName,
    team2Short: match.team2.teamSName,
    venue: match.venueInfo
      ? `${match.venueInfo.ground}, ${match.venueInfo.city}`
      : undefined,
    status: match.state,
    statusText: match.status,
    startDate: new Date(parseInt(match.startDate)).toISOString(),
  };

  const isLiveOrComplete = match.state === "In Progress" || match.state === "Complete";

  if (isLiveOrComplete) {
    const xiResult = await markPlayingXIFromCricbuzz(dbMatchId, match.matchId);
    result.playingXI = xiResult;
  }

  if (syncScorecard && isLiveOrComplete) {
    const scorecard = await fetchCricbuzzLiveScorecard(match.matchId);
    if (scorecard) {
      result.scorecardSynced = true;
      result.scorecard = {
        innings: scorecard.innings.map((inn) => ({
          inning: inn.inning,
          batting: inn.batting.map((b) => ({
            name: b.name,
            runs: b.r,
            balls: b.b,
            fours: b.fours,
            sixes: b.sixes,
            sr: b.sr,
            dismissal: b.dismissal,
          })),
          bowling: inn.bowling.map((b) => ({
            name: b.name,
            overs: b.o,
            maidens: b.m,
            runs: b.r,
            wickets: b.w,
            economy: b.eco,
          })),
        })),
      };
    }
  }

  return result;
}

export async function autoVerifyPlayingXI(
  dbMatchId: string,
  team1Short: string,
  team2Short: string,
  matchDate?: string
): Promise<{ matched: number; playerNames: string[] } | null> {
  const match = await findCricbuzzMatch(team1Short, team2Short, matchDate);
  if (!match) {
    console.log(`Cricbuzz auto-verify: match not found for ${team1Short} vs ${team2Short}`);
    return null;
  }

  console.log(`Cricbuzz auto-verify: found match ${match.matchId} (${match.team1.teamSName} vs ${match.team2.teamSName}, state: ${match.state})`);

  const result = await markPlayingXIFromCricbuzz(dbMatchId, match.matchId);
  return result;
}
