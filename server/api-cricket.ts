const API_CRICKET_BASE = "https://apiv2.api-cricket.com/cricket";

interface ApiCricketEvent {
  event_key: string;
  event_home_team: string;
  event_away_team: string;
  event_date_start: string;
  event_time: string;
  event_status: string;
  event_status_info: string;
  league_name: string;
  league_key: string;
  lineups?: {
    home_team?: {
      starting_lineups?: Array<{ player: string; player_key?: string }>;
    };
    away_team?: {
      starting_lineups?: Array<{ player: string; player_key?: string }>;
    };
  };
  scorecard?: Record<string, Array<{
    innings: string;
    player: string;
    type: string;
    status: string;
    R: string;
    B: string;
    Min: string;
    "4s": string;
    "6s": string;
    O: string | null;
    M: string | null;
    W: string | null;
    SR: string;
    ER: string | null;
  }>>;
}

interface ApiCricketResponse {
  success: number;
  result: ApiCricketEvent[];
}

const T20_WC_LEAGUE_KEY = "7969";

async function apiCricketFetch(params: Record<string, string>): Promise<any> {
  const apiKey = process.env.API_CRICKET_KEY;
  if (!apiKey) {
    console.log("API_CRICKET_KEY not set, skipping api-cricket.com");
    return null;
  }

  const url = new URL(API_CRICKET_BASE);
  url.searchParams.set("APIkey", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.log(`api-cricket.com error: ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data.error === "1" || data.success !== 1) {
      console.log("api-cricket.com API error:", JSON.stringify(data.result?.[0] || data));
      return null;
    }
    return data;
  } catch (err) {
    console.error("api-cricket.com fetch error:", err);
    return null;
  }
}

function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function playerNameMatch(apiName: string, dbName: string): boolean {
  const n1 = normalizePlayerName(apiName);
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

export async function fetchApiCricketT20WCMatches(dateStart?: string, dateStop?: string): Promise<ApiCricketEvent[]> {
  const start = dateStart || new Date().toISOString().split("T")[0];
  const stop = dateStop || start;

  const data = await apiCricketFetch({
    method: "get_events",
    league_key: T20_WC_LEAGUE_KEY,
    date_start: start,
    date_stop: stop,
  }) as ApiCricketResponse | null;

  if (!data?.result || !Array.isArray(data.result)) return [];
  console.log(`api-cricket.com: fetched ${data.result.length} T20 WC events (${start} to ${stop})`);
  return data.result;
}

export async function fetchApiCricketLineups(
  team1Short: string,
  team2Short: string,
  matchDate?: string
): Promise<{ homeXI: string[]; awayXI: string[]; homeTeam: string; awayTeam: string } | null> {
  const dateStart = matchDate || new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const dateStop = matchDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const events = await fetchApiCricketT20WCMatches(dateStart, dateStop);
  if (events.length === 0) return null;

  const t1 = team1Short.toUpperCase();
  const t2 = team2Short.toUpperCase();

  const match = events.find(e => {
    const home = (e.event_home_team || "").toLowerCase();
    const away = (e.event_away_team || "").toLowerCase();
    return (
      (home.includes(t1.toLowerCase()) || away.includes(t1.toLowerCase())) &&
      (home.includes(t2.toLowerCase()) || away.includes(t2.toLowerCase()))
    );
  });

  if (!match) {
    const teamNameMap: Record<string, string[]> = {
      IND: ["india"],
      PAK: ["pakistan"],
      AUS: ["australia"],
      ENG: ["england"],
      SA: ["south africa"],
      NZ: ["new zealand"],
      WI: ["west indies"],
      SL: ["sri lanka"],
      BAN: ["bangladesh"],
      AFG: ["afghanistan"],
      ZIM: ["zimbabwe"],
      IRE: ["ireland"],
      SCO: ["scotland"],
      NED: ["netherlands"],
      NAM: ["namibia"],
      UAE: ["united arab emirates", "uae"],
      USA: ["united states", "u.s.a"],
      NEP: ["nepal"],
      CAN: ["canada"],
      ITA: ["italy"],
    };

    const t1Names = teamNameMap[t1] || [t1.toLowerCase()];
    const t2Names = teamNameMap[t2] || [t2.toLowerCase()];

    const betterMatch = events.find(e => {
      const home = (e.event_home_team || "").toLowerCase();
      const away = (e.event_away_team || "").toLowerCase();
      const t1Found = t1Names.some(n => home.includes(n) || away.includes(n));
      const t2Found = t2Names.some(n => home.includes(n) || away.includes(n));
      return t1Found && t2Found;
    });

    if (!betterMatch) {
      console.log(`api-cricket.com: no match found for ${t1} vs ${t2}`);
      return null;
    }

    return extractLineups(betterMatch);
  }

  return extractLineups(match);
}

function extractLineups(match: ApiCricketEvent): { homeXI: string[]; awayXI: string[]; homeTeam: string; awayTeam: string } | null {
  const homeLineups = match.lineups?.home_team?.starting_lineups || [];
  const awayLineups = match.lineups?.away_team?.starting_lineups || [];

  if (homeLineups.length === 0 && awayLineups.length === 0) {
    console.log(`api-cricket.com: no lineups available for ${match.event_home_team} vs ${match.event_away_team}`);
    return null;
  }

  if (homeLineups.length > 11 || awayLineups.length > 11) {
    console.log(`api-cricket.com: full squad returned (${homeLineups.length} + ${awayLineups.length}), not confirmed Playing XI — skipping`);
    return null;
  }

  const homeXI = homeLineups.map(p => p.player);
  const awayXI = awayLineups.map(p => p.player);

  console.log(`api-cricket.com lineups: ${match.event_home_team} (${homeXI.length}) vs ${match.event_away_team} (${awayXI.length})`);

  return {
    homeXI,
    awayXI,
    homeTeam: match.event_home_team,
    awayTeam: match.event_away_team,
  };
}

export async function markPlayingXIFromApiCricket(
  dbMatchId: string,
  team1Short: string,
  team2Short: string,
  matchDate?: string
): Promise<{ matched: number; playerNames: string[] }> {
  const { storage } = await import("./storage");

  const lineups = await fetchApiCricketLineups(team1Short, team2Short, matchDate);
  if (!lineups) return { matched: 0, playerNames: [] };

  const allNames = [...lineups.homeXI, ...lineups.awayXI];
  if (allNames.length === 0) return { matched: 0, playerNames: [] };

  const filteredNames = allNames.filter(n => n && n.trim().length > 0);

  const dbPlayers = await storage.getPlayersForMatch(dbMatchId);
  const matchedPlayerIds: string[] = [];
  const matchedNames: string[] = [];

  for (const apiName of filteredNames) {
    const found = dbPlayers.find(p => playerNameMatch(apiName, p.name));
    if (found && found.externalId) {
      matchedPlayerIds.push(found.externalId);
      matchedNames.push(found.name);
    }
  }

  if (matchedPlayerIds.length > 0) {
    await storage.markPlayingXI(dbMatchId, matchedPlayerIds);
    console.log(`api-cricket.com Playing XI: matched ${matchedPlayerIds.length}/${filteredNames.length} players for match ${dbMatchId}`);
  } else {
    console.log(`api-cricket.com Playing XI: 0 matches from ${filteredNames.length} names for match ${dbMatchId}`);
  }

  return { matched: matchedPlayerIds.length, playerNames: matchedNames };
}

export async function fetchApiCricketScorecard(
  team1Short: string,
  team2Short: string,
  matchDate?: string
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
    }>;
    bowling: Array<{
      name: string;
      o: number;
      m: number;
      r: number;
      w: number;
      eco: number;
    }>;
  }>;
  status: string;
} | null> {
  const dateStart = matchDate || new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const dateStop = matchDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const events = await fetchApiCricketT20WCMatches(dateStart, dateStop);
  if (events.length === 0) return null;

  const t1 = team1Short.toUpperCase();
  const t2 = team2Short.toUpperCase();

  const teamNameMap: Record<string, string[]> = {
    IND: ["india"], PAK: ["pakistan"], AUS: ["australia"], ENG: ["england"],
    SA: ["south africa"], NZ: ["new zealand"], WI: ["west indies"],
    SL: ["sri lanka"], BAN: ["bangladesh"], AFG: ["afghanistan"],
    ZIM: ["zimbabwe"], IRE: ["ireland"], SCO: ["scotland"],
    NED: ["netherlands"], NAM: ["namibia"], UAE: ["united arab emirates", "uae"],
    USA: ["united states", "u.s.a"], NEP: ["nepal"], CAN: ["canada"], ITA: ["italy"],
  };

  const t1Names = teamNameMap[t1] || [t1.toLowerCase()];
  const t2Names = teamNameMap[t2] || [t2.toLowerCase()];

  const match = events.find(e => {
    const home = (e.event_home_team || "").toLowerCase();
    const away = (e.event_away_team || "").toLowerCase();
    const t1Found = t1Names.some(n => home.includes(n) || away.includes(n));
    const t2Found = t2Names.some(n => home.includes(n) || away.includes(n));
    return t1Found && t2Found;
  });

  if (!match || !match.scorecard) return null;

  const inningsKeys = Object.keys(match.scorecard);
  if (inningsKeys.length === 0) return null;

  const score: Array<{ r: number; w: number; o: number; inning: string }> = [];
  const innings: Array<{
    inning: string;
    batting: Array<{ name: string; r: number; b: number; fours: number; sixes: number; sr: number; dismissal: string }>;
    bowling: Array<{ name: string; o: number; m: number; r: number; w: number; eco: number }>;
  }> = [];

  for (const innKey of inningsKeys) {
    const players = match.scorecard[innKey];
    if (!players || !Array.isArray(players)) continue;

    const batsmen = players.filter(p => p.type === "Batsman");
    const bowlers = players.filter(p => p.type === "Bowler");

    const totalRuns = batsmen.reduce((sum, b) => sum + parseInt(b.R || "0"), 0);
    const totalWickets = bowlers.reduce((sum, b) => sum + parseInt(b.W || "0"), 0);
    let totalBalls = 0;
    for (const b of bowlers) {
      const ov = parseFloat(b.O || "0");
      const fullOvers = Math.floor(ov);
      const partialBalls = Math.round((ov - fullOvers) * 10);
      totalBalls += fullOvers * 6 + partialBalls;
    }
    const totalOvers = Math.floor(totalBalls / 6) + (totalBalls % 6) / 10;

    score.push({ r: totalRuns, w: totalWickets, o: totalOvers, inning: innKey });

    innings.push({
      inning: innKey,
      batting: batsmen.map(b => ({
        name: b.player,
        r: parseInt(b.R || "0"),
        b: parseInt(b.B || "0"),
        fours: parseInt(b["4s"] || "0"),
        sixes: parseInt(b["6s"] || "0"),
        sr: parseFloat(b.SR || "0"),
        dismissal: b.status || "not out",
      })),
      bowling: bowlers.map(b => ({
        name: b.player,
        o: parseFloat(b.O || "0"),
        m: parseInt(b.M || "0"),
        r: parseInt(b.R || "0"),
        w: parseInt(b.W || "0"),
        eco: parseFloat(b.ER || "0"),
      })),
    });
  }

  return {
    score,
    innings,
    status: match.event_status || match.event_status_info || "",
  };
}

export async function calculatePointsFromApiCricket(
  dbMatchId: string,
  team1Short: string,
  team2Short: string,
  matchDate?: string
): Promise<Map<string, number>> {
  const { storage } = await import("./storage");
  const pointsMap = new Map<string, number>();

  const scorecard = await fetchApiCricketScorecard(team1Short, team2Short, matchDate);
  if (!scorecard) return pointsMap;

  const dbPlayers = await storage.getPlayersForMatch(dbMatchId);

  const catchCountMap = new Map<string, number>();

  for (const inn of scorecard.innings) {
    for (const bat of inn.batting) {
      const found = dbPlayers.find(p => playerNameMatch(bat.name, p.name));
      if (found && found.externalId) {
        const existing = pointsMap.get(found.externalId) || 0;
        let pts = 0;
        pts += bat.r;
        pts += bat.fours;
        pts += bat.sixes * 2;
        if (bat.r >= 100) pts += 16;
        if (bat.r >= 50) pts += 8;
        if (bat.r >= 30) pts += 4;
        if (bat.r === 0 && bat.b > 0) pts -= 2;
        if (bat.b >= 10) {
          if (bat.sr > 170) pts += 6;
          else if (bat.sr > 150) pts += 4;
          else if (bat.sr >= 130) pts += 2;
          else if (bat.sr >= 60 && bat.sr < 70) pts -= 2;
          else if (bat.sr >= 50 && bat.sr < 60) pts -= 4;
          else if (bat.sr < 50) pts -= 6;
        }
        pointsMap.set(found.externalId, existing + pts);
      }

      const d = (bat.dismissal || "").toLowerCase();
      if (d.startsWith("lbw") || d.startsWith("b ")) {
        for (const bowl of inn.bowling) {
          const bowlerPlayer = dbPlayers.find(p => playerNameMatch(bowl.name, p.name));
          if (bowlerPlayer && bowlerPlayer.externalId && d.includes(bowl.name.toLowerCase())) {
            const existing = pointsMap.get(bowlerPlayer.externalId) || 0;
            pointsMap.set(bowlerPlayer.externalId, existing + 8);
          }
        }
      }

      if (d.includes("c ")) {
        const catcherName = d.replace(/^c\s+/, "").split(" b ")[0].trim();
        if (catcherName) {
          const catcherPlayer = dbPlayers.find(p => playerNameMatch(catcherName, p.name));
          if (catcherPlayer && catcherPlayer.externalId) {
            const existing = pointsMap.get(catcherPlayer.externalId) || 0;
            pointsMap.set(catcherPlayer.externalId, existing + 8);
            const prevCatches = catchCountMap.get(catcherPlayer.externalId) || 0;
            catchCountMap.set(catcherPlayer.externalId, prevCatches + 1);
          }
        }
      }

      if (d.includes("st ")) {
        const stumpName = d.replace(/^.*st\s+/, "").split(" b ")[0].trim();
        if (stumpName) {
          const stumperPlayer = dbPlayers.find(p => playerNameMatch(stumpName, p.name));
          if (stumperPlayer && stumperPlayer.externalId) {
            const existing = pointsMap.get(stumperPlayer.externalId) || 0;
            pointsMap.set(stumperPlayer.externalId, existing + 12);
          }
        }
      }

      if (d.includes("run out")) {
        const roMatch = d.match(/run out\s*\(([^)]+)\)/i);
        if (roMatch) {
          const names = roMatch[1].split("/").map(n => n.trim());
          if (names.length === 1) {
            const roPlayer = dbPlayers.find(p => playerNameMatch(names[0], p.name));
            if (roPlayer && roPlayer.externalId) {
              const existing = pointsMap.get(roPlayer.externalId) || 0;
              pointsMap.set(roPlayer.externalId, existing + 12);
            }
          } else if (names.length >= 2) {
            const thrower = dbPlayers.find(p => playerNameMatch(names[0], p.name));
            if (thrower && thrower.externalId) {
              const existing = pointsMap.get(thrower.externalId) || 0;
              pointsMap.set(thrower.externalId, existing + 6);
            }
            const collector = dbPlayers.find(p => playerNameMatch(names[names.length - 1], p.name));
            if (collector && collector.externalId) {
              const existing = pointsMap.get(collector.externalId) || 0;
              pointsMap.set(collector.externalId, existing + 6);
            }
          }
        }
      }
    }

    for (const bowl of inn.bowling) {
      const found = dbPlayers.find(p => playerNameMatch(bowl.name, p.name));
      if (found && found.externalId) {
        const existing = pointsMap.get(found.externalId) || 0;
        let pts = 0;
        pts += bowl.w * 30;
        if (bowl.w >= 5) pts += 16;
        if (bowl.w >= 4) pts += 8;
        if (bowl.w >= 3) pts += 4;
        if (bowl.m > 0) pts += bowl.m * 12;
        const totalOvers = bowl.o;
        if (totalOvers >= 2) {
          if (bowl.eco < 5) pts += 6;
          else if (bowl.eco >= 5 && bowl.eco < 6) pts += 4;
          else if (bowl.eco >= 6 && bowl.eco <= 7) pts += 2;
          else if (bowl.eco >= 10 && bowl.eco <= 11) pts -= 2;
          else if (bowl.eco > 11 && bowl.eco <= 12) pts -= 4;
          else if (bowl.eco > 12) pts -= 6;
        }
        pointsMap.set(found.externalId, existing + pts);
      }
    }
  }

  for (const [externalId, catches] of catchCountMap) {
    if (catches >= 3) {
      const existing = pointsMap.get(externalId) || 0;
      pointsMap.set(externalId, existing + 4);
    }
  }

  if (pointsMap.size > 0) {
    console.log(`api-cricket.com points: calculated for ${pointsMap.size} players in match ${dbMatchId}`);
  }

  return pointsMap;
}
