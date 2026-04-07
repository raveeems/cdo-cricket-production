const CRICKET_API_BASE = "https://api.cricapi.com/v1";

let dailyApiCalls = 0;
let dailyApiCallDate = "";
let tier1BlockedUntil = 0;

type BowlingState = { o: number; r: number; w: number };
const scorecardStateCache = new Map<string, Map<string, BowlingState>>();

function detectDotBalls(externalId: string, bowlerName: string, newBowling: any): number {
  if (!newBowling || typeof newBowling.o !== "number") return 0;
  
  const cacheKey = externalId;
  let matchCache = scorecardStateCache.get(cacheKey);
  if (!matchCache) {
    matchCache = new Map();
    scorecardStateCache.set(cacheKey, matchCache);
  }

  const previousState = matchCache.get(bowlerName);
  const currentState = { o: newBowling.o, r: newBowling.r, w: newBowling.w };

  if (previousState) {
    const newBalls = Math.floor(currentState.o) * 6 + Math.round((currentState.o % 1) * 10);
    const oldBalls = Math.floor(previousState.o) * 6 + Math.round((previousState.o % 1) * 10);
    const ballsThrown = newBalls - oldBalls;
    const runsGiven = currentState.r - previousState.r;
    const dots = Math.max(0, ballsThrown - runsGiven);
    
    matchCache.set(bowlerName, currentState);
    return dots;
  }

  matchCache.set(bowlerName, currentState);
  return 0;
}

async function trackApiCall(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (dailyApiCallDate !== today) {
      dailyApiCalls = 0;
      dailyApiCallDate = today;
    }
    dailyApiCalls++;
    const { storage } = await import("./storage");
    const count = await storage.incrementApiCallCount();
    dailyApiCalls = count;
  } catch (e) {
    console.error("[API Tracker] Failed to track call:", e);
  }
}

export function getInMemoryApiCallCount(): number {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyApiCallDate !== today) return 0;
  return dailyApiCalls;
}

function markTier1Blocked(): void {
  tier1BlockedUntil = Date.now() + 60 * 60 * 1000;
  console.log("[CricAPI] Tier 1 key blocked, switching to Tier 2 for 1 hour");
}

