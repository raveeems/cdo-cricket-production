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

interface CricbuzzMatchScore {
  team1Score?: {
    inngs1?: { runs: number; wickets: number; overs: number };
    inngs2?: { runs: number; wickets: number; overs: number };
  };
  team2Score?: {
    inngs1?: { runs: number; wickets: number; overs: number };
    inngs2?: { runs: number; wickets: number; overs: number };
  };
}

interface CricbuzzBatsman {
  batId: number;
  batName: string;
  batShortName?: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isCaptain?: boolean;
  isKeeper?: boolean;
  outDesc?: string;
  wicketCode?: string;
}

interface CricbuzzBowler {
  bowlId: number;
  bowlName: string;
  bowlShortName?: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
}

interface CricbuzzInningsScore {
  inningsId: number;
  batTeamDetails?: {
    batTeamName: string;
    batTeamShortName: string;
  };
  batTeamName?: string;
  scoreDetails?: {
    runs: number;
    wickets: number;
    overs: number;
  };
  batsmenData?: Record<string, CricbuzzBatsman>;
  bowlersData?: Record<string, CricbuzzBowler>;
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
  score?: {
    team1Score?: string;
    team2Score?: string;
  };
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

function formatInningsScore(inngs: { runs: number; wickets: number; overs: number } | undefined): string {
  if (!inngs) return "";
  return `${inngs.runs}/${inngs.wickets} (${inngs.overs} ov)`;
}

export async function verifyMatch(
  team1Short: string,
  team2Short: string,
  matchDate?: string
): Promise<VerifyResult> {
  const t1 = team1Short.toUpperCase();
  const t2 = team2Short.toUpperCase();

  const [recentData, upcomingData, liveData] = await Promise.all([
    cricbuzzGetRecentMatches(),
    cricbuzzGetUpcomingMatches(),
    cricbuzzGetLiveMatches(),
  ]);

  const allMatches = [
    ...extractMatches(recentData),
    ...extractMatches(upcomingData),
    ...extractMatches(liveData),
  ];

  const match = allMatches.find((m) => {
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
  });

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

  return result;
}

export async function verifyScorecard(cricbuzzMatchId: number): Promise<VerifyResult> {
  const data = await cricbuzzGetScorecard(cricbuzzMatchId);

  if (!data || !data.scoreCard) {
    return { source: "cricbuzz", found: false };
  }

  const innings: VerifyResult["scorecard"] = { innings: [] };

  for (const sc of data.scoreCard) {
    const inning: any = {
      inning: sc.batTeamDetails?.batTeamName || `Innings ${sc.inningsId}`,
      batting: [],
      bowling: [],
    };

    if (sc.batsman) {
      for (const bat of sc.batsman) {
        inning.batting.push({
          name: bat.batName,
          runs: bat.runs,
          balls: bat.balls,
          fours: bat.fours,
          sixes: bat.sixes,
          sr: bat.strikeRate,
          dismissal: bat.outDesc || "not out",
        });
      }
    }

    if (sc.bowler) {
      for (const bowl of sc.bowler) {
        inning.bowling.push({
          name: bowl.bowlName,
          overs: bowl.overs,
          maidens: bowl.maidens,
          runs: bowl.runs,
          wickets: bowl.wickets,
          economy: bowl.economy,
        });
      }
    }

    innings.innings.push(inning);
  }

  return {
    source: "cricbuzz",
    found: true,
    matchId: cricbuzzMatchId,
    scorecard: innings,
  };
}
