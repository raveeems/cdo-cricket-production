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
    const url = `${CRICKET_API_BASE}/matches?apikey=${apiKey}&offset=0`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Cricket API error:", res.status, res.statusText);
      return [];
    }

    const json = (await res.json()) as CricApiResponse<CricApiMatch[]>;
    if (json.status !== "success" || !json.data) {
      console.error("Cricket API returned non-success:", json.status);
      return [];
    }

    console.log(
      `Cricket API: fetched ${json.data.length} matches, hits used: ${json.info?.hitsUsed}/${json.info?.hitsLimit}`
    );

    return json.data
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