async function trackedFetch(url: string, init?: RequestInit): Promise<Response> {
  await trackApiCall();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getActiveApiKey(): string | undefined {
  const now = Date.now();
  const primary = process.env.CRICKET_API_KEY;
  if (primary && now > tier1BlockedUntil) return primary;
  const fallback = process.env.CRICAPI_KEY_TIER2;
  if (fallback) {
    if (now <= tier1BlockedUntil) {
      console.log("[CricAPI] Using Tier 2 fallback key (Tier 1 blocked)");
    } else {
      console.log("[CricAPI] Using Tier 2 fallback key");
    }
    return fallback;
  }
  if (primary) return primary;
  return undefined;
}

async function cricApiFetch<T>(path: string, extraParams: string = ""): Promise<{ data: T | null; info?: any; usedTier: number }> {
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    console.log("[CricAPI] No API key available");
    return { data: null, usedTier: 0 };
  }

  try {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${CRICKET_API_BASE}/${path}${sep}apikey=${apiKey}${extraParams ? "&" + extraParams : ""}`;
    const res = await trackedFetch(url);
    if (!res.ok) {
      console.error(`[CricAPI] HTTP ${res.status} for ${path}`);
      return { data: null, usedTier: 1 };
    }
    const json = await res.json() as any;

    if (json.status === "failure" || json.status === "error") {
      const msg = (json.reason || json.message || "").toLowerCase();
      if (msg.includes("limit") || msg.includes("quota") || msg.includes("blocked") || msg.includes("exceed")) {
        console.log(`[CricAPI] Quota issue: ${json.reason || json.message}`);
      }
    }

    if (json.info) {
      console.log(`[CricAPI] ${path.split("?")[0]}: hits ${json.info.hitsUsed || json.info.hitsToday}/${json.info.hitsLimit}`);
    }
    return { data: json.data ?? json, info: json.info, usedTier: 1 };
  } catch (e: any) {
    console.error(`[CricAPI] Fetch error for ${path}:`, e.message);
    return { data: null, usedTier: 0 };
  }
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

// Authoritative team-name → short-code mapping.
// These codes are used as the ground truth for all IPL and major international
// teams. CricAPI occasionally returns wrong or inconsistent shortnames (e.g.
// "RCBW" for the Royal Challengers Bengaluru men's squad). By keeping this
// mapping authoritative we ensure logos, colors, player grouping, and display
// labels are always correct regardless of what the upstream API sends.
const KNOWN_TEAM_CODES: Record<string, string> = {
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

// Generates an initials-based fallback code for teams not in KNOWN_TEAM_CODES.
function getTeamShort(fullName: string): string {
  if (KNOWN_TEAM_CODES[fullName]) return KNOWN_TEAM_CODES[fullName];

  const words = fullName.split(" ");
  if (words.length === 1) return fullName.substring(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .substring(0, 4);
}

// Single normalization point for all team short-code resolution.
// For teams in KNOWN_TEAM_CODES, our mapping always wins — the API shortname
// is treated as untrusted (CricAPI has known data quality issues such as
// returning "RCBW" for the RCB men's squad).
// For unknown teams (not in KNOWN_TEAM_CODES), the API shortname is used if
// provided, otherwise we fall back to initials generation.
function resolveTeamShort(teamName: string, apiShortname?: string): string {
  if (KNOWN_TEAM_CODES[teamName]) return KNOWN_TEAM_CODES[teamName];
  return apiShortname || getTeamShort(teamName);
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
      `${CRICKET_API_BASE}/matches?apikey=${apiKey}&offset=50`,
    ];

    for (const url of endpoints) {
      try {
        const res = await trackedFetch(url);
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
        const team1Short = resolveTeamShort(team1, team1Info?.shortname);
        const team2Short = resolveTeamShort(team2, team2Info?.shortname);

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


export async function fetchSeriesList(): Promise<
  Array<{ id: string; name: string; startDate: string }>
> {
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];

  const results: Array<{ id: string; name: string; startDate: string }> = [];
  const seen = new Set<string>();

  for (const offset of [0, 25]) {
    try {
      const url = `${CRICKET_API_BASE}/series?apikey=${apiKey}&offset=${offset}`;
      const res = await trackedFetch(url);
      if (!res.ok) continue;

      const json = (await res.json()) as CricApiResponse<
        Array<{ id: string; name: string; startDate: string; endDate: string }>
      >;

      if (json.status !== "success" || !json.data) {
        const reason = ((json as any).reason || "").toLowerCase();
        if (reason.includes("limit") || reason.includes("quota") || reason.includes("blocked")) {
          markTier1Blocked();
        }
        continue;
      }

      console.log(`Series List API: fetched ${json.data.length} series at offset=${offset}, hits: ${json.info?.hitsUsed}/${json.info?.hitsLimit}`);

      for (const s of json.data) {
        if (s.id && !seen.has(s.id)) {
          seen.add(s.id);
          results.push({ id: s.id, name: s.name || "", startDate: s.startDate || "" });
        }
      }
    } catch (_) {
      continue;
    }
  }

  return results;
}

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
    const res = await trackedFetch(url);
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
      console.warn(`Series Info API non-success for ${seriesName}: status=${json.status} reason="${reason}"`);
      if (reason.includes("limit") || reason.includes("quota") || reason.includes("blocked")) {
        markTier1Blocked();
      }
      return [];
    }

    console.log(`Series Info API: fetched ${json.data.matchList.length} matches for ${seriesName}, hits: ${json.info?.hitsUsed}/${json.info?.hitsLimit}`);

    return json.data.matchList
      .filter((m) => m.teams && m.teams.length >= 2 && m.dateTimeGMT)
      .map((m) => {
        const team1 = m.teams[0];
        const team2 = m.teams[1];
        const team1Info = m.teamInfo?.find((t) => t.name === team1);
        const team2Info = m.teamInfo?.find((t) => t.name === team2);
        const team1Short = resolveTeamShort(team1, team1Info?.shortname);
        const team2Short = resolveTeamShort(team2, team2Info?.shortname);

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

// ─── IPL preview: ensure next-5 upcoming IPL fixtures are in DB for Home display ───
const IPL_2026_SERIES_ID_PREVIEW = "87c62aac-bc3c-4738-ab93-19da0690488f";

// Hardcoded IPL 2026 schedule (verified 2026-03-24 via CricAPI series_info).
// Used as fallback when series_info endpoint is unavailable (subscription tier / outage).
const IPL_2026_HARDCODED: Array<{
  externalId: string; seriesId: string;
  team1: string; team1Short: string; team2: string; team2Short: string; dateTimeGMT: string;
}> = [
  { externalId: "55fe0f15-6eb0-4ad5-835b-5564be4f6a21", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Royal Challengers Bengaluru", team1Short: "RCB", team2: "Sunrisers Hyderabad", team2Short: "SRH", dateTimeGMT: "2026-03-28T14:00:00" },
  { externalId: "e02475c1-8f9a-4915-a9e8-d4dbc3441c96", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Mumbai Indians", team1Short: "MI", team2: "Kolkata Knight Riders", team2Short: "KKR", dateTimeGMT: "2026-03-29T14:00:00" },
  { externalId: "d788e9f9-99bf-4650-a035-92a7e21b3d08", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Rajasthan Royals", team1Short: "RR", team2: "Chennai Super Kings", team2Short: "CSK", dateTimeGMT: "2026-03-30T14:00:00" },
  { externalId: "11ff7db9-9c71-464e-afcb-5b03e4fa4b0a", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Punjab Kings", team1Short: "PBKS", team2: "Gujarat Titans", team2Short: "GT", dateTimeGMT: "2026-03-31T14:00:00" },
  { externalId: "ae676d7c-3082-489c-96c5-5620f393c900", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Lucknow Super Giants", team1Short: "LSG", team2: "Delhi Capitals", team2Short: "DC", dateTimeGMT: "2026-04-01T14:00:00" },
  { externalId: "fd010e39-2255-4460-b0e0-962a26b67b70", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Kolkata Knight Riders", team1Short: "KKR", team2: "Sunrisers Hyderabad", team2Short: "SRH", dateTimeGMT: "2026-04-02T14:00:00" },
  { externalId: "96d2aa6b-ea40-4da4-b4cf-eb996de24ef7", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Chennai Super Kings", team1Short: "CSK", team2: "Punjab Kings", team2Short: "PBKS", dateTimeGMT: "2026-04-03T14:00:00" },
  { externalId: "736f3e02-212a-49bc-8b3b-08a106312702", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Delhi Capitals", team1Short: "DC", team2: "Mumbai Indians", team2Short: "MI", dateTimeGMT: "2026-04-04T10:00:00" },
  { externalId: "ea4d01bf-bf47-4f7d-a4f8-32eade678141", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Gujarat Titans", team1Short: "GT", team2: "Rajasthan Royals", team2Short: "RR", dateTimeGMT: "2026-04-04T14:00:00" },
  { externalId: "e43dd29e-c60e-40c9-a6c4-6c1bd69dd671", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Sunrisers Hyderabad", team1Short: "SRH", team2: "Lucknow Super Giants", team2Short: "LSG", dateTimeGMT: "2026-04-05T10:00:00" },
  { externalId: "e92727d0-61fc-4c6f-82ed-cde4789745a2", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Royal Challengers Bengaluru", team1Short: "RCB", team2: "Chennai Super Kings", team2Short: "CSK", dateTimeGMT: "2026-04-05T14:00:00" },
  { externalId: "adeebb28-bc39-439b-99ed-2daef5106232", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Kolkata Knight Riders", team1Short: "KKR", team2: "Punjab Kings", team2Short: "PBKS", dateTimeGMT: "2026-04-06T14:00:00" },
  { externalId: "4f617f5e-c635-4989-b135-5430dc73c5d7", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Rajasthan Royals", team1Short: "RR", team2: "Mumbai Indians", team2Short: "MI", dateTimeGMT: "2026-04-07T14:00:00" },
  { externalId: "12496498-8526-46d9-a053-da2ba8d047e1", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Delhi Capitals", team1Short: "DC", team2: "Gujarat Titans", team2Short: "GT", dateTimeGMT: "2026-04-08T14:00:00" },
  { externalId: "c78dcc8a-67cf-460a-8f2b-8f16d3891682", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Kolkata Knight Riders", team1Short: "KKR", team2: "Lucknow Super Giants", team2Short: "LSG", dateTimeGMT: "2026-04-09T14:00:00" },
  { externalId: "05a88a74-0e68-47d9-996b-257b3b1ebf8d", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Rajasthan Royals", team1Short: "RR", team2: "Royal Challengers Bengaluru", team2Short: "RCB", dateTimeGMT: "2026-04-10T14:00:00" },
  { externalId: "a4cd9851-d79a-42b6-8a4b-b35cbb9f9f0a", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Punjab Kings", team1Short: "PBKS", team2: "Sunrisers Hyderabad", team2Short: "SRH", dateTimeGMT: "2026-04-11T10:00:00" },
  { externalId: "204afd0a-026a-41f4-afda-653030a84e46", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Chennai Super Kings", team1Short: "CSK", team2: "Delhi Capitals", team2Short: "DC", dateTimeGMT: "2026-04-11T14:00:00" },
  { externalId: "36d875e2-3333-4fab-ba4d-4f89fb4d7055", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Lucknow Super Giants", team1Short: "LSG", team2: "Gujarat Titans", team2Short: "GT", dateTimeGMT: "2026-04-12T10:00:00" },
  { externalId: "11d553de-3b2a-4e58-9abd-4bb7d575595e", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Mumbai Indians", team1Short: "MI", team2: "Royal Challengers Bengaluru", team2Short: "RCB", dateTimeGMT: "2026-04-12T14:00:00" },
];

function buildIPLFixturesFromHardcoded() {
  return IPL_2026_HARDCODED.map(f => ({
    externalId: f.externalId,
    seriesId: f.seriesId,
    team1: f.team1,
    team1Short: f.team1Short,
    team1Color: getTeamColor(f.team1Short),
    team2: f.team2,
    team2Short: f.team2Short,
    team2Color: getTeamColor(f.team2Short),
    venue: "",
    startTime: new Date(f.dateTimeGMT),
    status: "upcoming" as const,
    statusNote: "",
    league: "Indian Premier League 2026",
  }));
}

let _iplPreviewCache: {
  data: Array<{
    externalId: string; seriesId: string; team1: string; team1Short: string;
    team1Color: string; team2: string; team2Short: string; team2Color: string;
    venue: string; startTime: Date; status: string; statusNote: string; league: string;
  }>;
  expiresAt: number;
} | null = null;
const IPL_PREVIEW_TTL_MS = 15 * 60 * 1000;

async function getCachedIPLSeriesMatches() {
  if (_iplPreviewCache && Date.now() < _iplPreviewCache.expiresAt) {
    return _iplPreviewCache.data;
  }
  console.log("[IPL Preview] Fetching IPL 2026 series fixtures (cache miss)...");
  const apiKey = getActiveApiKey();
  console.log("[IPL Preview] API key available:", !!apiKey);
  const data = await fetchSeriesMatches(IPL_2026_SERIES_ID_PREVIEW, "Indian Premier League 2026");
  console.log(`[IPL Preview] Series fetch returned ${data.length} fixtures`);

  if (data.length > 0) {
    // API success: cache for full 15 minutes
    _iplPreviewCache = { data, expiresAt: Date.now() + IPL_PREVIEW_TTL_MS };
    return data;
  }

  // API failed or returned empty — use hardcoded IPL 2026 schedule as fallback.
  // Retry the API every 2 minutes in case the key is updated or outage clears.
  console.log("[IPL Preview] API returned 0 fixtures — using hardcoded IPL 2026 fallback");
  const fallback = buildIPLFixturesFromHardcoded();
  _iplPreviewCache = { data: fallback, expiresAt: Date.now() + 2 * 60 * 1000 };
  return fallback;
}

/**
 * Ensures the next 5 upcoming IPL fixtures (from the series API) are in the DB
 * so they appear on the Home screen without waiting for the 48-hour auto-sync.
 * The 48-hour syncMatchesFromApi() mechanism is completely unchanged.
 * Returns any newly created Match objects so the caller can merge them immediately.
 */
export async function ensureIPLPreviewMatches(existingMatches: any[]): Promise<any[]> {
  const nowMs = Date.now();
  let seriesMatches: Awaited<ReturnType<typeof getCachedIPLSeriesMatches>>;
  try {
    seriesMatches = await getCachedIPLSeriesMatches();
  } catch (e) {
    console.error("IPL preview: series fetch failed", e);
    return [];
  }

  const next5 = seriesMatches
    .filter(m => new Date(m.startTime).getTime() > nowMs && m.status === "upcoming")
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  if (next5.length === 0) return [];

  const { storage } = await import("./storage");
  const newMatches: any[] = [];

  for (const m of next5) {
    if (existingMatches.some(e => e.externalId === m.externalId)) continue;
    // Secondary dedup: same teams + same day (guards against CricAPI externalId drift)
    const mDay = new Date(m.startTime).toISOString().split('T')[0];
    const sameTeamDay = existingMatches.find(e => {
      const eDay = new Date(e.startTime).toISOString().split('T')[0];
      if (eDay !== mDay) return false;
      return (
        (e.team1Short === m.team1Short && e.team2Short === m.team2Short) ||
        (e.team1Short === m.team2Short && e.team2Short === m.team1Short)
      );
    });
    if (sameTeamDay) {
      if (sameTeamDay.externalId !== m.externalId) {
        console.log(`IPL preview: externalId drift for ${m.team1} vs ${m.team2} (${mDay}) — updating ${sameTeamDay.externalId} → ${m.externalId}`);
        await storage.updateMatch(sameTeamDay.id, { externalId: m.externalId } as any);
      }
      continue;
    }
    try {
      const created = await storage.createMatch({
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
      console.log(`IPL preview: auto-imported ${m.team1} vs ${m.team2} (${m.externalId})`);
      newMatches.push(created);
    } catch (e) {
      console.error(`IPL preview: failed to import ${m.externalId}`, e);
    }
  }

  return newMatches;
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
    // Primary dedup: exact externalId match
    let dup = existingMatches.find((e) => e.externalId === m.externalId);

    // Secondary dedup: same teams (either order) on the same calendar day.
    // Guards against CricAPI silently reassigning a new externalId to an existing match,
    // which would otherwise cause a duplicate row in the DB.
    if (!dup) {
      const mDay = m.startTime.toISOString().split('T')[0];
      dup = existingMatches.find((e) => {
        const eDay = new Date(e.startTime).toISOString().split('T')[0];
        if (eDay !== mDay) return false;
        return (
          (e.team1Short === m.team1Short && e.team2Short === m.team2Short) ||
          (e.team1Short === m.team2Short && e.team2Short === m.team1Short)
        );
      }) ?? null;
      if (dup) {
        console.log(`Match ${m.team1} vs ${m.team2} (${mDay}): externalId drift — updating ${dup.externalId} → ${m.externalId}`);
        await storage.updateMatch(dup.id, { externalId: m.externalId } as any);
        dup = { ...dup, externalId: m.externalId };
      }
    }

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
      if (m.team1 !== "Tbc" && dup.team1 !== m.team1) { updates.team1 = m.team1; updates.team1Short = m.team1Short; updates.team1Color = m.team1Color; }
      if (m.team2 !== "Tbc" && dup.team2 !== m.team2) { updates.team2 = m.team2; updates.team2Short = m.team2Short; updates.team2Color = m.team2Color; }
      if (Object.keys(updates).length > 0) {
        await storage.updateMatch(dup.id, updates);
        console.log(`Match ${m.team1} vs ${m.team2}: updated [${Object.keys(updates).join(', ')}]`);
        updated++;
      }
    }
  }

  return { created, updated };
}

export async function syncMatchesFromApi(): Promise<void> {
  const { storage } = await import("./storage");
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    console.log("No CricAPI key available, skipping auto-sync");
    return;
  }

  console.log("Auto-syncing matches (IPL only)...");
  try {
    const existing = await storage.getAllMatches();

    // Try currentMatches first, fall back to upcoming matches endpoint
    const allApiRaw: CricApiMatch[] = [];
    const seenIds = new Set<string>();

    for (const url of [
      `${CRICKET_API_BASE}/currentMatches?apikey=${apiKey}&offset=0`,
      `${CRICKET_API_BASE}/matches?apikey=${apiKey}&offset=0`,
    ]) {
      try {
        const res = await trackedFetch(url);
        if (!res.ok) continue;
        const json = (await res.json()) as CricApiResponse<CricApiMatch[]>;
        if (json.status !== "success" || !json.data) {
          const reason = (json as any).reason || "";
          if (reason.toLowerCase().includes("limit") || reason.toLowerCase().includes("blocked")) {
            markTier1Blocked();
            break;
          }
          continue;
        }
        const label = url.includes("currentMatches") ? "currentMatches" : "matches";
        console.log(`Auto-sync: ${json.data.length} matches from ${label}, hits: ${json.info?.hitsUsed}/${json.info?.hitsLimit}`);
        for (const m of json.data) {
          if (!seenIds.has(m.id)) { seenIds.add(m.id); allApiRaw.push(m); }
        }
      } catch (e) {
        console.error("Auto-sync endpoint error:", e);
      }
    }

    if (allApiRaw.length === 0) {
      console.log("Auto-sync: no matches returned from API");
      return;
    }

    const isIPL = (m: CricApiMatch) => {
      const name = (m.name || "").toLowerCase();
      const series = (m.series_id || "").toLowerCase();
      return name.includes("indian premier league") || name.includes(" ipl") || series.includes("ipl");
    };

    const apiMatches = allApiRaw
      .filter((m) => m.teams && m.teams.length >= 2 && m.dateTimeGMT && m.matchType === "t20" && isIPL(m))
      .map((m) => {
        const team1 = m.teams[0];
        const team2 = m.teams[1];
        const team1Info = m.teamInfo?.find((t) => t.name === team1);
        const team2Info = m.teamInfo?.find((t) => t.name === team2);
        const team1Short = resolveTeamShort(team1, team1Info?.shortname);
        const team2Short = resolveTeamShort(team2, team2Info?.shortname);

        const hasScoreData = !!(m.score && m.score.length > 0 && m.score.some(s => s.r > 0 || s.w > 0 || s.o > 0));
        const { status, statusNote } = determineMatchStatus(
          m.matchStarted,
          m.matchEnded,
          m.status,
          hasScoreData
        );

        const nameParts = m.name?.split(",").map((s: string) => s.trim()) || [];
        let league = nameParts[nameParts.length - 1] || nameParts[0] || "";
        if (nameParts.length >= 3) league = nameParts.slice(2).join(", ");
        else if (nameParts.length === 2) league = nameParts[1];

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

    if (apiMatches.length === 0) {
      console.log("Auto-sync: no T20 matches to sync");
      return;
    }

    const result = await upsertMatches(apiMatches, existing);
    console.log(`Auto-sync complete: ${result.created} new, ${result.updated} updated (${apiMatches.length} IPL matches from API)`);
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
    const res = await trackedFetch(url);
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
    const res = await trackedFetch(url);
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
        const recalc = (globalThis as any).__recalculateTeamTotals;
        if (recalc) {
          await recalc(match.id, `${match.team1Short} vs ${match.team2Short}`);
        }
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

// ---------------------------------------------------------------------------
// mergeMatchDuplicates
// ---------------------------------------------------------------------------
// CricAPI sometimes retires an externalId and creates a new one for the same
// physical match. This function detects those duplicate rows in our DB and
// automatically merges them:
//   - keeps the "primary" match (the one with more teams joined, or the older row)
//   - copies externalId + status + statusNote from the duplicate onto the primary
//   - nulls the duplicate's externalId so refreshStaleMatchStatuses ignores it
//   - deletes the duplicate if it has zero teams; otherwise just disables it
//
// Called at server startup AND inside the periodic 2-hour sync so future
// externalId drifts are healed automatically without any admin action.
export async function mergeMatchDuplicates(): Promise<number> {
  const { storage } = await import("./storage");
  const allMatches = await storage.getAllMatches();

  // Group matches by a canonical team-pair key (sorted alphabetically so order
  // doesn't matter) so we catch both "MI vs RR" and "RR vs MI" variations.
  const groups = new Map<string, typeof allMatches>();
  for (const m of allMatches) {
    const t1 = (m as any).team1Short as string;
    const t2 = (m as any).team2Short as string;
    const key = [t1, t2].sort().join("_");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  let mergeCount = 0;

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    // Within this group, find pairs whose startTimes are within ±3 days of
    // each other.  3 days is wide enough to survive timezone/API drift while
    // still being strict enough to avoid confusing genuinely separate fixtures.
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i] as any;
        const b = group[j] as any;
        const timeDiff = Math.abs(
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
        if (timeDiff > THREE_DAYS) continue;

        // Get team counts to determine which match is the "primary"
        const aTeams = await storage.getAllTeamsForMatch(a.id);
        const bTeams = await storage.getAllTeamsForMatch(b.id);

        // primary = more teams (or older id if tied)
        let primary = aTeams.length >= bTeams.length ? a : b;
        let secondary = primary === a ? b : a;

        // If the secondary has a non-null externalId that differs from the
        // primary's, copy it over so refreshStaleMatchStatuses uses the live ID.
        const updates: Record<string, any> = {};
        if (
          (secondary as any).externalId &&
          (secondary as any).externalId !== (primary as any).externalId
        ) {
          updates.externalId = (secondary as any).externalId;
          console.log(
            `[MergeDup] ${a.team1Short} vs ${a.team2Short}: externalId drift — ` +
            `updating primary ${(primary as any).externalId} → ${(secondary as any).externalId}`
          );
        }

        // Promote status if secondary is further along (delayed > upcoming, completed > delayed, etc.)
        const statusRank: Record<string, number> = { upcoming: 0, delayed: 1, live: 2, completed: 3 };
        const pRank = statusRank[(primary as any).status] ?? 0;
        const sRank = statusRank[(secondary as any).status] ?? 0;
        if (sRank > pRank) {
          updates.status = (secondary as any).status;
          if ((secondary as any).statusNote) updates.statusNote = (secondary as any).statusNote;
        }

        if (Object.keys(updates).length > 0) {
          await storage.updateMatch((primary as any).id, updates);
        }

        // Disable the secondary so the heartbeat ignores it
        await storage.updateMatch((secondary as any).id, { externalId: null } as any);

        const secondaryTeamCount = secondary === a ? aTeams.length : bTeams.length;
        if (secondaryTeamCount === 0) {
          await storage.deleteMatch((secondary as any).id);
          console.log(
            `[MergeDup] ${a.team1Short} vs ${a.team2Short}: deleted empty duplicate ${(secondary as any).id}`
          );
        } else {
          console.log(
            `[MergeDup] ${a.team1Short} vs ${a.team2Short}: disabled duplicate ${(secondary as any).id} ` +
            `(has ${secondaryTeamCount} team(s) — delete manually after review)`
          );
        }

        mergeCount++;
      }
    }
  }

  if (mergeCount > 0) {
    console.log(`[MergeDup] Fixed ${mergeCount} duplicate match pair(s).`);
  }
  return mergeCount;
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
    const res = await trackedFetch(url);
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
          teamShort: resolveTeamShort(team.teamName, team.shortname),
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
    const res = await trackedFetch(url);
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
    const res = await trackedFetch(url);
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
          teamShort: resolveTeamShort(team.teamName, team.shortname),
          role,
          credits: assignCredits(role),
        });
      }
    }

    // If match_squad returned players, return them
    if (allPlayers.length > 0) return allPlayers;

    // Fallback: try match_info which has teamInfo[].players[] — works for live matches
    console.log(`[fetchMatchSquad] match_squad returned 0 for ${externalMatchId}, trying match_info fallback...`);
    const infoApiKey = getActiveApiKey();
    if (!infoApiKey) return [];
    const infoUrl = `${CRICKET_API_BASE}/match_info?apikey=${infoApiKey}&id=${externalMatchId}`;
    const infoRes = await trackedFetch(infoUrl);
    if (!infoRes.ok) return [];
    const infoJson = await infoRes.json() as any;
    if (infoJson.status !== "success" || !infoJson.data) return [];

    const infoPlayers: typeof allPlayers = [];
    const teamInfo: any[] = infoJson.data.teamInfo || [];
    for (const team of teamInfo) {
      const teamName: string = team.name || "";
      const teamShort: string = resolveTeamShort(teamName, team.shortname);
      // teamInfo.players[] if present (full squad from match_info)
      const teamPlayers: any[] = team.players || [];
      for (const p of teamPlayers) {
        if (!p.id || !p.name) continue;
        const role = mapCricApiRole(p.role || "");
        infoPlayers.push({
          externalId: p.id,
          name: p.name,
          team: teamName,
          teamShort,
          role,
          credits: assignCredits(role),
        });
      }
    }

    if (infoPlayers.length > 0) {
      console.log(`[fetchMatchSquad] match_info fallback: found ${infoPlayers.length} players for ${externalMatchId}`);
    }
    return infoPlayers;
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
  dots?: number;
  wd?: number;
  nb?: number;
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
  status?: string;
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
    // ===== BATTING =====
    const bat = inning.batting?.find((b) => b.batsman?.id === playerId);
    if (bat) {
      points += bat.r;
      points += bat["4s"] * 4;
      points += bat["6s"] * 6;

      if (bat.r >= 100) points += 16;
      else if (bat.r >= 75) points += 12;
      else if (bat.r >= 50) points += 8;
      else if (bat.r >= 25) points += 4;

      if (bat.r === 0 && bat.b > 0 && bat.dismissal) points -= 2;

      if (bat.b >= 10) {
        if (bat.sr > 170) points += 6;
        else if (bat.sr > 150) points += 4;
        else if (bat.sr >= 130) points += 2;
        else if (bat.sr <= 70 && bat.sr >= 60) points -= 2;
        else if (bat.sr < 60 && bat.sr >= 50) points -= 4;
        else if (bat.sr < 50) points -= 6;
      }
    }

    // ===== BOWLING =====
    const bowl = inning.bowling?.find((b) => b.bowler?.id === playerId);
    if (bowl) {
      points += bowl.w * 30;
      if (bowl.w >= 5) points += 16;
      else if (bowl.w >= 4) points += 8;
      else if (bowl.w >= 3) points += 4;
      if (bowl.m > 0) points += bowl.m * 12;

      const dotBalls = typeof bowl.dots === "number" ? bowl.dots : 0;
      points += dotBalls * 1;

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

    // ===== FIELDING: CATCHES =====
    const catcher = inning.catching?.find((c) => c.catcher?.id === playerId);
    if (catcher) {
      const catches = catcher.catches || 0;
      points += catches * 8;
      totalCatches += catches;
    }

    // ===== FIELDING: STUMPINGS & RUN OUTS =====
    const battingEntries = inning.batting || [];
    for (const b of battingEntries) {
      const d = (b.dismissal || "").toLowerCase();

      if (d.includes("st ") && d.includes(playerId)) {
        points += 12;
      }

      if (d.includes("run out")) {
        const parenMatch = d.match(/run out\s*\(([^)]+)\)/i);
        if (parenMatch) {
          const fieldersStr = parenMatch[1];
          const fielderNames = fieldersStr.split("/").map(f => f.trim().toLowerCase());

          if (fielderNames.length === 1) {
            if (d.includes(playerId) || fielderNames[0].includes(playerId)) {
              points += 12;
            }
          } else {
            const last2 = fielderNames.slice(-2);
            const playerInvolved = d.includes(playerId);
            if (playerInvolved) {
              points += 6;
            }
          }
        } else {
          if (d.includes(playerId)) {
            points += 12;
          }
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
    const res = await trackedFetch(url);
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

export async function fetchMatchScorecardWithScore(
  externalMatchId: string
): Promise<{
  pointsMap: Map<string, number>;
  namePointsMap: Map<string, number>;
  scoreString: string;
  matchEnded: boolean;
  totalOvers: number;
}> {
  const apiKey = getActiveApiKey();
  const pointsMap = new Map<string, number>();
  const namePointsMap = new Map<string, number>();
  let scoreString = "";
  let matchEnded = false;
  let totalOvers = 0;
  if (!apiKey) return { pointsMap, namePointsMap, scoreString, matchEnded, totalOvers };

  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await trackedFetch(url);
    if (!res.ok) {
      console.error(`[ScorecardWithScore] HTTP ${res.status} for ${externalMatchId}`);
      return { pointsMap, namePointsMap, scoreString, matchEnded, totalOvers };
    }

    let json: any;
    try {
      json = await res.json();
    } catch (parseErr) {
      console.error(`[ScorecardWithScore] JSON parse failed for ${externalMatchId}:`, parseErr);
      return { pointsMap, namePointsMap, scoreString, matchEnded, totalOvers };
    }

    if (json?.status !== "success" || !json?.data) {
      const errorMsg = json?.reason || json?.status || "";
      if (json?.status === "failure" || json?.reason) {
        console.error(`[ScorecardWithScore] API error for ${externalMatchId}: ${errorMsg}`);
      }
      return { pointsMap, namePointsMap, scoreString, matchEnded, totalOvers };
    }

    const scoreArr = Array.isArray(json.data.score) ? json.data.score : [];
    if (scoreArr.length > 0) {
      scoreString = scoreArr.map((s: any) => `${s?.inning ?? "?"}: ${s?.r ?? 0}/${s?.w ?? 0} (${s?.o ?? 0} ov)`).join(" | ");
      totalOvers = scoreArr.reduce((sum: number, s: any) => sum + (s?.o || 0), 0);
    }

    const scorecardInningsRaw = Array.isArray(json.data.scorecard) ? json.data.scorecard : [];
    if (scorecardInningsRaw.length > scoreArr.length) {
      console.log(`[ScorecardWithScore] scorecard has ${scorecardInningsRaw.length} innings but score array has ${scoreArr.length} — building score from scorecard`);
      const builtScoreParts: string[] = [];
      let builtTotalOvers = 0;
      for (const inn of scorecardInningsRaw) {
        const batting = Array.isArray(inn?.batting) ? inn.batting : [];
        if (batting.length === 0) continue;
        let runs = 0, wickets = 0, maxOvers = 0;
        const extras = inn?.extras?.total || 0;
        for (const b of batting) {
          runs += b?.r || 0;
          if (b?.dismissal && b.dismissal !== "not out" && b.dismissal !== "batting") wickets++;
        }
        runs += extras;
        const bowling = Array.isArray(inn?.bowling) ? inn.bowling : [];
        for (const bw of bowling) {
          const bowlOvers = bw?.o || 0;
          maxOvers += bowlOvers;
        }
        const inningName = inn?.inning || "?";
        builtScoreParts.push(`${inningName}: ${runs}/${wickets} (${maxOvers} ov)`);
        builtTotalOvers += maxOvers;
      }
      if (builtTotalOvers > totalOvers && builtScoreParts.length > 0) {
        scoreString = builtScoreParts.join(" | ");
        totalOvers = builtTotalOvers;
        console.log(`[ScorecardWithScore] Using scorecard-derived score: ${scoreString}, totalOvers=${totalOvers}`);
      }
    }

    const matchStatus = (json.data.name || json.data.status || "").toLowerCase();
    matchEnded = matchStatus.includes("won") || matchStatus.includes("draw") ||
                 matchStatus.includes("tied") || matchStatus.includes("finished") ||
                 matchStatus.includes("ended") || matchStatus.includes("result") ||
                 matchStatus.includes("aban") || matchStatus.includes("no result") ||
                 matchStatus.includes("d/l") || matchStatus.includes("dls") ||
                 matchStatus.includes("beat") || matchStatus.includes("defeat");

    if (!matchEnded && json.data.matchEnded === true) {
      matchEnded = true;
    }

    if (!matchEnded && scoreArr.length >= 2) {
      const inn2 = scoreArr[scoreArr.length - 1];
      const inn1 = scoreArr[0];
      const inn2Wickets = inn2?.w ?? 0;
      const inn2Overs = inn2?.o ?? 0;
      const inn2Runs = inn2?.r ?? 0;
      const inn1Runs = inn1?.r ?? 0;
      const allOut = inn2Wickets >= 10;
      const oversComplete = inn2Overs >= 20;
      const targetChased = inn2Runs > inn1Runs;
      if (allOut || oversComplete || targetChased) {
        matchEnded = true;
        console.log(`[ScorecardWithScore] matchEnded inferred from innings data: allOut=${allOut}, oversComplete=${oversComplete}, targetChased=${targetChased}`);
      }
    }
    const statusText = json.data.name || json.data.status || "";
    if (statusText) {
      scoreString += ` — ${statusText}`;
    }

    const scorecardInnings = Array.isArray(json.data.scorecard) ? json.data.scorecard : [];
    if (scorecardInnings.length > 0) {
      const allPlayers = new Map<string, string>();
      for (const inning of scorecardInnings) {
        const batting = Array.isArray(inning?.batting) ? inning.batting : [];
        const bowling = Array.isArray(inning?.bowling) ? inning.bowling : [];
        const catching = Array.isArray(inning?.catching) ? inning.catching : [];
        batting.forEach((b: any) => { if (b?.batsman?.id) allPlayers.set(b.batsman.id, b.batsman.name || ""); });
        bowling.forEach((b: any) => { if (b?.bowler?.id) allPlayers.set(b.bowler.id, b.bowler.name || ""); });
        catching.forEach((c: any) => { if (c?.catcher?.id) allPlayers.set(c.catcher.id, c.catcher.name || ""); });
      }

      console.log(`[ScorecardWithScore] ${scorecardInnings.length} innings, ${allPlayers.size} players found for ${externalMatchId}`);

      for (const [pid, pname] of allPlayers) {
        try {
          const pts = calculateFantasyPoints(pid, scorecardInnings);
          pointsMap.set(pid, pts);
          if (pname) {
            const normalizedName = pname.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
            namePointsMap.set(normalizedName, pts);
            console.log(`[ScorecardWithScore] ${pname} -> ${pts} fantasy pts`);
          }
        } catch (ptErr) {
          console.error(`[ScorecardWithScore] calculateFantasyPoints crashed for ${pname} (${pid}):`, ptErr);
        }
      }
    }

    return { pointsMap, namePointsMap, scoreString, matchEnded, totalOvers };
  } catch (err) {
    console.error("ScorecardWithScore error:", err);
    return { pointsMap, namePointsMap, scoreString, matchEnded, totalOvers };
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
    const res = await trackedFetch(url);
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
    const res = await trackedFetch(url);
    if (!res.ok) {
      console.error(`[LiveScorecard] HTTP ${res.status} for ${externalMatchId}`);
      return null;
    }

    let json: any;
    try {
      json = await res.json();
    } catch (parseErr) {
      console.error(`[LiveScorecard] JSON parse failed for ${externalMatchId}:`, parseErr);
      return null;
    }

    if (json?.status !== "success" || !json?.data) {
      const errorMsg = json?.reason || json?.status || "";
      if (json?.status === "failure" || json?.reason) {
        console.error(`[LiveScorecard] API error for ${externalMatchId}: ${errorMsg}`);
      }
      return null;
    }

    const scorecard = json.data.scorecard || [];
    const scoreArr = json.data.score || [];
    const innings = scorecard.map((inn: any, idx: number) => {
      const battingArr = Array.isArray(inn?.batting) ? inn.batting : [];
      const bowlingArr = Array.isArray(inn?.bowling) ? inn.bowling : [];
      const batterRuns = battingArr.reduce((sum: number, b: any) => sum + (b?.r || 0), 0);
      const matchScore = scoreArr.find((s: any) => s?.inning === inn?.inning) || scoreArr[idx];
      const totalFromApi = matchScore ? (matchScore.r ?? 0) : batterRuns;
      const extrasTotal = totalFromApi - batterRuns;

      const rawExtras = inn?.extras;
      const apiExtrasTotal = rawExtras?.total ?? rawExtras?.r;
      const finalExtras = apiExtrasTotal != null ? apiExtrasTotal : (extrasTotal > 0 ? extrasTotal : 0);

      return {
        inning: inn?.inning ?? `Inning ${idx + 1}`,
        extras: finalExtras,
        totals: matchScore ? { r: matchScore.r ?? 0, w: matchScore.w ?? 0, o: matchScore.o ?? 0 } : undefined,
        batting: battingArr.map((b: any) => ({
          name: b?.batsman?.name || b?.name || "",
          r: b?.r ?? 0,
          b: b?.b ?? 0,
          fours: b?.["4s"] ?? 0,
          sixes: b?.["6s"] ?? 0,
          sr: b?.sr ?? 0,
          dismissal: b?.dismissal || "not out",
          fantasyPoints: b?.batsman?.id ? calculateFantasyPoints(b.batsman.id, scorecard) : 0,
        })),
        bowling: bowlingArr.map((b: any) => {
          const dots = detectDotBalls(externalMatchId, b?.bowler?.name || b?.name || "", b);
          return {
            name: b?.bowler?.name || b?.name || "",
            o: b?.o ?? 0,
            m: b?.m ?? 0,
            r: b?.r ?? 0,
            w: b?.w ?? 0,
            eco: b?.eco ?? 0,
            dots: dots,
            fantasyPoints: b?.bowler?.id ? calculateFantasyPoints(b.bowler.id, scorecard) : 0,
          };
        }),
      };
    });

    let finalScore = scoreArr.map((s: any) => ({ r: s?.r ?? 0, w: s?.w ?? 0, o: s?.o ?? 0, inning: s?.inning ?? "" }));

    if (scorecard.length > 0) {
      const builtScore = scorecard.map((inn: any, idx: number) => {
        const battingArr = Array.isArray(inn?.batting) ? inn.batting : [];
        const bowlingArr = Array.isArray(inn?.bowling) ? inn.bowling : [];
        const extras = inn?.extras?.total || 0;
        let runs = 0, wickets = 0;
        for (const b of battingArr) {
          runs += b?.r || 0;
          if (b?.dismissal && b.dismissal !== "not out" && b.dismissal !== "batting") wickets++;
        }
        runs += extras;
        let overs = 0;
        for (const bw of bowlingArr) { overs += bw?.o || 0; }
        const existingScore = scoreArr.find((s: any) => s?.inning === inn?.inning) || scoreArr[idx];
        const builtR = runs;
        const builtW = wickets;
        const builtO = overs;
        const apiR = existingScore?.r ?? 0;
        const apiO = existingScore?.o ?? 0;
        const useBuilt = builtO > apiO || builtR > apiR || !existingScore;
        return {
          r: useBuilt ? builtR : apiR,
          w: useBuilt ? builtW : (existingScore?.w ?? 0),
          o: useBuilt ? builtO : apiO,
          inning: inn?.inning ?? existingScore?.inning ?? `Inning ${idx + 1}`,
        };
      });
      const builtTotalOvers = builtScore.reduce((sum: number, s: any) => sum + s.o, 0);
      const apiTotalOvers = finalScore.reduce((sum: number, s: any) => sum + s.o, 0);
      if (builtTotalOvers > apiTotalOvers || builtScore.length > finalScore.length) {
        console.log(`[LiveScorecard] Using scorecard-derived scores (${builtScore.length} innings, ${builtTotalOvers} ov) over API score (${finalScore.length} innings, ${apiTotalOvers} ov)`);
        finalScore = builtScore;
      }
    }

    return {
      score: finalScore,
      innings,
      status: json.data.name || json.data.status || "",
    };
  } catch (err) {
    console.error("Live scorecard error:", err);
    return null;
  }
}

// ============================================================
// CRICBUZZ (RapidAPI) — fallback live scoring for IPL 2026
// ============================================================

const CRICBUZZ_HOST = "cricbuzz-cricket.p.rapidapi.com";

async function cricbuzzFetch(path: string): Promise<any> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY not configured");
  const res = await fetch(`https://${CRICBUZZ_HOST}${path}`, {
    headers: {
      "x-rapidapi-host": CRICBUZZ_HOST,
      "x-rapidapi-key": key,
    },
  });
  if (!res.ok) throw new Error(`Cricbuzz HTTP ${res.status} for ${path}`);
  return res.json();
}

