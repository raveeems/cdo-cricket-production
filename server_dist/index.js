var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  codeVerifications: () => codeVerifications,
  insertMatchSchema: () => insertMatchSchema,
  insertPlayerSchema: () => insertPlayerSchema,
  insertReferenceCodeSchema: () => insertReferenceCodeSchema,
  insertUserSchema: () => insertUserSchema,
  insertUserTeamSchema: () => insertUserTeamSchema,
  matches: () => matches,
  players: () => players,
  referenceCodes: () => referenceCodes,
  userTeams: () => userTeams,
  users: () => users
});
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
  real
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users, referenceCodes, matches, players, userTeams, codeVerifications, insertUserSchema, insertReferenceCodeSchema, insertMatchSchema, insertPlayerSchema, insertUserTeamSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      username: text("username").notNull().unique(),
      email: text("email").notNull().unique(),
      phone: text("phone").notNull().default(""),
      password: text("password").notNull(),
      teamName: text("team_name").notNull().default(""),
      isVerified: boolean("is_verified").notNull().default(false),
      isAdmin: boolean("is_admin").notNull().default(false),
      joinedAt: timestamp("joined_at").notNull().defaultNow()
    });
    referenceCodes = pgTable("reference_codes", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      code: varchar("code", { length: 4 }).notNull().unique(),
      isActive: boolean("is_active").notNull().default(true),
      createdBy: varchar("created_by"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    matches = pgTable("matches", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      externalId: varchar("external_id"),
      seriesId: varchar("series_id"),
      team1: text("team1").notNull(),
      team1Short: varchar("team1_short", { length: 10 }).notNull(),
      team1Color: varchar("team1_color", { length: 10 }).notNull().default("#333"),
      team2: text("team2").notNull(),
      team2Short: varchar("team2_short", { length: 10 }).notNull(),
      team2Color: varchar("team2_color", { length: 10 }).notNull().default("#666"),
      venue: text("venue").notNull().default(""),
      startTime: timestamp("start_time").notNull(),
      status: varchar("status", { length: 20 }).notNull().default("upcoming"),
      statusNote: text("status_note").notNull().default(""),
      league: text("league").notNull().default(""),
      totalPrize: text("total_prize").notNull().default("0"),
      entryFee: integer("entry_fee").notNull().default(0),
      spotsTotal: integer("spots_total").notNull().default(100),
      spotsFilled: integer("spots_filled").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    players = pgTable("players", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      matchId: varchar("match_id").notNull(),
      externalId: varchar("external_id"),
      name: text("name").notNull(),
      team: text("team").notNull(),
      teamShort: varchar("team_short", { length: 10 }).notNull(),
      role: varchar("role", { length: 10 }).notNull(),
      credits: real("credits").notNull().default(8),
      points: integer("points").notNull().default(0),
      selectedBy: integer("selected_by").notNull().default(0),
      recentForm: jsonb("recent_form").$type().notNull().default([]),
      isImpactPlayer: boolean("is_impact_player").notNull().default(false),
      isPlayingXI: boolean("is_playing_xi").notNull().default(false)
    });
    userTeams = pgTable("user_teams", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull(),
      matchId: varchar("match_id").notNull(),
      name: text("name").notNull(),
      playerIds: jsonb("player_ids").$type().notNull().default([]),
      captainId: varchar("captain_id").notNull(),
      viceCaptainId: varchar("vice_captain_id").notNull(),
      totalPoints: integer("total_points").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    codeVerifications = pgTable("code_verifications", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull(),
      codeId: varchar("code_id").notNull(),
      verifiedAt: timestamp("verified_at").notNull().defaultNow()
    });
    insertUserSchema = createInsertSchema(users).pick({
      username: true,
      email: true,
      phone: true,
      password: true
    });
    insertReferenceCodeSchema = createInsertSchema(referenceCodes).pick({
      code: true
    });
    insertMatchSchema = createInsertSchema(matches).omit({
      id: true,
      createdAt: true
    });
    insertPlayerSchema = createInsertSchema(players).omit({
      id: true
    });
    insertUserTeamSchema = z.object({
      matchId: z.string(),
      name: z.string(),
      playerIds: z.array(z.string()),
      captainId: z.string(),
      viceCaptainId: z.string()
    });
  }
});

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
var pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL
    });
    db = drizzle(pool, { schema: schema_exports });
  }
});