async function findCricbuzzMatchId(
  team1Short: string,
  team2Short: string
): Promise<number | null> {
  const data = await cricbuzzFetch("/matches/v1/live");
  const t1 = team1Short.toLowerCase();
  const t2 = team2Short.toLowerCase();
  for (const typeMatch of data.typeMatches || []) {
    for (const sm of typeMatch.seriesMatches || []) {
      const series = sm.seriesAdWrapper || sm;
      for (const m of series.matches || []) {
        const mi = m.matchInfo || {};
        const mt1 = (mi.team1?.teamSName || "").toLowerCase();
        const mt2 = (mi.team2?.teamSName || "").toLowerCase();
        if (
          (mt1 === t1 && mt2 === t2) ||
          (mt1 === t2 && mt2 === t1)
        ) {
          return parseInt(mi.matchId, 10);
        }
      }
    }
  }
  return null;
}

function cbOversToDecimal(overs: string | number): number {
  const s = String(overs);
  const [whole, balls] = s.split(".");
  return parseInt(whole || "0", 10) + (parseInt(balls || "0", 10) / 6);
}

function calcCricbuzzBattingPoints(
  runs: number,
  balls: number,
  fours: number,
  sixes: number,
  dismissed: boolean
): number {
  let pts = runs;
  pts += fours * 4;
  pts += sixes * 6;

  if (runs >= 100) pts += 16;
  else if (runs >= 75) pts += 12;
  else if (runs >= 50) pts += 8;
  else if (runs >= 25) pts += 4;

  if (runs === 0 && balls > 0 && dismissed) pts -= 2;

  if (balls >= 10) {
    const sr = (runs / balls) * 100;
    if (sr > 170) pts += 6;
    else if (sr > 150) pts += 4;
    else if (sr >= 130) pts += 2;
    else if (sr <= 70 && sr >= 60) pts -= 2;
    else if (sr < 60 && sr >= 50) pts -= 4;
    else if (sr < 50) pts -= 6;
  }
  return pts;
}

function calcCricbuzzBowlingPoints(
  wickets: number,
  maidens: number,
  economy: number,
  actualOvers: number,
  lbwBowledBonus: number
): number {
  let pts = wickets * 30;
  if (wickets >= 5) pts += 16;
  else if (wickets >= 4) pts += 8;
  else if (wickets >= 3) pts += 4;
  if (maidens > 0) pts += maidens * 12;
  pts += lbwBowledBonus;

  if (actualOvers >= 2) {
    if (economy < 5) pts += 6;
    else if (economy < 6) pts += 4;
    else if (economy <= 7) pts += 2;
    else if (economy >= 10 && economy <= 11) pts -= 2;
    else if (economy > 11 && economy <= 12) pts -= 4;
    else if (economy > 12) pts -= 6;
  }
  return pts;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addNamePoints(
  map: Map<string, number>,
  name: string,
  pts: number
): void {
  if (!name || pts === 0) return;
  const key = normalizeName(name);
  if (!key) return;
  map.set(key, (map.get(key) || 0) + pts);
}

interface CricbuzzScoreResult {
  namePointsMap: Map<string, number>;
  // Players who have their OWN batting or bowling row (genuinely participated in the match).
  // This excludes players who only appear in dismissal text as substitute fielders
  // (e.g. "c Pretorius b Jadeja") — those are credited in namePointsMap for catches
  // but are NOT considered to have "played" for impact sub detection purposes.
  battedOrBowledPlayers: Set<string>;
  scoreString: string;
  matchEnded: boolean;
  totalOvers: number;
}

export async function fetchCricbuzzScorecard(
  team1Short: string,
  team2Short: string
): Promise<CricbuzzScoreResult | null> {
  if (!process.env.RAPIDAPI_KEY) return null;

  try {
    const matchId = await findCricbuzzMatchId(team1Short, team2Short);
    if (!matchId) {
      console.log(
        `[Cricbuzz] No live match found for ${team1Short} vs ${team2Short}`
      );
      return null;
    }

    const namePointsMap = new Map<string, number>();
    const catchCountMap = new Map<string, number>(); // tracks catches per fielder for 3+ bonus
    const scardBowlerKeys = new Set<string>(); // tracks bowlers already counted via scard
    const battedOrBowledPlayers = new Set<string>();
    const scoreStringParts: string[] = [];
    let totalOvers = 0;
    let matchEnded = false;

    // --- SCARD: batting + dismissals + completed-innings bowling ---
    const scardData = await cricbuzzFetch(`/mcenter/v1/${matchId}/scard`);
    const scorecard: any[] = scardData.scorecard || [];
    console.log(`[Cricbuzz:Scard] ${team1Short} vs ${team2Short}: ${scorecard.length} innings in scard`);

    for (const inn of scorecard) {
      const batsmen: any[] = inn.batsman || [];
      const bowling: any[] = inn.bowler || inn.bowling || [];
      console.log(`[Cricbuzz:Scard] Inn ${inn.inningsid ?? inn.inningsId}: ${batsmen.length} batsmen, ${bowling.length} bowlers`);

      // Build wicket-taker lookup from dismissals for LBW/bowled bonus (normalized keys)
      const lbwBowledByBowler = new Map<string, number>();
      for (const b of batsmen) {
        const d = (b.outdec || "").toLowerCase();
        if (d.startsWith("b ") || d.startsWith("lbw")) {
          const match = b.outdec.match(/b\s+(.+)/i);
          if (match) {
            const bn = normalizeName(match[1].trim());
            lbwBowledByBowler.set(bn, (lbwBowledByBowler.get(bn) || 0) + 8);
          }
        }
      }

      // BATTING
      for (const b of batsmen) {
        const name: string = b.name || b.nickname;
        if (!name) continue;
        const dismissed =
          b.outdec &&
          b.outdec !== "batting" &&
          b.outdec !== "not out";
        const pts = calcCricbuzzBattingPoints(
          b.runs || 0,
          b.balls || 0,
          b.fours || 0,
          b.sixes || 0,
          !!dismissed
        );
        addNamePoints(namePointsMap, name, pts);
        if ((b.balls || 0) >= 1) {
          const normBatsman = name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
          battedOrBowledPlayers.add(normBatsman);
        }

        // FIELDING from dismissal string
        if (b.outdec) {
          const d = b.outdec;
          const catchMatch = d.match(/^c\s+(.+?)\s+b\s+/i);
          const stumpMatch = d.match(/^st\s+(.+?)\s+b\s+/i);
          const runoutMatch = d.match(/run out\s*\((.+?)\)/i);
          if (catchMatch) {
            const cKey = normalizeName(catchMatch[1].trim());
            if (cKey) catchCountMap.set(cKey, (catchCountMap.get(cKey) || 0) + 1);
          } else if (stumpMatch) {
            addNamePoints(namePointsMap, stumpMatch[1].trim(), 12);
          } else if (runoutMatch) {
            addNamePoints(namePointsMap, runoutMatch[1].trim(), 6);
          }
        }
      }

      // BOWLING (only present for completed innings)
      if (bowling.length > 0) {
        console.log(`[Cricbuzz:Bowl:Raw] First bowler object: ${JSON.stringify(bowling[0])}`);
      }
      for (const bw of bowling) {
        const name: string = bw.name || bw.bowlerName || bw.nickName || bw.fullName;
        if (!name) continue;
        const actualOvers = cbOversToDecimal(bw.overs || bw.ov || bw.o || 0);
        const eco = parseFloat(String(bw.economy || bw.eco || bw.er || 0)) || 0;
        const wickets = bw.wickets ?? bw.w ?? bw.wkts ?? 0;
        const maidens = bw.maidens ?? bw.m ?? bw.maiden ?? 0;
        const lbwBonus = lbwBowledByBowler.get(normalizeName(name)) || 0;
        const pts = calcCricbuzzBowlingPoints(
          wickets,
          maidens,
          eco,
          actualOvers,
          lbwBonus
        );
        console.log(`[Cricbuzz:Bowl] Inn${inn.inningsId} ${name}: ${wickets}w ${actualOvers}ov eco=${eco} => ${pts}pts`);
        addNamePoints(namePointsMap, name, pts);
        scardBowlerKeys.add(normalizeName(name)); // mark as already counted
        if (actualOvers > 0) {
          const normBowler = name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
          battedOrBowledPlayers.add(normBowler);
        }
      }

      // Score string from batting total
      const runs =
        batsmen.reduce((s: number, b: any) => s + (b.runs || 0), 0) +
        (inn.extras?.total || 0);
      const wickets = batsmen.filter(
        (b: any) =>
          b.outdec && b.outdec !== "batting" && b.outdec !== "not out"
      ).length;
      if (runs > 0 || wickets > 0) {
        scoreStringParts.push(
          `${inn.inningsId || "Inn"}: ${runs}/${wickets}`
        );
      }
    }

    // Apply fielding catch credits with 3+ catch bonus
    for (const [fielder, catches] of catchCountMap.entries()) {
      const pts = catches * 8 + (catches >= 3 ? 4 : 0);
      namePointsMap.set(fielder, (namePointsMap.get(fielder) || 0) + pts);
    }

    // --- LEANBACK: live bowling for ongoing innings + accurate score ---
    try {
      const leanback = await cricbuzzFetch(`/mcenter/v1/${matchId}/leanback`);
      const mini = leanback.miniscore || {};

      // Accurate innings score — rebuild scoreStringParts from leanback
      // Sort: completed innings (more overs) first, live innings (fewer overs) last
      // so the frontend's "last segment = main score" correctly shows the live innings
      const inningsScores: any[] =
        mini.inningsscores?.inningsscore || [];
      const sortedInnScores = [...inningsScores].sort(
        (a: any, b: any) => (b.overs || 0) - (a.overs || 0)
      );
      const lbScoreParts: string[] = [];
      let lbTotalOvers = 0;
      for (const is of sortedInnScores) {
        lbTotalOvers += (is.overs || 0); // SUM so CricAPI comparison stays fair
        const teamShort = is.batteamshortname || "Team";
        const runs = is.runs ?? 0;
        const wickets = is.wickets ?? 0;
        const overs = is.overs ?? 0;
        if (runs > 0 || wickets > 0 || overs > 0) {
          lbScoreParts.push(`${teamShort}: ${runs}/${wickets} (${overs} ov)`);
        }
      }
      if (lbTotalOvers > totalOvers) totalOvers = lbTotalOvers;
      if (lbScoreParts.length > 0) {
        // Replace scard-derived parts (which may have no team names or wrong order)
        scoreStringParts.splice(0, scoreStringParts.length, ...lbScoreParts);
      }

      // Current bowlers (only if not already in scard bowling)
      const bowlerKeys = ["bowlerstriker", "bowlernonstriker"] as const;
      for (const bk of bowlerKeys) {
        const bw = mini[bk];
        if (!bw?.name) continue;
        const name: string = bw.name;
        const normKey = normalizeName(name);
        const actualOvers = cbOversToDecimal(bw.overs || 0);
        const eco = parseFloat(String(bw.economy || 0)) || 0;
        const existing = namePointsMap.get(normKey) || 0;
        // Only add leanback bowling if this bowler was NOT already counted via scard.
        // The previous guard (existing===0 || bw.wickets>0) caused double-counting: a bowler
        // with wickets who was already in the scard bowling table would be re-added.
        if (!scardBowlerKeys.has(normKey)) {
          const pts = calcCricbuzzBowlingPoints(
            bw.wickets || 0,
            bw.maidens || 0,
            eco,
            actualOvers,
            0
          );
          if (pts !== 0) {
            namePointsMap.set(normKey, existing + pts);
          }
        }
      }

      // Match ended check
      const status = (mini.status || "").toLowerCase();
      matchEnded =
        status.includes("won") ||
        status.includes("draw") ||
        status.includes("tied") ||
        status.includes("result") ||
        status.includes("abandoned");
    } catch (lbErr) {
      console.error("[Cricbuzz] Leanback failed:", lbErr);
    }

    const scoreString = scoreStringParts.join(" | ");
    console.log(
      `[Cricbuzz] ${team1Short} vs ${team2Short}: matchId=${matchId}, ${namePointsMap.size} players, score="${scoreString}", ended=${matchEnded}`
    );
    if (namePointsMap.size > 0) {
      const sorted = [...namePointsMap.entries()].sort((a, b) => b[1] - a[1]);
      console.log(`[Cricbuzz:Map] Points map:\n${sorted.map(([n, p]) => `  ${n}: ${p}`).join("\n")}`);
    }

    if (namePointsMap.size === 0 && !scoreString) return null;
    return { namePointsMap, battedOrBowledPlayers, scoreString, matchEnded, totalOvers };
  } catch (err) {
    console.error(
      `[Cricbuzz] fetchCricbuzzScorecard failed for ${team1Short} vs ${team2Short}:`,
      err
    );
    return null;
  }
}

export async function fetchCricbuzzLiveScorecard(
  team1Short: string,
  team2Short: string
): Promise<{
  score: Array<{ r: number; w: number; o: number; inning: string }>;
  innings: Array<{
    inning: string;
    extras?: number;
    extrasDetail?: { b?: number; lb?: number; w?: number; nb?: number; p?: number };
    totals?: { r: number; w: number; o: number };
    batting: Array<{
      name: string; r: number; b: number; fours: number; sixes: number;
      sr: number; dismissal: string; fantasyPoints: number;
    }>;
    bowling: Array<{
      name: string; o: number; m: number; r: number; w: number;
      eco: number; fantasyPoints: number;
    }>;
  }>;
  status: string;
} | null> {
  if (!process.env.RAPIDAPI_KEY) return null;
  try {
    const matchId = await findCricbuzzMatchId(team1Short, team2Short);
    if (!matchId) return null;

    const scardData = await cricbuzzFetch(`/mcenter/v1/${matchId}/scard`);
    const scorecard: any[] = scardData.scorecard || [];
    const matchComplete: boolean = !!scardData.ismatchcomplete;
    const status: string = scardData.status || "";

    const score: Array<{ r: number; w: number; o: number; inning: string }> = [];
    const innings: Array<{
      inning: string;
      extras?: number;
      extrasDetail?: { b?: number; lb?: number; w?: number; nb?: number; p?: number };
      totals?: { r: number; w: number; o: number };
      batting: Array<{ name: string; r: number; b: number; fours: number; sixes: number; sr: number; dismissal: string; fantasyPoints: number }>;
      bowling: Array<{ name: string; o: number; m: number; r: number; w: number; eco: number; fantasyPoints: number }>;
    }> = [];

    for (const inn of scorecard) {
      const inningLabel = `${inn.batteamname || inn.batteamsname || "Team"} Innings`;
      const batsmen: any[] = inn.batsman || [];
      const bowlers: any[] = inn.bowler || inn.bowling || [];
      const extras = inn.extras || {};

      const batting = batsmen.map((b: any) => {
        const dismissal = b.outdec && b.outdec !== "batting" ? b.outdec : "not out";
        return {
          name: b.name || b.nickname || "",
          r: b.runs ?? 0,
          b: b.balls ?? 0,
          fours: b.fours ?? 0,
          sixes: b.sixes ?? 0,
          sr: parseFloat(String(b.strkrate ?? 0)) || 0,
          dismissal,
          fantasyPoints: 0,
        };
      });

      const bowling = bowlers.map((bw: any) => ({
        name: bw.name || bw.nickname || "",
        o: parseFloat(String(bw.overs ?? 0)) || 0,
        m: bw.maidens ?? 0,
        r: bw.runs ?? 0,
        w: bw.wickets ?? 0,
        eco: parseFloat(String(bw.economy ?? 0)) || 0,
        fantasyPoints: 0,
      }));

      const battingRunsSum = batting.reduce((s: number, b: any) => s + b.r, 0);
      const totalRuns = inn.score ?? (battingRunsSum + (extras.total ?? 0));
      const totalWickets = inn.wickets ?? batsmen.filter((b: any) => b.outdec && b.outdec !== "batting" && b.outdec !== "not out").length;
      const totalOvers = parseFloat(String(inn.overs ?? 0)) || 0;

      score.push({ r: totalRuns, w: totalWickets, o: totalOvers, inning: inningLabel });
      innings.push({
        inning: inningLabel,
        extras: extras.total ?? 0,
        extrasDetail: {
          b: extras.byes ?? 0,
          lb: extras.legbyes ?? 0,
          w: extras.wides ?? 0,
          nb: extras.noballs ?? 0,
          p: extras.penalty ?? 0,
        },
        totals: { r: totalRuns, w: totalWickets, o: totalOvers },
        batting,
        bowling,
      });
    }

    // Supplement with leanback to ensure live innings is visible even when scard lags
    try {
      const lb = await cricbuzzFetch(`/mcenter/v1/${matchId}/leanback`);
      const mini = lb.miniscore || {};
      const currentBatTeam: string =
        mini.batsmanStriker?.batTeamName ||
        mini.batsman?.[0]?.batTeamName ||
        "";
      if (currentBatTeam) {
        const alreadyIn = innings.some((inn) =>
          inn.inning.toLowerCase().includes(currentBatTeam.toLowerCase())
        );
        if (!alreadyIn) {
          // Build a partial innings from leanback live data
          const liveBatsmen: any[] = Array.isArray(mini.batsman) ? mini.batsman : [mini.batsmanStriker, mini.batsmanNonStriker].filter(Boolean);
          const liveBowlers: any[] = [mini.bowlerStriker, mini.bowlerNonStriker].filter(Boolean);
          const lbBatting = liveBatsmen.map((b: any) => ({
            name: b.batName || b.name || "",
            r: b.runs ?? 0,
            b: b.balls ?? 0,
            fours: b.fours ?? b.no4s ?? 0,
            sixes: b.sixes ?? b.no6s ?? 0,
            sr: parseFloat(String(b.strikeRate ?? b.strkrate ?? 0)) || 0,
            dismissal: "batting",
            fantasyPoints: 0,
          }));
          const lbBowling = liveBowlers.map((bw: any) => ({
            name: bw.bowlName || bw.name || "",
            o: parseFloat(String(bw.overs ?? 0)) || 0,
            m: bw.maidens ?? 0,
            r: bw.runs ?? 0,
            w: bw.wickets ?? 0,
            eco: parseFloat(String(bw.economy ?? 0)) || 0,
            fantasyPoints: 0,
          }));
          const lbRuns = (mini.inningsscores?.inningsscore || []).find(
            (s: any) => (s.batteamname || "").toLowerCase().includes(currentBatTeam.toLowerCase()) ||
              (s.batteamshortname || "").toLowerCase() === currentBatTeam.toLowerCase()
          );
          const lbScore = { r: lbRuns?.runs ?? 0, w: lbRuns?.wickets ?? 0, o: lbRuns?.overs ?? 0 };
          score.push({ r: lbScore.r, w: lbScore.w, o: lbScore.o, inning: `${currentBatTeam} Innings` });
          innings.push({
            inning: `${currentBatTeam} Innings`,
            extras: 0,
            totals: lbScore,
            batting: lbBatting,
            bowling: lbBowling,
          });
        }
      }
    } catch (_lbErr) { /* leanback supplement is best-effort */ }

    if (innings.length === 0) return null;
    console.log(`[Cricbuzz:LiveScorecard] ${team1Short} vs ${team2Short}: ${innings.length} innings, complete=${matchComplete}`);
    return { score, innings, status: status || `${team1Short} vs ${team2Short}` };
  } catch (err) {
    console.error(`[Cricbuzz:LiveScorecard] Failed for ${team1Short} vs ${team2Short}:`, err);
    return null;
  }
}

// ============================================================
// CFLL SCRAPER — co-primary for score header
// cricketfastliveline.in — fast SSR, explicit dot balls
// ============================================================

const CFLL_IPL_SCHEDULE_URL =
  "https://cricketfastliveline.in/series/indian-premier-league-2026/schedule/a-rz--cricket--bcci--iplt20--2026-ZGwl";
const CFLL_SCHEDULE_TTL_MS = 24 * 60 * 60 * 1000;

let cfllScheduleCache: {
  entries: Array<{ team1: string; team2: string; url: string }>;
  fetchedAt: number;
} | null = null;

interface CFLLScoreResult {
  scoreString: string;
  matchEnded: boolean;
  totalOvers: number;
}

async function fetchCFLLPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseCFLLNextData(html: string): any | null {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!m) return null;
  try {
    const json = JSON.parse(m[1]);
    const postData = json.props?.pageProps?.postData;
    if (!postData) return null;
    // Try zlib-compressed base64 first, then raw JSON
    try {
      const zlib = require("zlib");
      const decoded = JSON.parse(
        zlib.inflateSync(Buffer.from(postData, "base64")).toString("utf8")
      );
      return Array.isArray(decoded) ? decoded[0] : decoded;
    } catch {
      const decoded = JSON.parse(postData);
      return Array.isArray(decoded) ? decoded[0] : decoded;
    }
  } catch {
    return null;
  }
}