// server/storage.ts
var storage_exports = {};
__export(storage_exports, {
  DatabaseStorage: () => DatabaseStorage,
  storage: () => storage
});
import { eq, and, sql as sql2, desc } from "drizzle-orm";
var DatabaseStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_db();
    init_schema();
    DatabaseStorage = class {
      async getUser(id) {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
      }
      async getUserByEmail(email) {
        const [user] = await db.select().from(users).where(eq(users.email, email));
        return user;
      }
      async getUserByPhone(phone) {
        const [user] = await db.select().from(users).where(eq(users.phone, phone));
        return user;
      }
      async getUserByUsername(username) {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user;
      }
      async createUser(data) {
        const [user] = await db.insert(users).values(data).returning();
        return user;
      }
      async updateUserVerified(userId, verified) {
        await db.update(users).set({ isVerified: verified }).where(eq(users.id, userId));
      }
      async setUserAdmin(userId, isAdmin2) {
        await db.update(users).set({ isAdmin: isAdmin2 }).where(eq(users.id, userId));
      }
      async updateUserTeamName(userId, teamName) {
        await db.update(users).set({ teamName }).where(eq(users.id, userId));
      }
      async getUserTeam(teamId) {
        const [team] = await db.select().from(userTeams).where(eq(userTeams.id, teamId));
        return team;
      }
      // Reference Codes
      async getActiveCode(code) {
        const [found] = await db.select().from(referenceCodes).where(and(eq(referenceCodes.code, code), eq(referenceCodes.isActive, true)));
        return found;
      }
      async getAllCodes() {
        return db.select().from(referenceCodes);
      }
      async createCode(code, createdBy) {
        const [created] = await db.insert(referenceCodes).values({ code, createdBy, isActive: true }).returning();
        return created;
      }
      async deactivateCode(codeId) {
        await db.update(referenceCodes).set({ isActive: false }).where(eq(referenceCodes.id, codeId));
      }
      async deleteCode(codeId) {
        await db.delete(referenceCodes).where(eq(referenceCodes.id, codeId));
      }
      async logCodeVerification(userId, codeId) {
        await db.insert(codeVerifications).values({ userId, codeId });
      }
      // Matches
      async getMatch(id) {
        const [match] = await db.select().from(matches).where(eq(matches.id, id));
        return match;
      }
      async getAllMatches() {
        return db.select().from(matches);
      }
      async createMatch(data) {
        const [match] = await db.insert(matches).values(data).returning();
        return match;
      }
      async updateMatch(id, data) {
        await db.update(matches).set(data).where(eq(matches.id, id));
      }
      // Players
      async getPlayersForMatch(matchId) {
        return db.select().from(players).where(eq(players.matchId, matchId));
      }
      async createPlayer(data) {
        const [player] = await db.insert(players).values(data).returning();
        return player;
      }
      async bulkCreatePlayers(data) {
        if (data.length === 0) return;
        await db.insert(players).values(data);
      }
      async deletePlayersForMatch(matchId) {
        await db.delete(players).where(eq(players.matchId, matchId));
      }
      async updatePlayer(id, data) {
        await db.update(players).set(data).where(eq(players.id, id));
      }
      // User Teams
      async getUserTeamsForMatch(userId, matchId) {
        return db.select().from(userTeams).where(and(eq(userTeams.userId, userId), eq(userTeams.matchId, matchId)));
      }
      async getAllTeamsForMatch(matchId) {
        return db.select().from(userTeams).where(eq(userTeams.matchId, matchId));
      }
      async getUserTeams(userId) {
        return db.select().from(userTeams).where(eq(userTeams.userId, userId));
      }
      async createUserTeam(data) {
        const [team] = await db.insert(userTeams).values(data).returning();
        return team;
      }
      async deleteUserTeam(teamId, userId) {
        await db.delete(userTeams).where(and(eq(userTeams.id, teamId), eq(userTeams.userId, userId)));
      }
      async updateUserTeamPoints(teamId, totalPoints) {
        await db.update(userTeams).set({ totalPoints }).where(eq(userTeams.id, teamId));
      }
      async markPlayingXI(matchId, externalPlayerIds) {
        if (externalPlayerIds.length === 0) return 0;
        await db.update(players).set({ isPlayingXI: false }).where(eq(players.matchId, matchId));
        let updated = 0;
        for (const extId of externalPlayerIds) {
          const result = await db.update(players).set({ isPlayingXI: true }).where(and(eq(players.matchId, matchId), eq(players.externalId, extId)));
          updated++;
        }
        return updated;
      }
      async getPlayingXICount(matchId) {
        const result = await db.select({ count: sql2`count(*)` }).from(players).where(and(eq(players.matchId, matchId), eq(players.isPlayingXI, true)));
        return Number(result[0]?.count || 0);
      }
      async getLeaderboard() {
        const result = await db.select({
          userId: users.id,
          username: users.username,
          teamName: users.teamName,
          totalPoints: sql2`COALESCE(SUM(${userTeams.totalPoints}), 0)`.as("total_points_sum"),
          matchesPlayed: sql2`COUNT(DISTINCT ${userTeams.matchId})`.as("matches_played"),
          teamsCreated: sql2`COUNT(${userTeams.id})`.as("teams_created")
        }).from(users).leftJoin(userTeams, eq(users.id, userTeams.userId)).where(eq(users.isVerified, true)).groupBy(users.id, users.username, users.teamName).orderBy(desc(sql2`total_points_sum`));
        return result.map((row, index) => ({
          rank: index + 1,
          userId: row.userId,
          username: row.username,
          teamName: row.teamName,
          totalPoints: Number(row.totalPoints),
          matchesPlayed: Number(row.matchesPlayed),
          teamsCreated: Number(row.teamsCreated)
        }));
      }
    };
    storage = new DatabaseStorage();
  }
});