async function findCFLLMatchUrl(
  team1Short: string,
  team2Short: string
): Promise<string | null> {
  const now = Date.now();
  if (
    !cfllScheduleCache ||
    now - cfllScheduleCache.fetchedAt > CFLL_SCHEDULE_TTL_MS
  ) {
    console.log("[CFLL] Refreshing IPL 2026 schedule cache");
    try {
      const html = await fetchCFLLPage(CFLL_IPL_SCHEDULE_URL);
      const data = parseCFLLNextData(html);
      if (!data) throw new Error("No NEXT_DATA from CFLL schedule page");

      const allMatches = [
        ...(data.upcommingMatchData || []),
        ...(data.liveMatchesData || []),
        ...(data.completedMatchData || []),
      ];

      const toSlug = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
      const entries: Array<{ team1: string; team2: string; url: string }> = [];

      for (const match of allMatches) {
        const t1 = (match.t1_id || match.teams?.a?.key || "").toString();
        const t2 = (match.t2_id || match.teams?.b?.key || "").toString();
        const key = (match.key || match.match_id || "").toString();
        const matchNum = toSlug(match.related_name || "");
        const format = (match.format || "t20").toLowerCase();
        if (!t1 || !t2 || !key || !matchNum) continue;
        const slug = `${t1}-vs-${t2}-${matchNum}-${format}-indian-premier-league-2026`;
        const url = `https://cricketfastliveline.in/live-score/${slug}/${key}`;
        entries.push({ team1: t1, team2: t2, url });
      }

      cfllScheduleCache = { entries, fetchedAt: now };
      console.log(`[CFLL] Cached ${entries.length} IPL 2026 match URLs`);
    } catch (e) {
      console.error("[CFLL] Schedule fetch failed:", e);
      return null;
    }
  }

  // Map IPL short names to CFLL t_id format (lowercase)
  const t1 = team1Short.toLowerCase();
  const t2 = team2Short.toLowerCase();

  const entry = cfllScheduleCache.entries.find(
    (e) =>
      (e.team1 === t1 && e.team2 === t2) ||
      (e.team1 === t2 && e.team2 === t1)
  );

  if (entry) {
    console.log(`[CFLL] URL for ${team1Short} vs ${team2Short}: ${entry.url}`);
    return entry.url;
  }
  console.log(
    `[CFLL] No URL for ${team1Short} vs ${team2Short} (${cfllScheduleCache.entries.length} cached)`
  );
  return null;
}

function parseCFLLScore(data: any): CFLLScoreResult {
  const sd = data?.statesdata || {};
  const comm: any[] = data?.commentrydata || [];

  const bsn = String(sd.bsn || sd.tm1_sn || "");
  const bosn = String(sd.bosn || sd.tm2_sn || "");
  const status = String(sd.status || "");
  const result = String(sd.result || "").trim();
  const inningId = String(sd.inning_id || "1");
  const run = String(sd.run || "0");
  const wicket = String(sd.wicket || "0");
  const over = parseFloat(String(sd.over || "0"));

  const matchEnded = status === "completed" || !!result;
  const scoreParts: string[] = [];

  if (inningId === "1") {
    // First innings in progress
    if (bsn && (parseInt(run) > 0 || over > 0)) {
      scoreParts.push(`${bsn}: ${run}/${wicket} (${over} ov)`);
    }
  } else {
    // Second innings — reconstruct 1st innings from commentrydata
    const inn1Entries = comm.filter((e: any) => String(e.inning) === "1");
    const lastInn1 =
      inn1Entries.length > 0
        ? inn1Entries.reduce((best: any, e: any) => {
            const bo = parseFloat(String(e.over || "0"));
            const bestO = parseFloat(String(best.over || "0"));
            return bo > bestO ? e : best;
          }, inn1Entries[0])
        : null;

    let inn1Score = "";
    if (lastInn1) {
      const w = String(lastInn1.wickets || "?");
      const r = String(lastInn1.score || lastInn1.run || "");
      const o = parseFloat(String(lastInn1.over || "20"));
      const finalOv = o >= 19 ? "20.0" : String(o);
      if (r) inn1Score = `${bosn}: ${r}/${w} (${finalOv} ov)`;
    } else if (sd.target) {
      const target = parseInt(String(sd.target), 10);
      if (target > 1) inn1Score = `${bosn}: ${target - 1}/? (?ov)`;
    }

    if (inn1Score) scoreParts.push(inn1Score);
    if (bsn && (parseInt(run) > 0 || over > 0)) {
      scoreParts.push(`${bsn}: ${run}/${wicket} (${over} ov)`);
    }
  }

  let scoreString = scoreParts.join(" | ");
  if (matchEnded && result) scoreString += ` — ${result}`;

  const totalOvers = over + (inningId === "2" ? 20.0 : 0);

  return { scoreString, matchEnded, totalOvers };
}