// server/cricket-api.ts
var cricket_api_exports = {};
__export(cricket_api_exports, {
  fetchLiveScorecard: () => fetchLiveScorecard,
  fetchMatchInfo: () => fetchMatchInfo,
  fetchMatchScorecard: () => fetchMatchScorecard,
  fetchMatchSquad: () => fetchMatchSquad,
  fetchPlayingXI: () => fetchPlayingXI,
  fetchSeriesMatches: () => fetchSeriesMatches,
  fetchSeriesSquad: () => fetchSeriesSquad,
  fetchUpcomingMatches: () => fetchUpcomingMatches,
  refreshPlayingXIForLiveMatches: () => refreshPlayingXIForLiveMatches,
  refreshStaleMatchStatuses: () => refreshStaleMatchStatuses,
  syncMatchesFromApi: () => syncMatchesFromApi
});
function isMatchDelayed(apiStatusText) {
  const lower = (apiStatusText || "").toLowerCase();
  return DELAY_KEYWORDS.some((kw) => lower.includes(kw));
}
function determineMatchStatus(matchStarted, matchEnded, apiStatusText, hasScoreData) {
  const statusNote = apiStatusText || "";
  if (matchEnded) {
    return { status: "completed", statusNote };
  }
  if (matchStarted) {
    if (hasScoreData) {
      return { status: "live", statusNote };
    }
    if (isMatchDelayed(apiStatusText)) {
      return { status: "delayed", statusNote };
    }
    return { status: "live", statusNote: statusNote || "Toss completed" };
  }
  if (isMatchDelayed(apiStatusText)) {
    return { status: "delayed", statusNote };
  }
  return { status: "upcoming", statusNote };
}
function getTeamColor(shortName) {
  return TEAM_COLORS[shortName.toUpperCase()] || "#333333";
}
function getTeamShort(fullName) {
  const mapping = {
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
    Afghanistan: "AFG"
  };
  if (mapping[fullName]) return mapping[fullName];
  const words = fullName.split(" ");
  if (words.length === 1) return fullName.substring(0, 3).toUpperCase();
  return words.map((w) => w[0]).join("").toUpperCase().substring(0, 4);
}
async function fetchUpcomingMatches() {
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey) {
    console.log("CRICKET_API_KEY not set, skipping API fetch");
    return [];
  }
  try {
    const allApiMatches = [];
    const seenIds = /* @__PURE__ */ new Set();
    const endpoints = [
      `${CRICKET_API_BASE}/currentMatches?apikey=${apiKey}&offset=0`,
      `${CRICKET_API_BASE}/matches?apikey=${apiKey}&offset=0`,
      `${CRICKET_API_BASE}/matches?apikey=${apiKey}&offset=25`
    ];
    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.error("Cricket API error:", res.status, res.statusText, url);
          continue;
        }
        const json = await res.json();
        if (json.status === "success" && json.data) {
          const epName = url.includes("currentMatches") ? "currentMatches" : `matches(offset=${url.includes("offset=25") ? "25" : "0"})`;
          console.log(
            `Cricket API: fetched ${json.data.length} from ${epName}, hits: ${json.info?.hitsUsed}/${json.info?.hitsLimit}`
          );
          for (const m of json.data) {
            if (!seenIds.has(m.id)) {
              seenIds.add(m.id);
              allApiMatches.push(m);
            }
          }
        } else if (json.reason) {
          console.log(`Cricket API blocked: ${json.reason} - will retry later`);
          if (json.reason?.includes("Blocked")) {
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
    return allApiMatches.filter((m) => m.teams && m.teams.length >= 2 && m.dateTimeGMT).map((m) => {
      const team1 = m.teams[0];
      const team2 = m.teams[1];
      const team1Info = m.teamInfo?.find((t) => t.name === team1);
      const team2Info = m.teamInfo?.find((t) => t.name === team2);
      const team1Short = team1Info?.shortname || getTeamShort(team1);
      const team2Short = team2Info?.shortname || getTeamShort(team2);
      const hasScoreData = !!(m.score && m.score.length > 0 && m.score.some((s) => s.r > 0 || s.w > 0 || s.o > 0));
      const { status, statusNote } = determineMatchStatus(
        m.matchStarted,
        m.matchEnded,
        m.status,
        hasScoreData
      );
      const nameParts = m.name?.split(",").map((s) => s.trim()) || [];
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
        league
      };
    });
  } catch (err) {
    console.error("Cricket API fetch error:", err);
    return [];
  }
}
async function fetchSeriesMatches(seriesId, seriesName) {
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey) return [];
  try {
    const url = `${CRICKET_API_BASE}/series_info?apikey=${apiKey}&id=${seriesId}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    if (json.status !== "success" || !json.data?.matchList) return [];
    console.log(`Series Info API: fetched ${json.data.matchList.length} matches for ${seriesName}, hits: ${json.info?.hitsUsed}/${json.info?.hitsLimit}`);
    return json.data.matchList.filter((m) => m.teams && m.teams.length >= 2 && m.dateTimeGMT && !m.teams.includes("Tbc")).map((m) => {
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
      const nameParts = m.name?.split(",").map((s) => s.trim()) || [];
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
        league
      };
    });
  } catch (err) {
    console.error("Series Info API error:", err);
    return [];
  }
}
async function upsertMatches(apiMatches, existingMatches) {
  const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  let created = 0;
  let updated = 0;
  for (const m of apiMatches) {
    const dup = existingMatches.find((e) => e.externalId === m.externalId);
    if (!dup) {
      await storage2.createMatch({
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
        spotsFilled: 0
      });
      created++;
    } else {
      const updates = {};
      if (dup.status !== m.status) updates.status = m.status;
      if (m.statusNote && dup.statusNote !== m.statusNote) updates.statusNote = m.statusNote;
      if (new Date(dup.startTime).getTime() !== m.startTime.getTime()) updates.startTime = m.startTime;
      if (dup.league !== m.league) updates.league = m.league;
      if (m.seriesId && dup.seriesId !== m.seriesId) updates.seriesId = m.seriesId;
      if (m.venue && dup.venue !== m.venue) updates.venue = m.venue;
      if (Object.keys(updates).length > 0) {
        await storage2.updateMatch(dup.id, updates);
        console.log(`Match ${m.team1} vs ${m.team2}: updated [${Object.keys(updates).join(", ")}]`);
        updated++;
      }
    }
  }
  return { created, updated };
}
async function syncMatchesFromApi(retryCount = 0) {
  const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  console.log("Auto-syncing matches from Cricket API...");
  try {
    const apiMatches = await fetchUpcomingMatches();
    if (apiMatches.length === 0 && retryCount < 3) {
      const delayMin = retryCount === 0 ? 1 : retryCount === 1 ? 5 : 15;
      console.log(`No matches returned - will retry in ${delayMin} minute(s) (attempt ${retryCount + 1}/3)`);
      setTimeout(() => syncMatchesFromApi(retryCount + 1), delayMin * 60 * 1e3);
      return;
    }
    const existing = await storage2.getAllMatches();
    const { created, updated } = await upsertMatches(apiMatches, existing);
    console.log(`Cricket API sync: ${created} new, ${updated} updated from general endpoints`);
    const refreshedExisting = created > 0 ? await storage2.getAllMatches() : existing;
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
            refreshedExisting.push(...await storage2.getAllMatches());
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
async function fetchMatchInfo(matchId) {
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `${CRICKET_API_BASE}/match_info?apikey=${apiKey}&id=${matchId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== "success") return null;
    return json.data;
  } catch (err) {
    console.error("Cricket API match info error:", err);
    return null;
  }
}
async function fetchPlayingXI(externalMatchId) {
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey) return [];
  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    if (json.status !== "success" || !json.data?.scorecard) return [];
    const playerIds = /* @__PURE__ */ new Set();
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
async function refreshPlayingXIForLiveMatches() {
  const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  const allMatches = await storage2.getAllMatches();
  const liveMatches = allMatches.filter(
    (m) => (m.status === "live" || m.status === "delayed") && m.externalId
  );
  if (liveMatches.length === 0) return;
  for (const match of liveMatches) {
    try {
      const existingCount = await storage2.getPlayingXICount(match.id);
      if (existingCount >= 22) continue;
      const playingIds = await fetchPlayingXI(match.externalId);
      if (playingIds.length >= 2) {
        await storage2.markPlayingXI(match.id, playingIds);
        console.log(`Playing XI updated for ${match.team1} vs ${match.team2}: ${playingIds.length} players marked`);
      }
    } catch (err) {
      console.error(`Playing XI refresh failed for match ${match.id}:`, err);
    }
  }
}
async function refreshStaleMatchStatuses() {
  const now = Date.now();
  if (now - lastStatusRefresh < STATUS_REFRESH_INTERVAL) return;
  lastStatusRefresh = now;
  const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey) return;
  const allMatches = await storage2.getAllMatches();
  const staleMatches = allMatches.filter((m) => {
    if (m.status === "completed") return false;
    const start = new Date(m.startTime).getTime();
    const elapsed = now - start;
    if (m.status === "live") return true;
    if (m.status === "delayed") return true;
    if (m.status === "upcoming" && elapsed > -30 * 60 * 1e3) return true;
    return false;
  });
  if (staleMatches.length === 0) return;
  console.log(`Refreshing status for ${staleMatches.length} active/stale matches...`);
  for (const m of staleMatches) {
    if (!m.externalId) continue;
    try {
      const info = await fetchMatchInfo(m.externalId);
      if (!info) continue;
      const hasScoreData = !!(info.score && info.score.length > 0 && info.score.some((s) => s.r > 0 || s.w > 0 || s.o > 0));
      const { status: newStatus, statusNote } = determineMatchStatus(
        info.matchStarted,
        info.matchEnded,
        info.status,
        hasScoreData
      );
      const updates = {};
      if (newStatus !== m.status) updates.status = newStatus;
      if (statusNote && statusNote !== m.statusNote) updates.statusNote = statusNote;
      if (Object.keys(updates).length > 0) {
        await storage2.updateMatch(m.id, updates);
        console.log(`Status refresh: ${m.team1} vs ${m.team2}: ${m.status} -> ${newStatus} [${statusNote}]`);
      }
      if (newStatus === "live" || info.matchStarted && !info.matchEnded) {
        const xiCount = await storage2.getPlayingXICount(m.id);
        if (xiCount < 22) {
          const playingIds = await fetchPlayingXI(m.externalId);
          if (playingIds.length >= 2) {
            await storage2.markPlayingXI(m.id, playingIds);
            console.log(`Playing XI updated for ${m.team1} vs ${m.team2}: ${playingIds.length} players`);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to refresh status for match ${m.id}:`, err);
    }
  }
}
function mapCricApiRole(role) {
  const r = (role || "").toLowerCase();
  if (r.includes("wk") || r.includes("keeper")) return "WK";
  if (r.includes("allrounder") || r.includes("all-rounder")) return "AR";
  if (r.includes("bowl")) return "BOWL";
  if (r.includes("bat")) return "BAT";
  return "BAT";
}
function assignCredits(role) {
  switch (role) {
    case "WK":
      return 8.5;
    case "BAT":
      return 9;
    case "AR":
      return 9;
    case "BOWL":
      return 8.5;
    default:
      return 8;
  }
}
async function fetchSeriesSquad(seriesId) {
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey) return [];
  try {
    const url = `${CRICKET_API_BASE}/series_squad?apikey=${apiKey}&id=${seriesId}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Series Squad API error:", res.status);
      return [];
    }
    const json = await res.json();
    if (json.status !== "success" || !json.data) {
      console.error("Series Squad API non-success:", json.status);
      return [];
    }
    console.log(`Series Squad API: fetched ${json.data.length} teams for series ${seriesId}`);
    const allPlayers = [];
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
          credits: assignCredits(role)
        });
      }
    }
    return allPlayers;
  } catch (err) {
    console.error("Series Squad API error:", err);
    return [];
  }
}
async function fetchMatchSquad(externalMatchId) {
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey) return [];
  try {
    const url = `${CRICKET_API_BASE}/match_squad?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Squad API error:", res.status);
      return [];
    }
    const json = await res.json();
    if (json.status !== "success" || !json.data) {
      console.error("Squad API non-success:", json.status);
      return [];
    }
    console.log(`Squad API: fetched ${json.data.length} teams for match ${externalMatchId}`);
    const allPlayers = [];
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
          credits: assignCredits(role)
        });
      }
    }
    return allPlayers;
  } catch (err) {
    console.error("Squad API error:", err);
    return [];
  }
}
function calculateFantasyPoints(playerId, scorecard) {
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
async function fetchMatchScorecard(externalMatchId) {
  const apiKey = process.env.CRICKET_API_KEY;
  const pointsMap = /* @__PURE__ */ new Map();
  if (!apiKey) return pointsMap;
  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await fetch(url);
    if (!res.ok) return pointsMap;
    const json = await res.json();
    if (json.status !== "success" || !json.data?.scorecard) return pointsMap;
    console.log(`Scorecard API: fetched ${json.data.scorecard.length} innings for match ${externalMatchId}`);
    const allPlayerIds = /* @__PURE__ */ new Set();
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
async function fetchLiveScorecard(externalMatchId) {
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
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
        fantasyPoints: b.batsman?.id ? calculateFantasyPoints(b.batsman.id, scorecard) : 0
      })),
      bowling: (inn.bowling || []).map((b) => ({
        name: b.bowler?.name || "",
        o: b.o,
        m: b.m,
        r: b.r,
        w: b.w,
        eco: b.eco,
        fantasyPoints: b.bowler?.id ? calculateFantasyPoints(b.bowler.id, scorecard) : 0
      }))
    }));
    return {
      score: json.data.score || [],
      innings,
      status: json.data.name || ""
    };
  } catch (err) {
    console.error("Live scorecard error:", err);
    return null;
  }
}
var CRICKET_API_BASE, DELAY_KEYWORDS, TEAM_COLORS, TRACKED_SERIES, lastStatusRefresh, STATUS_REFRESH_INTERVAL;
var init_cricket_api = __esm({
  "server/cricket-api.ts"() {
    "use strict";
    CRICKET_API_BASE = "https://api.cricapi.com/v1";
    DELAY_KEYWORDS = [
      "rain",
      "delay",
      "delayed",
      "no result",
      "abandoned",
      "postponed",
      "wet outfield",
      "weather",
      "inspection",
      "covers",
      "drizzle",
      "toss yet",
      "start delayed",
      "play yet to",
      "yet to begin"
    ];
    TEAM_COLORS = {
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
      AFG: "#0066FF"
    };
    TRACKED_SERIES = [
      { id: "0cdf6736-ad9b-4e95-a647-5ee3a99c5510", name: "ICC Men's T20 World Cup 2026" }
    ];
    lastStatusRefresh = 0;
    STATUS_REFRESH_INTERVAL = 5 * 60 * 1e3;
  }
});

// server/index.ts
import express from "express";

// server/routes.ts
init_storage();
init_cricket_api();
import { createServer } from "node:http";
import session from "express-session";
import { createHmac } from "crypto";
var ADMIN_PHONES = ["9840872462", "9884334973"];
var TOKEN_SECRET = process.env.SESSION_SECRET || "cdo-session-secret-dev";
function generateAuthToken(userId) {
  const hmac = createHmac("sha256", TOKEN_SECRET);
  hmac.update(userId);
  const sig = hmac.digest("hex");
  return `${userId}.${sig}`;
}
function verifyAuthToken(token) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [userId, sig] = parts;
  const hmac = createHmac("sha256", TOKEN_SECRET);
  hmac.update(userId);
  const expected = hmac.digest("hex");
  if (sig !== expected) return null;
  return userId;
}
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userId = verifyAuthToken(token);
    if (userId) {
      req.session.userId = userId;
      return next();
    }
  }
  return res.status(401).json({ message: "Not authenticated" });
}
async function isAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
async function registerRoutes(app2) {
  app2.use(
    session({
      secret: process.env.SESSION_SECRET || "cdo-session-secret-dev",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1e3,
        sameSite: "lax"
      }
    })
  );
  app2.post("/api/auth/signup", async (req, res) => {
    try {
      const { username, email, phone, password } = req.body;
      if (!username || !phone || !password) {
        return res.status(400).json({ message: "Username, phone number, and password are required" });
      }
      const existingPhone = await storage.getUserByPhone(phone);
      if (existingPhone) {
        return res.status(400).json({ message: "Phone number already in use" });
      }
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }
      if (email) {
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }
      const isAdminUser = ADMIN_PHONES.includes(phone);
      const user = await storage.createUser({
        username,
        email,
        phone: phone || "",
        password
      });
      if (isAdminUser) {
        await storage.setUserAdmin(user.id, true);
        user.isAdmin = true;
      }
      req.session.userId = user.id;
      return res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          teamName: user.teamName,
          isVerified: user.isVerified,
          isAdmin: user.isAdmin
        },
        token: generateAuthToken(user.id)
      });
    } catch (err) {
      console.error("Signup error:", err);
      return res.status(500).json({ message: "Signup failed" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res.status(400).json({ message: "Phone number and password are required" });
      }
      const user = await storage.getUserByPhone(phone);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.userId = user.id;
      return res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          teamName: user.teamName,
          isVerified: user.isVerified,
          isAdmin: user.isAdmin
        },
        token: generateAuthToken(user.id)
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Login failed" });
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
    });
    return res.json({ ok: true });
  });
  app2.get("/api/auth/me", async (req, res) => {
    let userId = req.session.userId;
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        userId = verifyAuthToken(authHeader.slice(7)) || void 0;
      }
    }
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        teamName: user.teamName,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin
      }
    });
  });
  app2.put(
    "/api/auth/team-name",
    isAuthenticated,
    async (req, res) => {
      try {
        const { teamName } = req.body;
        if (!teamName || typeof teamName !== "string" || teamName.trim().length === 0) {
          return res.status(400).json({ message: "Team name is required" });
        }
        if (teamName.trim().length > 30) {
          return res.status(400).json({ message: "Team name must be 30 characters or less" });
        }
        await storage.updateUserTeamName(req.session.userId, teamName.trim());
        return res.json({ teamName: teamName.trim() });
      } catch (err) {
        console.error("Update team name error:", err);
        return res.status(500).json({ message: "Failed to update team name" });
      }
    }
  );
  app2.post(
    "/api/auth/verify-code",
    isAuthenticated,
    async (req, res) => {
      try {
        const { code } = req.body;
        if (!code || code.length !== 4) {
          return res.status(400).json({ message: "Invalid code format" });
        }
        const codeRecord = await storage.getActiveCode(code);
        if (!codeRecord) {
          return res.status(400).json({ message: "Invalid or inactive code" });
        }
        await storage.updateUserVerified(req.session.userId, true);
        await storage.logCodeVerification(req.session.userId, codeRecord.id);
        return res.json({ verified: true });
      } catch (err) {
        console.error("Code verification error:", err);
        return res.status(500).json({ message: "Verification failed" });
      }
    }
  );
  app2.get(
    "/api/admin/codes",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      const codes = await storage.getAllCodes();
      return res.json({ codes });
    }
  );
  app2.post(
    "/api/admin/codes",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { code } = req.body;
        if (!code || code.length !== 4) {
          return res.status(400).json({ message: "Code must be 4 digits" });
        }
        const existing = await storage.getActiveCode(code);
        if (existing) {
          return res.status(400).json({ message: "Code already exists" });
        }
        const created = await storage.createCode(code, req.session.userId);
        return res.json({ code: created });
      } catch (err) {
        console.error("Create code error:", err);
        return res.status(500).json({ message: "Failed to create code" });
      }
    }
  );
  app2.delete(
    "/api/admin/codes/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      await storage.deleteCode(req.params.id);
      return res.json({ ok: true });
    }
  );
  app2.post(
    "/api/admin/make-admin",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId required" });
      await storage.setUserAdmin(userId, true);
      return res.json({ ok: true });
    }
  );
  app2.get("/api/matches", isAuthenticated, async (_req, res) => {
    try {
      await refreshStaleMatchStatuses();
    } catch (e) {
      console.error("Status refresh error:", e);
    }
    const allMatches = await storage.getAllMatches();
    const now = /* @__PURE__ */ new Date();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1e3;
    const THREE_HOURS = 3 * 60 * 60 * 1e3;
    const matchesWithParticipants = [];
    for (const m of allMatches) {
      const start = new Date(m.startTime).getTime();
      const diff = start - now.getTime();
      const elapsed = now.getTime() - start;
      const effectiveStatus = m.status;
      const teams = await storage.getAllTeamsForMatch(m.id);
      const uniqueUsers = new Set(teams.map((t) => t.userId));
      const participantCount = uniqueUsers.size;
      const isUpcoming = (effectiveStatus === "upcoming" || effectiveStatus === "delayed") && diff > -THREE_HOURS && diff <= TWENTY_FOUR_HOURS;
      const isLive = effectiveStatus === "live";
      const isDelayed = effectiveStatus === "delayed";
      const isRecentlyCompleted = effectiveStatus === "completed" && elapsed <= THREE_HOURS;
      const hasParticipants = participantCount > 0;
      if (hasParticipants || isUpcoming || isLive || isDelayed || isRecentlyCompleted) {
        matchesWithParticipants.push({ match: m, participantCount });
      }
    }
    matchesWithParticipants.sort((a, b) => {
      if (a.participantCount > 0 && b.participantCount === 0) return -1;
      if (a.participantCount === 0 && b.participantCount > 0) return 1;
      const order = { upcoming: 0, delayed: 0, live: 1, completed: 2 };
      const oa = order[a.match.status] ?? 1;
      const ob = order[b.match.status] ?? 1;
      if (oa !== ob) return oa - ob;
      return new Date(a.match.startTime).getTime() - new Date(b.match.startTime).getTime();
    });
    const result = matchesWithParticipants.map((mp) => ({
      ...mp.match,
      participantCount: mp.participantCount
    }));
    return res.json({ matches: result });
  });
  app2.get(
    "/api/matches/:id",
    isAuthenticated,
    async (req, res) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });
      const allTeams = await storage.getAllTeamsForMatch(req.params.id);
      const uniqueUsers = new Set(allTeams.map((t) => t.userId));
      return res.json({ match: { ...match, spotsFilled: uniqueUsers.size, participantCount: uniqueUsers.size } });
    }
  );
  app2.get(
    "/api/matches/:id/players",
    isAuthenticated,
    async (req, res) => {
      const matchId = req.params.id;
      let matchPlayers = await storage.getPlayersForMatch(matchId);
      if (matchPlayers.length === 0) {
        const match2 = await storage.getMatch(matchId);
        if (match2?.externalId) {
          try {
            const { fetchMatchSquad: fetchMatchSquad2, fetchSeriesSquad: fetchSeriesSquad2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
            let squad = await fetchMatchSquad2(match2.externalId);
            if (squad.length === 0 && match2.seriesId) {
              console.log(`Match squad empty, trying series squad for series ${match2.seriesId}...`);
              const seriesPlayers = await fetchSeriesSquad2(match2.seriesId);
              const team1 = match2.team1.toLowerCase();
              const team2 = match2.team2.toLowerCase();
              squad = seriesPlayers.filter((p) => {
                const pTeam = p.team.toLowerCase();
                return pTeam === team1 || pTeam === team2 || pTeam.includes(team1) || team1.includes(pTeam) || pTeam.includes(team2) || team2.includes(pTeam);
              });
              if (squad.length > 0) {
                console.log(`Found ${squad.length} players from series squad for ${match2.team1} vs ${match2.team2}`);
              }
            }
            if (squad.length > 0) {
              const playersToCreate = squad.map((p) => ({
                matchId,
                externalId: p.externalId,
                name: p.name,
                team: p.team,
                teamShort: p.teamShort,
                role: p.role,
                credits: p.credits
              }));
              await storage.bulkCreatePlayers(playersToCreate);
              matchPlayers = await storage.getPlayersForMatch(matchId);
              console.log(`Auto-fetched ${matchPlayers.length} players for match ${matchId}`);
            }
          } catch (err) {
            console.error("Auto-fetch squad error:", err);
          }
        }
      }
      const match = matchPlayers.length > 0 ? await storage.getMatch(matchId) : null;
      if (match && (match.status === "live" || match.status === "delayed") && match.externalId) {
        const xiCount = await storage.getPlayingXICount(matchId);
        if (xiCount < 22) {
          try {
            const { fetchPlayingXI: fetchPlayingXI2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
            const playingIds = await fetchPlayingXI2(match.externalId);
            if (playingIds.length >= 2) {
              await storage.markPlayingXI(matchId, playingIds);
              matchPlayers = await storage.getPlayersForMatch(matchId);
            }
          } catch (err) {
            console.error("Playing XI auto-refresh error:", err);
          }
        }
      }
      return res.json({ players: matchPlayers });
    }
  );
  app2.post(
    "/api/matches/:id/sync-scorecard",
    isAuthenticated,
    async (req, res) => {
      const matchId = req.params.id;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });
      if (!match.externalId) return res.status(400).json({ message: "No external match ID" });
      try {
        const { fetchMatchScorecard: fetchMatchScorecard3 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
        const pointsMap = await fetchMatchScorecard3(match.externalId);
        if (pointsMap.size === 0) {
          return res.json({ message: "No scorecard data available yet", updated: 0 });
        }
        const matchPlayers = await storage.getPlayersForMatch(matchId);
        let updated = 0;
        for (const player of matchPlayers) {
          if (player.externalId && pointsMap.has(player.externalId)) {
            const pts = pointsMap.get(player.externalId);
            await storage.updatePlayer(player.id, { points: pts });
            updated++;
          }
        }
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        for (const team of allTeams) {
          const teamPlayerIds = team.playerIds;
          let totalPoints = 0;
          for (const pid of teamPlayerIds) {
            const p = matchPlayers.find((mp) => mp.id === pid);
            if (p && p.externalId) {
              let pts = pointsMap.get(p.externalId) || 0;
              if (pid === team.captainId) pts *= 2;
              else if (pid === team.viceCaptainId) pts *= 1.5;
              totalPoints += pts;
            }
          }
          await storage.updateUserTeamPoints(team.id, totalPoints);
        }
        return res.json({ message: `Updated ${updated} player scores`, updated });
      } catch (err) {
        console.error("Scorecard sync error:", err);
        return res.status(500).json({ message: "Failed to sync scorecard" });
      }
    }
  );
  app2.get(
    "/api/matches/:id/live-scorecard",
    isAuthenticated,
    async (req, res) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });
      if (!match.externalId) return res.status(400).json({ message: "No external match ID" });
      try {
        const { fetchLiveScorecard: fetchLiveScorecard2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
        const scorecard = await fetchLiveScorecard2(match.externalId);
        if (!scorecard) {
          return res.json({ scorecard: null, message: "No scorecard data available yet" });
        }
        return res.json({ scorecard });
      } catch (err) {
        console.error("Live scorecard error:", err);
        return res.status(500).json({ message: "Failed to fetch scorecard" });
      }
    }
  );
  app2.get(
    "/api/matches/:id/live-score",
    isAuthenticated,
    async (req, res) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });
      if (!match.externalId) return res.status(400).json({ message: "No external match ID" });
      try {
        const info = await fetchMatchInfo(match.externalId);
        if (!info) return res.json({ score: null });
        return res.json({
          score: info.score || [],
          status: info.status,
          matchStarted: info.matchStarted,
          matchEnded: info.matchEnded
        });
      } catch (err) {
        console.error("Live score error:", err);
        return res.status(500).json({ message: "Failed to fetch live score" });
      }
    }
  );
  app2.get(
    "/api/matches/:id/teams",
    isAuthenticated,
    async (req, res) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });
      const now = /* @__PURE__ */ new Date();
      const matchStart = new Date(match.startTime);
      const isLive = now.getTime() >= matchStart.getTime();
      const allTeams = await storage.getAllTeamsForMatch(req.params.id);
      const allUsers = {};
      for (const t of allTeams) {
        if (!allUsers[t.userId]) {
          const u = await storage.getUser(t.userId);
          allUsers[t.userId] = {
            username: u?.username || "Unknown",
            teamName: u?.teamName || ""
          };
        }
      }
      if (isLive) {
        const teamsWithInfo = allTeams.map((t) => ({
          ...t,
          username: allUsers[t.userId]?.username || "Unknown",
          userTeamName: allUsers[t.userId]?.teamName || ""
        }));
        return res.json({ teams: teamsWithInfo, visibility: "full" });
      } else {
        const hiddenTeams = allTeams.map((t) => ({
          id: t.id,
          userId: t.userId,
          matchId: t.matchId,
          name: t.name,
          username: allUsers[t.userId]?.username || "Unknown",
          userTeamName: allUsers[t.userId]?.teamName || "",
          playerIds: t.userId === req.session.userId ? t.playerIds : [],
          captainId: t.userId === req.session.userId ? t.captainId : null,
          viceCaptainId: t.userId === req.session.userId ? t.viceCaptainId : null,
          totalPoints: t.totalPoints,
          createdAt: t.createdAt
        }));
        return res.json({ teams: hiddenTeams, visibility: "hidden" });
      }
    }
  );
  app2.get(
    "/api/my-teams",
    isAuthenticated,
    async (req, res) => {
      const teams = await storage.getUserTeams(req.session.userId);
      return res.json({ teams });
    }
  );
  app2.get(
    "/api/my-teams/:matchId",
    isAuthenticated,
    async (req, res) => {
      const teams = await storage.getUserTeamsForMatch(
        req.session.userId,
        req.params.matchId
      );
      return res.json({ teams });
    }
  );
  app2.post(
    "/api/teams",
    isAuthenticated,
    async (req, res) => {
      try {
        const { matchId, name, playerIds, captainId, viceCaptainId } = req.body;
        const match = await storage.getMatch(matchId);
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }
        const now = /* @__PURE__ */ new Date();
        const matchStart = new Date(match.startTime);
        if (now.getTime() >= matchStart.getTime() - 1e3) {
          return res.status(400).json({ message: "Entry deadline has passed" });
        }
        if (match.status === "live" || match.status === "completed") {
          return res.status(400).json({ message: "Match has already started" });
        }
        const existingTeams = await storage.getUserTeamsForMatch(
          req.session.userId,
          matchId
        );
        if (existingTeams.length >= 3) {
          return res.status(400).json({ message: "Maximum 3 teams per match" });
        }
        if (!playerIds || playerIds.length !== 11) {
          return res.status(400).json({ message: "Must select exactly 11 players" });
        }
        if (!captainId || !viceCaptainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain required" });
        }
        const sortedNewIds = [...playerIds].sort();
        for (const et of existingTeams) {
          const sortedExisting = [...et.playerIds || []].sort();
          if (sortedNewIds.length === sortedExisting.length && sortedNewIds.every((id, i) => id === sortedExisting[i])) {
            return res.status(400).json({ message: "You already have a team with the same players" });
          }
        }
        const team = await storage.createUserTeam({
          userId: req.session.userId,
          matchId,
          name: name || `Team ${existingTeams.length + 1}`,
          playerIds,
          captainId,
          viceCaptainId
        });
        return res.json({ team });
      } catch (err) {
        console.error("Create team error:", err);
        return res.status(500).json({ message: "Failed to create team" });
      }
    }
  );
  app2.delete(
    "/api/teams/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const team = await storage.getUserTeam(req.params.id);
        if (!team) {
          return res.status(404).json({ message: "Team not found" });
        }
        if (team.userId !== req.session.userId) {
          return res.status(403).json({ message: "Not your team" });
        }
        const match = await storage.getMatch(team.matchId);
        if (match) {
          const now = /* @__PURE__ */ new Date();
          const matchStart = new Date(match.startTime);
          const isDelayed = match.status === "delayed";
          if (match.status === "live" || match.status === "completed") {
            return res.status(400).json({ message: "Cannot delete team after match has started" });
          }
          if (!isDelayed && now.getTime() >= matchStart.getTime() - 1e3) {
            return res.status(400).json({ message: "Cannot delete team after deadline has passed" });
          }
        }
        await storage.deleteUserTeam(req.params.id, req.session.userId);
        return res.json({ ok: true });
      } catch (err) {
        console.error("Delete team error:", err);
        return res.status(500).json({ message: "Failed to delete team" });
      }
    }
  );
  app2.get("/api/leaderboard", isAuthenticated, async (_req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      return res.json(leaderboard);
    } catch (e) {
      return res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });
  app2.get("/api/server-time", (_req, res) => {
    return res.json({ serverTime: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.post(
    "/api/admin/sync-matches",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        const apiMatches = await fetchUpcomingMatches();
        let created = 0;
        let updated = 0;
        const existing = await storage.getAllMatches();
        for (const m of apiMatches) {
          const dup = existing.find((e) => e.externalId === m.externalId);
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
              league: m.league,
              totalPrize: "0",
              entryFee: 0,
              spotsTotal: 100,
              spotsFilled: 0
            });
            created++;
          } else {
            const updates = {};
            if (dup.status !== m.status) updates.status = m.status;
            if (new Date(dup.startTime).getTime() !== m.startTime.getTime()) updates.startTime = m.startTime;
            if (dup.league !== m.league) updates.league = m.league;
            if (m.seriesId && dup.seriesId !== m.seriesId) updates.seriesId = m.seriesId;
            if (Object.keys(updates).length > 0) {
              await storage.updateMatch(dup.id, updates);
              updated++;
            }
          }
        }
        await refreshStaleMatchStatuses();
        return res.json({
          synced: created,
          updated,
          total: apiMatches.length,
          message: `Synced ${created} new, updated ${updated} existing matches from Cricket API`
        });
      } catch (err) {
        console.error("Sync error:", err);
        return res.status(500).json({ message: "Sync failed" });
      }
    }
  );
  app2.post(
    "/api/admin/matches",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const {
          team1,
          team1Short,
          team1Color,
          team2,
          team2Short,
          team2Color,
          venue,
          startTime,
          league
        } = req.body;
        if (!team1 || !team2 || !startTime) {
          return res.status(400).json({ message: "team1, team2, and startTime are required" });
        }
        const match = await storage.createMatch({
          team1,
          team1Short: team1Short || team1.substring(0, 3).toUpperCase(),
          team1Color: team1Color || "#333",
          team2,
          team2Short: team2Short || team2.substring(0, 3).toUpperCase(),
          team2Color: team2Color || "#666",
          venue: venue || "",
          startTime: new Date(startTime),
          status: "upcoming",
          league: league || "",
          totalPrize: "0",
          entryFee: 0,
          spotsTotal: 100,
          spotsFilled: 0
        });
        return res.json({ match });
      } catch (err) {
        console.error("Create match error:", err);
        return res.status(500).json({ message: "Failed to create match" });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/players",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { players: playerList } = req.body;
        if (!playerList || !Array.isArray(playerList)) {
          return res.status(400).json({ message: "players array required" });
        }
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const playersToCreate = playerList.map((p) => ({
          matchId,
          name: p.name,
          team: p.team,
          teamShort: p.teamShort || p.team.substring(0, 3).toUpperCase(),
          role: p.role || "BAT",
          credits: p.credits || 8,
          points: p.points || 0,
          selectedBy: p.selectedBy || 0,
          recentForm: p.recentForm || [],
          isImpactPlayer: p.isImpactPlayer || false
        }));
        await storage.bulkCreatePlayers(playersToCreate);
        return res.json({
          message: `Added ${playersToCreate.length} players`
        });
      } catch (err) {
        console.error("Add players error:", err);
        return res.status(500).json({ message: "Failed to add players" });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/refresh-playing-xi",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (!match.externalId) return res.status(400).json({ message: "No external match ID" });
        const { fetchPlayingXI: fetchPlayingXI2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
        const playingIds = await fetchPlayingXI2(match.externalId);
        if (playingIds.length === 0) {
          return res.json({ message: "No Playing XI data available yet from scorecard", count: 0 });
        }
        await storage.markPlayingXI(matchId, playingIds);
        return res.json({ message: `Playing XI updated: ${playingIds.length} players marked`, count: playingIds.length });
      } catch (err) {
        console.error("Refresh Playing XI error:", err);
        return res.status(500).json({ message: "Failed to refresh Playing XI" });
      }
    }
  );
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
init_cricket_api();
init_storage();
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  const webDistCandidates = [
    path.resolve(process.cwd(), "web-app"),
    path.resolve(process.cwd(), "dist", "web"),
    path.resolve(process.cwd(), "static-build", "web")
  ];
  let webDistPath = "";
  for (const candidate of webDistCandidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      webDistPath = candidate;
      break;
    }
  }
  const hasWebBuild = !!webDistPath;
  log("Serving static Expo files with dynamic manifest routing");
  if (hasWebBuild) {
    log(`Web build found at ${webDistPath} \u2014 serving web app to browsers`);
  } else {
    log("No web build found, will serve landing page to browsers");
  }
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      if (req.path === "/" || req.path === "/manifest") {
        return serveExpoManifest(platform, res);
      }
    }
    next();
  });
  if (hasWebBuild) {
    app2.use(express.static(webDistPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));
  }
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.method === "GET" && req.accepts("html")) {
      if (hasWebBuild) {
        const indexHtml = fs.readFileSync(path.join(webDistPath, "index.html"), "utf-8");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.status(200).send(indexHtml);
      }
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  async function seedReferenceCodes() {
    try {
      const existing = await storage.getAllCodes();
      if (existing.length === 0) {
        log("No reference codes found, seeding defaults...");
        const defaultCodes = ["1234", "5678", "9012", "3456"];
        for (const code of defaultCodes) {
          await storage.createCode(code);
        }
        log(`Seeded ${defaultCodes.length} default reference codes`);
      }
    } catch (err) {
      console.error("Failed to seed reference codes:", err);
    }
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
      seedReferenceCodes().catch((err) => {
        console.error("Reference code seeding failed:", err);
      });
      syncMatchesFromApi().catch((err) => {
        console.error("Initial match sync failed:", err);
      });
      const TWO_HOURS = 2 * 60 * 60 * 1e3;
      setInterval(() => {
        log("Periodic match sync (every 2 hours)...");
        syncMatchesFromApi().catch((err) => {
          console.error("Periodic match sync failed:", err);
        });
      }, TWO_HOURS);
      const recentlyRefreshed = /* @__PURE__ */ new Map();
      const FIVE_MINUTES = 5 * 60 * 1e3;
      const TWENTY_MINUTES = 20 * 60 * 1e3;
      async function refreshPlayingXI() {
        try {
          const allMatches = await storage.getAllMatches();
          const now = Date.now();
          for (const match of allMatches) {
            if (!match.externalId) continue;
            if (match.status === "completed") continue;
            const startMs = new Date(match.startTime).getTime();
            const timeUntilStart = startMs - now;
            const isInWindow = timeUntilStart <= TWENTY_MINUTES && timeUntilStart > -TWO_HOURS;
            const isLive = match.status === "live" || match.status === "delayed";
            if (!isInWindow && !isLive) continue;
            const lastRefresh = recentlyRefreshed.get(match.id) || 0;
            if (now - lastRefresh < FIVE_MINUTES) continue;
            log(`Playing XI refresh: ${match.team1} vs ${match.team2} (starts in ${Math.round(timeUntilStart / 6e4)}m, status: ${match.status})`);
            try {
              let squad = await fetchMatchSquad(match.externalId);
              if (squad.length === 0 && match.seriesId) {
                const seriesPlayers = await fetchSeriesSquad(match.seriesId);
                const t1 = match.team1.toLowerCase();
                const t2 = match.team2.toLowerCase();
                squad = seriesPlayers.filter((p) => {
                  const pt = p.team.toLowerCase();
                  return pt === t1 || pt === t2 || pt.includes(t1) || t1.includes(pt) || pt.includes(t2) || t2.includes(pt);
                });
              }
              if (squad.length > 0) {
                await storage.deletePlayersForMatch(match.id);
                await storage.bulkCreatePlayers(
                  squad.map((p) => ({
                    matchId: match.id,
                    externalId: p.externalId,
                    name: p.name,
                    team: p.team,
                    teamShort: p.teamShort,
                    role: p.role,
                    credits: p.credits
                  }))
                );
                log(`Playing XI updated: ${squad.length} players for ${match.team1} vs ${match.team2}`);
              }
              recentlyRefreshed.set(match.id, now);
            } catch (err) {
              console.error(`Playing XI refresh failed for ${match.id}:`, err);
            }
          }
        } catch (err) {
          console.error("Playing XI scheduler error:", err);
        }
      }
      setInterval(refreshPlayingXI, FIVE_MINUTES);
      log("Playing XI auto-refresh scheduler started (every 5min, 20min before match)");
    }
  );
})();