export async function fetchCFLLScoreHeader(
  team1Short: string,
  team2Short: string
): Promise<CFLLScoreResult | null> {
  try {
    const url = await findCFLLMatchUrl(team1Short, team2Short);
    if (!url) return null;

    const html = await fetchCFLLPage(url);
    const data = parseCFLLNextData(html);
    if (!data) return null;

    const result = parseCFLLScore(data);
    if (!result.scoreString) return null;

    console.log(
      `[CFLL] ${team1Short} vs ${team2Short}: score="${result.scoreString}", ended=${result.matchEnded}`
    );
    return result;
  } catch (err) {
    console.error(
      `[CFLL] fetchCFLLScoreHeader failed for ${team1Short} vs ${team2Short}:`,
      err
    );
    return null;
  }
}

export async function fetchCFLLScorecard(
  team1Short: string,
  team2Short: string,
): Promise<{
  namePointsMap: Map<string, number>;
  battedOrBowledPlayers: Set<string>;
  scoreString: string;
  matchEnded: boolean;
  totalOvers: number;
}> {
  const empty = {
    namePointsMap: new Map<string, number>(),
    battedOrBowledPlayers: new Set<string>(),
    scoreString: "",
    matchEnded: false,
    totalOvers: 0,
  };

  try {
    const matchUrl = await findCFLLMatchUrl(team1Short, team2Short);
    if (!matchUrl) {
      console.log(`[CFLL:Scorecard] No match URL found for ${team1Short} vs ${team2Short}`);
      return empty;
    }

    const scorecardUrl = matchUrl.replace('/live-score/', '/scorecard/');
    console.log(`[CFLL:Scorecard] Fetching ${scorecardUrl}`);

    const html = await fetchCFLLPage(scorecardUrl);
    if (!html) return empty;

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

    const namePointsMap = new Map<string, number>();
    const battedOrBowledPlayers = new Set<string>();
    const catchMap = new Map<string, number>();
    const runOutMap = new Map<string, number>();
    const lbwBowledMap = new Map<string, number>();

    const tableRows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

    for (const row of tableRows) {
      const cells: string[] = [];
      let cellMatch;
      const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      while ((cellMatch = cellRe.exec(row)) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      }

      if (cells.length === 6 && !isNaN(parseInt(cells[1])) && !isNaN(parseInt(cells[2]))) {
        // Batting row: Name+dismissal | R | B | 4S | 6S | SR
        const nameAndDismissal = cells[0];
        const runs = parseInt(cells[1]) || 0;
        const balls = parseInt(cells[2]) || 0;
        const fours = parseInt(cells[3]) || 0;
        const sixes = parseInt(cells[4]) || 0;

        const nameLine = nameAndDismissal.split(/c |b |run|lbw/i)[0].trim();
        const cleanName = nameLine.replace(/\(C\)|\(wk\)|Imp/gi, '').trim();
        if (!cleanName || cleanName.length < 2) continue;

        const normName = norm(cleanName);
        const dismissalLower = nameAndDismissal.toLowerCase();
        const dismissed = balls > 0 &&
          !dismissalLower.includes('not out') && (
            dismissalLower.includes(' b ') ||
            dismissalLower.startsWith('b ') ||
            dismissalLower.includes('c ') ||
            dismissalLower.includes('lbw') ||
            dismissalLower.includes('run out') ||
            dismissalLower.includes('stumped') ||
            dismissalLower.includes('hit wicket') ||
            dismissalLower.includes('retired')
          );
        const battingPts = calcCricbuzzBattingPoints(runs, balls, fours, sixes, dismissed);
        battedOrBowledPlayers.add(normName);
        namePointsMap.set(normName, (namePointsMap.get(normName) || 0) + battingPts);

        const cAndBMatch = nameAndDismissal.match(/c\s*&?\s*b\s+([A-Za-z\s]+)/i);
        if (cAndBMatch) {
          const bowler = norm(cAndBMatch[1].trim());
          catchMap.set(bowler, (catchMap.get(bowler) || 0) + 1);
          lbwBowledMap.set(bowler, (lbwBowledMap.get(bowler) || 0) + 1);
        } else {
          const caughtMatch = nameAndDismissal.match(/c\s+([A-Za-z\s]+?)\s+b\s+([A-Za-z\s]+)/i);
          if (caughtMatch) {
            const fielder = norm(caughtMatch[1].trim());
            const bowler = norm(caughtMatch[2].trim());
            if (fielder) catchMap.set(fielder, (catchMap.get(fielder) || 0) + 1);
            if (dismissalLower.includes('lbw') || dismissalLower.match(/^b\s/)) {
              lbwBowledMap.set(bowler, (lbwBowledMap.get(bowler) || 0) + 1);
            }
          }
          if (dismissalLower.match(/^bowled\s+|^lbw\s+b\s+/)) {
            const bowlerMatch = dismissalLower.match(/(?:bowled|lbw\s+b)\s+([a-z\s]+)/);
            if (bowlerMatch) {
              const bowler = norm(bowlerMatch[1].trim());
              lbwBowledMap.set(bowler, (lbwBowledMap.get(bowler) || 0) + 1);
            }
          }
        }

        const runOutMatch = nameAndDismissal.match(/runout\s*(?:\[T\])?\s*([A-Za-z\s]+?)(?:\s*\[H\]\s*([A-Za-z\s]+))?$/i);
        if (runOutMatch) {
          const direct = norm(runOutMatch[1].trim());
          const assist = runOutMatch[2] ? norm(runOutMatch[2].trim()) : null;
          if (direct) runOutMap.set(direct, (runOutMap.get(direct) || 0) + 1);
          if (assist) runOutMap.set(assist, (runOutMap.get(assist) || 0) + 0.5);
        }

      } else if (cells.length === 6 && !isNaN(parseFloat(cells[1]))) {
        // Bowling row: Name | O | M | R | W | ER
        const bowlerName = cells[0].replace(/Imp/gi, '').trim();
        if (!bowlerName || bowlerName.length < 2) continue;

        const overs = parseFloat(cells[1]) || 0;
        const maidens = parseInt(cells[2]) || 0;
        const runsConceded = parseInt(cells[3]) || 0;
        const wickets = parseInt(cells[4]) || 0;
        const normBowler = norm(bowlerName);
        const economy = overs > 0 ? runsConceded / overs : 0;
        const lbwBowledBonus = (lbwBowledMap.get(normBowler) || 0) * 8;
        const bowlingPts = calcCricbuzzBowlingPoints(wickets, maidens, economy, overs, lbwBowledBonus);
        battedOrBowledPlayers.add(normBowler);
        namePointsMap.set(normBowler, (namePointsMap.get(normBowler) || 0) + bowlingPts);
      }
    }

    // Apply fielding credits
    for (const [fielder, catches] of catchMap.entries()) {
      const pts = Math.floor(catches) * 8 + (Math.floor(catches) >= 3 ? 4 : 0);
      namePointsMap.set(fielder, (namePointsMap.get(fielder) || 0) + pts);
    }
    for (const [fielder, value] of runOutMap.entries()) {
      const isAssist = value % 1 !== 0;
      const pts = isAssist ? 6 : Math.floor(value) * 12;
      namePointsMap.set(fielder, (namePointsMap.get(fielder) || 0) + pts);
    }

    // Get score string from existing header function
    let scoreString = '';
    let matchEnded = false;
    let totalOvers = 0;
    try {
      const scoreResult = await fetchCFLLScoreHeader(team1Short, team2Short);
      if (scoreResult) {
        scoreString = scoreResult.scoreString;
        matchEnded = scoreResult.matchEnded;
        totalOvers = scoreResult.totalOvers;
      }
    } catch (e) {
      console.log(`[CFLL:Scorecard] Score header fetch failed`);
    }

    console.log(`[CFLL:Scorecard] Parsed ${namePointsMap.size} players, ${battedOrBowledPlayers.size} batted/bowled for ${team1Short} vs ${team2Short}`);
    return { namePointsMap, battedOrBowledPlayers, scoreString, matchEnded, totalOvers };

  } catch (err) {
    console.error(`[CFLL:Scorecard] Failed for ${team1Short} vs ${team2Short}: ${err}`);
    return empty;
  }
}

// ============================================================
// CREX SCRAPER — primary live scorecard source
// ============================================================

let crexScheduleCache: {
  entries: Array<{ team1: string; team2: string; baseUrl: string }>;
  fetchedAt: number;
} | null = null;

const CREX_IPL_SCHEDULE_URL =
  "https://crex.com/series/indian-premier-league-2026-1PW/matches";
const CREX_SCHEDULE_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchCrexPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function findCrexMatchUrl(
  team1Short: string,
  team2Short: string
): Promise<string | null> {
  const now = Date.now();
  if (!crexScheduleCache || now - crexScheduleCache.fetchedAt > CREX_SCHEDULE_TTL_MS) {
    console.log("[Crex] Refreshing IPL 2026 schedule cache");
    try {
      const html = await fetchCrexPage(CREX_IPL_SCHEDULE_URL);
      const hrefRegex = /href="(\/scoreboard\/[^"]+)"/g;
      const seen = new Set<string>();
      const entries: Array<{ team1: string; team2: string; baseUrl: string }> = [];
      let m: RegExpExecArray | null;
      while ((m = hrefRegex.exec(html)) !== null) {
        const path = m[1].replace(/\/(scorecard|live|info)$/, "");
        if (seen.has(path)) continue;
        seen.add(path);
        const slugMatch = path.match(
          /\/([a-z]+)-vs-([a-z]+)-[a-z0-9-]+-indian-premier-league/
        );
        if (!slugMatch) continue;
        entries.push({
          team1: slugMatch[1],
          team2: slugMatch[2],
          baseUrl: `https://crex.com${path}`,
        });
      }
      crexScheduleCache = { entries, fetchedAt: now };
      console.log(`[Crex] Cached ${entries.length} IPL 2026 match URLs`);
    } catch (e) {
      console.error("[Crex] Schedule fetch failed:", e);
      return null;
    }
  }

  const t1 = team1Short.toLowerCase();
  const t2 = team2Short.toLowerCase();
  const entry = crexScheduleCache.entries.find(
    (e) =>
      (e.team1 === t1 && e.team2 === t2) ||
      (e.team1 === t2 && e.team2 === t1)
  );

  if (entry) {
    console.log(`[Crex] URL for ${team1Short} vs ${team2Short}: ${entry.baseUrl}`);
    return entry.baseUrl;
  }
  console.log(
    `[Crex] No URL found for ${team1Short} vs ${team2Short} (${crexScheduleCache.entries.length} cached)`
  );
  return null;
}

function parseCrexHtml(html: string): CricbuzzScoreResult {
  const namePointsMap = new Map<string, number>();
  // Tracks players who have their OWN batting or bowling row — i.e. actually participated.
  // Players only in dismissal text (e.g. "c Pretorius b X" when Pretorius is a sub fielder)
  // appear in namePointsMap for fielding points but NOT in battedOrBowledPlayers.
  const battedOrBowledPlayers = new Set<string>();
  const lbwBowledMap = new Map<string, number>();
  const trSegments = html.split("</tr>");

  // Pass 1 — batting rows
  for (const seg of trSegments) {
    if (!seg.includes('class="batsman-name"')) continue;

    const nameMatch = seg.match(/class="player-name"[^>]*>([^<]+)</);
    if (!nameMatch) continue;
    const name = nameMatch[1].replace(/\s*\([CWKcwk]+\)\s*/g, "").trim();
    if (!name) continue;

    const decisionMatch = seg.match(/class="decision"[^>]*>\s*([^<]+?)\s*</);
    const dismissal = decisionMatch ? decisionMatch[1].trim() : "batting";

    const statNums = [
      ...seg.matchAll(/<!---->?<div[^>]*>(\d+\.?\d*)<\/div><!---->?/g),
    ].map((m) => parseFloat(m[1]));

    if (statNums.length < 4) continue;
    const [runs, balls, fours, sixes] = statNums;

    const dismissalLower = (dismissal || '').toLowerCase();
    const dismissed = balls > 0 &&
      !dismissalLower.includes('not out') && (
        dismissalLower.includes(' b ') ||
        dismissalLower.startsWith('b ') ||
        dismissalLower.includes('c ') ||
        dismissalLower.includes('lbw') ||
        dismissalLower.includes('run out') ||
        dismissalLower.includes('stumped') ||
        dismissalLower.includes('hit wicket') ||
        dismissalLower.includes('retired')
      );

    // This player has their own batting row — they genuinely participated
    battedOrBowledPlayers.add(normalizeName(name));

    // LBW / bowled bonus map for bowling pass
    const lbwMatch = dismissal.match(/^(?:lbw\s+b|b)\s+(.+)/i);
    if (lbwMatch) {
      const bn = normalizeName(lbwMatch[1].trim());
      lbwBowledMap.set(bn, (lbwBowledMap.get(bn) || 0) + 8);
    }

    // Fielding points from dismissal text — added to namePointsMap but fielders
    // are NOT added to battedOrBowledPlayers (they may be sub fielders who didn't play)
    const catchMatch = dismissal.match(/^c\s+(.+?)\s+b\s+/i);
    const stumpMatch = dismissal.match(/^st\s+(.+?)\s+b\s+/i);
    const runoutMatch = dismissal.match(/run\s*out\s*[\(\[](.+?)[\)\]]/i);
    if (catchMatch) addNamePoints(namePointsMap, catchMatch[1].trim(), 8);
    else if (stumpMatch) addNamePoints(namePointsMap, stumpMatch[1].trim(), 12);
    else if (runoutMatch) addNamePoints(namePointsMap, runoutMatch[1].trim(), 6);

    const pts = calcCricbuzzBattingPoints(runs, balls, fours, sixes, dismissed);
    addNamePoints(namePointsMap, name, pts);
  }

  // Pass 2 — bowling rows
  for (const seg of trSegments) {
    if (!seg.includes('class="bowler-name"')) continue;

    const nameMatch = seg.match(/class="player-name"[^>]*>([^<]+)</);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    if (!name) continue;

    const statNums = [
      ...seg.matchAll(/<!---->?<div[^>]*>(\d+\.?\d*)<\/div><!---->?/g),
    ].map((m) => parseFloat(m[1]));

    if (statNums.length < 5) continue; // filters out fall-of-wickets false positives
    const [overs, maidens, , wickets, economy] = statNums;
    const actualOvers = cbOversToDecimal(String(overs));
    const lbwBonus = lbwBowledMap.get(normalizeName(name)) || 0;

    // This player has their own bowling row — they genuinely participated
    battedOrBowledPlayers.add(normalizeName(name));

    const pts = calcCricbuzzBowlingPoints(
      wickets,
      maidens,
      economy,
      actualOvers,
      lbwBonus
    );
    addNamePoints(namePointsMap, name, pts);
  }

  // Score string — parse from embedded app-root-state JSON (most reliable)
  // Crex embeds SSR state as: <script id="app-root-state">{"j":"220/4(20.0","k":"120/0(9.5",...}</script>
  // "j" = 1st innings score, "k" = 2nd innings score (letters are fkey-based)
  const scoreStringParts: string[] = [];
  let totalOvers = 0;

  const stateScriptMatch = html.match(/<script[^>]*id="app-root-state"[^>]*>([\s\S]*?)<\/script>/);
  if (stateScriptMatch) {
    const stateJson = stateScriptMatch[1].replace(/&q;/g, '"');

    // Extract team fkeys from metadata — team1_fkey maps to team1 short, team2_fkey to team2 short
    const t1FkeyM = stateJson.match(/"team1_fkey"\s*:\s*"([^"]+)"/);
    const t2FkeyM = stateJson.match(/"team2_fkey"\s*:\s*"([^"]+)"/);
    const t1ShortM = stateJson.match(/"team1"\s*:\s*"([^"]+)"/);
    const t2ShortM = stateJson.match(/"team2"\s*:\s*"([^"]+)"/);

    const fkey1 = t1FkeyM ? t1FkeyM[1].toLowerCase() : "";
    const fkey2 = t2FkeyM ? t2FkeyM[1].toLowerCase() : "";
    // team1 full name → derive short from known names
    const teamFullToShort: Record<string, string> = {
      "mumbai indians": "MI", "kolkata knight riders": "KKR", "chennai super kings": "CSK",
      "royal challengers bengaluru": "RCB", "royal challengers bangalore": "RCB",
      "sunrisers hyderabad": "SRH", "delhi capitals": "DC", "punjab kings": "PBKS",
      "rajasthan royals": "RR", "gujarat titans": "GT", "lucknow super giants": "LSG",
    };
    const team1Short = t1ShortM ? (teamFullToShort[t1ShortM[1].toLowerCase()] || t1ShortM[1].substring(0, 4).toUpperCase()) : "T1";
    const team2Short = t2ShortM ? (teamFullToShort[t2ShortM[1].toLowerCase()] || t2ShortM[1].substring(0, 4).toUpperCase()) : "T2";

    // The fkeys are used as JSON keys for innings scores: e.g. fkey1="f" → "f":"120/0(9.5"
    // innings key "j" and "k" are the score fields
    const inn1M = stateJson.match(new RegExp(`"${fkey2}"\\s*:\\s*"([\\d]+\\/[\\d]+\\([\\d.]+)"`));
    const inn2M = stateJson.match(new RegExp(`"${fkey1}"\\s*:\\s*"([\\d]+\\/[\\d]+\\([\\d.]+)"`));
    // Also try generic j/k pattern as fallback
    const jMatch = !inn1M ? stateJson.match(/"j"\s*:\s*"([\d]+\/[\d]+\([\d.]+)"/) : null;
    const kMatch = !inn2M ? stateJson.match(/"k"\s*:\s*"([\d]+\/[\d]+\([\d.]+)"/) : null;

    const scores: Array<{ team: string; scoreRaw: string }> = [];
    if (inn1M) scores.push({ team: team2Short, scoreRaw: inn1M[1] }); // fkey2 = team2 batted 1st
    else if (jMatch) scores.push({ team: team2Short, scoreRaw: jMatch[1] });
    if (inn2M) scores.push({ team: team1Short, scoreRaw: inn2M[1] });
    else if (kMatch) scores.push({ team: team1Short, scoreRaw: kMatch[1] });

    for (const { team, scoreRaw } of scores) {
      // "220/4(20.0" → runs="220/4", overs=20.0
      const parsed = scoreRaw.match(/^([\d]+\/[\d]+)\(([\d.]+)/);
      if (parsed) {
        const overs = parseFloat(parsed[2]);
        scoreStringParts.push(`${team}: ${parsed[1]} (${overs} ov)`);
        totalOvers += overs;
      }
    }
  }

  // Fallback: scan HTML text for inline score patterns like "KKR: 220/4 (20 Ov)"
  if (scoreStringParts.length === 0) {
    const seenTeams = new Set<string>();
    let sm: RegExpExecArray | null;
    const textScoreRegex = /\b([A-Z]{2,6})\s*:\s*([\d]+[-\/][\d]+)\s*\(([\d]+\.?[\d]*)\s*(?:Ov|ov|OV)\)/g;
    while ((sm = textScoreRegex.exec(html)) !== null) {
      const team = sm[1].trim();
      if (seenTeams.has(team)) continue;
      seenTeams.add(team);
      const score = sm[2];
      const overs = parseFloat(sm[3]);
      if (team && score) {
        scoreStringParts.push(`${team}: ${score} (${overs} ov)`);
        totalOvers += overs;
      }
    }
  }

  const matchEnded = /won by|match tied|abandoned/.test(html.toLowerCase());

  return {
    namePointsMap,
    battedOrBowledPlayers,
    scoreString: scoreStringParts.join(" | "),
    matchEnded,
    totalOvers,
  };
}

export async function fetchCrexScorecard(
  team1Short: string,
  team2Short: string
): Promise<CricbuzzScoreResult | null> {
  try {
    const baseUrl = await findCrexMatchUrl(team1Short, team2Short);
    if (!baseUrl) return null;

    // Fetch scorecard page for player stats
    const scorecardHtml = await fetchCrexPage(`${baseUrl}/scorecard`);

    // Parse player points from the scorecard page
    const result = parseCrexHtml(scorecardHtml);

    // If scorecard page only got 1 innings score, try the /live page which shows both innings
    const scorecardInningsCount = (result.scoreString.match(/\([\d.]+\s*ov\)/g) || []).length;
    if (scorecardInningsCount < 2) {
      try {
        const liveHtml = await fetchCrexPage(`${baseUrl}/live`);
        const liveParsed = parseCrexHtml(liveHtml);
        const liveInningsCount = (liveParsed.scoreString.match(/\([\d.]+\s*ov\)/g) || []).length;
        if (liveParsed.scoreString && liveInningsCount > scorecardInningsCount) {
          result.scoreString = liveParsed.scoreString;
          result.totalOvers = liveParsed.totalOvers;
          result.matchEnded = result.matchEnded || liveParsed.matchEnded;
          console.log(`[Crex] Score supplemented from /live: "${liveParsed.scoreString}"`);
        }
      } catch (_liveErr) {
        // /live page not available — score stays as-is from scorecard page
      }
    }

    console.log(
      `[Crex] ${team1Short} vs ${team2Short}: ${result.namePointsMap.size} players, score="${result.scoreString}", ended=${result.matchEnded}`
    );

    if (result.namePointsMap.size === 0 && !result.scoreString) return null;

    if (result.namePointsMap.size > 0) {
      const sorted = [...result.namePointsMap.entries()].sort(
        (a, b) => b[1] - a[1]
      );
      console.log(
        `[Crex:Map] Points:\n${sorted.map(([n, p]) => `  ${n}: ${p}`).join("\n")}`
      );
    }

    return result;
  } catch (err) {
    console.error(
      `[Crex] fetchCrexScorecard failed for ${team1Short} vs ${team2Short}:`,
      err
    );
    return null;
  }
}
