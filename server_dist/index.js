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
  adminAuditLog: () => adminAuditLog,
  apiCallLog: () => apiCallLog,
  codeVerifications: () => codeVerifications,
  insertMatchSchema: () => insertMatchSchema,
  insertPlayerSchema: () => insertPlayerSchema,
  insertReferenceCodeSchema: () => insertReferenceCodeSchema,
  insertUserSchema: () => insertUserSchema,
  insertUserTeamSchema: () => insertUserTeamSchema,
  matchPlayerStatus: () => matchPlayerStatus,
  matchPredictions: () => matchPredictions,
  matches: () => matches,
  players: () => players,
  referenceCodes: () => referenceCodes,
  rewards: () => rewards,
  tournamentLedger: () => tournamentLedger,
  userTeams: () => userTeams,
  userWeeklyUsage: () => userWeeklyUsage,
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
var users, referenceCodes, matches, players, userTeams, codeVerifications, matchPredictions, rewards, tournamentLedger, apiCallLog, matchPlayerStatus, userWeeklyUsage, adminAuditLog, insertUserSchema, insertReferenceCodeSchema, insertMatchSchema, insertPlayerSchema, insertUserTeamSchema;
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
      playingXIManual: boolean("playing_xi_manual").notNull().default(false),
      scoreString: text("score_string").notNull().default(""),
      lastSyncAt: timestamp("last_sync_at"),
      tournamentName: text("tournament_name"),
      entryStake: integer("entry_stake").notNull().default(30),
      potProcessed: boolean("pot_processed").notNull().default(false),
      officialWinner: varchar("official_winner", { length: 10 }),
      isVoid: boolean("is_void").notNull().default(false),
      impactFeaturesEnabled: boolean("impact_features_enabled").notNull().default(false),
      revisedStartTime: timestamp("revised_start_time"),
      adminUnlockOverride: boolean("admin_unlock_override").notNull().default(false),
      firstScorecardAt: timestamp("first_scorecard_at"),
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
      isPlayingXI: boolean("is_playing_xi").notNull().default(false),
      apiName: text("api_name")
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
      primaryImpactId: varchar("primary_impact_id"),
      backupImpactId: varchar("backup_impact_id"),
      captainType: varchar("captain_type", { length: 20 }).notNull().default("player"),
      vcType: varchar("vc_type", { length: 20 }).notNull().default("player"),
      invisibleMode: boolean("invisible_mode").notNull().default(false),
      predictionPoints: integer("prediction_points").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    codeVerifications = pgTable("code_verifications", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull(),
      codeId: varchar("code_id").notNull(),
      verifiedAt: timestamp("verified_at").notNull().defaultNow()
    });
    matchPredictions = pgTable("match_predictions", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull(),
      matchId: varchar("match_id").notNull(),
      predictedWinner: varchar("predicted_winner", { length: 10 }).notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    rewards = pgTable("rewards", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      brand: text("brand").notNull(),
      title: text("title").notNull(),
      code: text("code").notNull(),
      terms: text("terms").notNull().default(""),
      isClaimed: boolean("is_claimed").notNull().default(false),
      claimedByUserId: varchar("claimed_by_user_id"),
      claimedMatchId: varchar("claimed_match_id"),
      claimedAt: timestamp("claimed_at"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    tournamentLedger = pgTable("tournament_ledger", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull(),
      userName: text("user_name").notNull().default(""),
      matchId: varchar("match_id").notNull(),
      tournamentName: text("tournament_name").notNull(),
      pointsChange: integer("points_change").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    apiCallLog = pgTable("api_call_log", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      dateKey: varchar("date_key", { length: 10 }).notNull(),
      callCount: integer("call_count").notNull().default(0),
      lastCalledAt: timestamp("last_called_at").notNull().defaultNow()
    });
    matchPlayerStatus = pgTable("match_player_status", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      matchId: varchar("match_id").notNull(),
      playerId: varchar("player_id").notNull(),
      adminStatus: varchar("admin_status", { length: 20 }).notNull().default("not_active"),
      actualParticipationStatus: varchar("actual_participation_status", { length: 30 }).notNull().default("unknown"),
      officialImpactSubUsed: boolean("official_impact_sub_used").notNull().default(false),
      sourceType: varchar("source_type", { length: 20 }).notNull().default("admin"),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    userWeeklyUsage = pgTable("user_weekly_usage", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull(),
      weekStartDate: varchar("week_start_date", { length: 10 }).notNull(),
      multiTeamUsageCount: integer("multi_team_usage_count").notNull().default(0),
      invisibleModeUsageCount: integer("invisible_mode_usage_count").notNull().default(0)
    });
    adminAuditLog = pgTable("admin_audit_log", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      adminUserId: varchar("admin_user_id").notNull(),
      actionType: text("action_type").notNull(),
      entityType: text("entity_type").notNull().default(""),
      entityId: varchar("entity_id"),
      matchId: varchar("match_id"),
      metadata: text("metadata").notNull().default(""),
      createdAt: timestamp("created_at").notNull().defaultNow()
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
      viceCaptainId: z.string(),
      primaryImpactId: z.string().optional(),
      backupImpactId: z.string().optional(),
      captainType: z.enum(["player", "impact_slot"]).default("player"),
      vcType: z.enum(["player", "impact_slot"]).default("player"),
      invisibleMode: z.boolean().default(false)
    });
  }
});

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
function markServerReady() {
  serverReady = true;
}
async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log("[DB] Running idempotent schema migrations...");
    await client.query(`
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS revised_start_time TIMESTAMP;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS admin_unlock_override BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS first_scorecard_at TIMESTAMP;
    `);
    console.log("[DB] Migrations complete.");
  } catch (err) {
    console.error("[DB] Migration error:", err.message);
  } finally {
    client.release();
  }
}
async function connectWithRetry(maxAttempts = 10, delayMs = 3e3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[DB] Connecting to database... (attempt ${attempt}/${maxAttempts})`
      );
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      dbConnected = true;
      console.log("[DB] Connected successfully");
      await runMigrations();
      return;
    } catch (err) {
      console.error(
        `[DB] Connection failed (attempt ${attempt}/${maxAttempts}): ${err.message}`
      );
      if (attempt < maxAttempts) {
        console.log(`[DB] Retrying in ${delayMs / 1e3}s...`);
        await new Promise((resolve2) => setTimeout(resolve2, delayMs));
      }
    }
  }
  console.error(
    "[DB] All connection attempts failed. Server will start but DB calls may fail."
  );
}
var isRailway, pool, dbConnected, serverReady, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    isRailway = process.env.DATABASE_URL?.includes("railway") || process.env.DATABASE_URL?.includes("rlwy");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isRailway ? { rejectUnauthorized: false } : void 0,
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 2e3
    });
    pool.on("error", (err) => {
      console.error("[DB] Unexpected pool error:", err.message);
    });
    pool.on("connect", (client) => {
      client.query("SET statement_timeout = 5000").catch((err) => {
        console.error("[DB] Failed to set statement_timeout:", err.message);
      });
    });
    dbConnected = false;
    serverReady = false;
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
      async deleteMatch(id) {
        await db.delete(matches).where(eq(matches.id, id));
      }
      async deleteMatchCascade(id) {
        await db.delete(matchPlayerStatus).where(eq(matchPlayerStatus.matchId, id));
        await db.delete(matchPredictions).where(eq(matchPredictions.matchId, id));
        await db.delete(players).where(eq(players.matchId, id));
        await db.delete(adminAuditLog).where(eq(adminAuditLog.matchId, id));
        await db.delete(matches).where(eq(matches.id, id));
      }
      async deleteTeam(id) {
        await db.delete(userTeams).where(eq(userTeams.id, id));
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
      async upsertPlayersForMatch(matchId, data) {
        if (data.length === 0) return;
        const existing = await this.getPlayersForMatch(matchId);
        const existingByExtId = new Map(existing.filter((p) => p.externalId).map((p) => [p.externalId, p]));
        const existingByName = new Map(existing.map((p) => [`${p.name.toLowerCase()}__${p.teamShort.toLowerCase()}`, p]));
        const toInsert = [];
        for (const p of data) {
          const found = p.externalId && existingByExtId.get(p.externalId) || existingByName.get(`${p.name.toLowerCase()}__${p.teamShort.toLowerCase()}`);
          if (found) {
            const updates = {};
            if (p.externalId && !found.externalId) updates.externalId = p.externalId;
            if (p.role && p.role !== found.role) updates.role = p.role;
            if (p.credits !== void 0 && p.credits !== found.credits) updates.credits = p.credits;
            if (p.team && p.team !== found.team) updates.team = p.team;
            if (Object.keys(updates).length > 0) {
              await this.updatePlayer(found.id, updates);
            }
          } else {
            toInsert.push(p);
          }
        }
        if (toInsert.length > 0) {
          await db.insert(players).values(toInsert);
        }
      }
      async deletePlayersForMatch(matchId) {
        await db.delete(players).where(eq(players.matchId, matchId));
      }
      async deletePlayer(playerId) {
        await db.delete(players).where(eq(players.id, playerId));
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
      async updateUserTeam(teamId, userId, data) {
        const updateData = {
          playerIds: data.playerIds,
          captainId: data.captainId,
          viceCaptainId: data.viceCaptainId
        };
        if (data.name) updateData.name = data.name;
        if (data.primaryImpactId !== void 0) updateData.primaryImpactId = data.primaryImpactId;
        if (data.backupImpactId !== void 0) updateData.backupImpactId = data.backupImpactId;
        if (data.captainType !== void 0) updateData.captainType = data.captainType;
        if (data.vcType !== void 0) updateData.vcType = data.vcType;
        if (data.invisibleMode !== void 0) updateData.invisibleMode = data.invisibleMode;
        const [updated] = await db.update(userTeams).set(updateData).where(and(eq(userTeams.id, teamId), eq(userTeams.userId, userId))).returning();
        return updated;
      }
      async deleteUserTeam(teamId, userId) {
        await db.delete(userTeams).where(and(eq(userTeams.id, teamId), eq(userTeams.userId, userId)));
      }
      async updateUserTeamPoints(teamId, totalPoints) {
        await db.update(userTeams).set({ totalPoints }).where(eq(userTeams.id, teamId));
      }
      async markPlayingXI(matchId, externalPlayerIds) {
        if (externalPlayerIds.length === 0) return 0;
        await db.update(players).set({ isPlayingXI: false, points: 0 }).where(eq(players.matchId, matchId));
        let updated = 0;
        for (const extId of externalPlayerIds) {
          const result = await db.update(players).set({ isPlayingXI: true, points: 4 }).where(and(eq(players.matchId, matchId), eq(players.externalId, extId)));
          updated++;
        }
        return updated;
      }
      async markPlayingXIByIds(matchId, playerIds) {
        if (playerIds.length === 0) return 0;
        await db.update(players).set({ isPlayingXI: false, points: 0 }).where(eq(players.matchId, matchId));
        let updated = 0;
        for (const pid of playerIds) {
          await db.update(players).set({ isPlayingXI: true, points: 4 }).where(and(eq(players.matchId, matchId), eq(players.id, pid)));
          updated++;
        }
        return updated;
      }
      async getPlayingXICount(matchId) {
        const result = await db.select({ count: sql2`count(*)` }).from(players).where(and(eq(players.matchId, matchId), eq(players.isPlayingXI, true)));
        return Number(result[0]?.count || 0);
      }
      async incrementApiCallCount() {
        const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const [existing] = await db.select().from(apiCallLog).where(eq(apiCallLog.dateKey, today));
        if (existing) {
          const newCount = existing.callCount + 1;
          await db.update(apiCallLog).set({ callCount: newCount, lastCalledAt: /* @__PURE__ */ new Date() }).where(eq(apiCallLog.id, existing.id));
          return newCount;
        } else {
          await db.insert(apiCallLog).values({ dateKey: today, callCount: 1 });
          return 1;
        }
      }
      async getApiCallCount(dateKey) {
        const key = dateKey || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const [row] = await db.select().from(apiCallLog).where(eq(apiCallLog.dateKey, key));
        return { count: row?.callCount || 0, date: key, lastCalledAt: row?.lastCalledAt || null };
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
      async getUserPredictionForMatch(userId, matchId) {
        const [pred] = await db.select().from(matchPredictions).where(and(eq(matchPredictions.userId, userId), eq(matchPredictions.matchId, matchId)));
        return pred;
      }
      async getPredictionsForMatch(matchId) {
        return db.select().from(matchPredictions).where(eq(matchPredictions.matchId, matchId));
      }
      async createPrediction(data) {
        const [pred] = await db.insert(matchPredictions).values(data).returning();
        return pred;
      }
      async updatePrediction(userId, matchId, predictedWinner) {
        const [pred] = await db.update(matchPredictions).set({ predictedWinner }).where(and(eq(matchPredictions.userId, userId), eq(matchPredictions.matchId, matchId))).returning();
        return pred;
      }
      async createReward(data) {
        const [reward] = await db.insert(rewards).values(data).returning();
        return reward;
      }
      async getAllRewards() {
        return db.select().from(rewards).orderBy(desc(rewards.createdAt));
      }
      async getAvailableRewards() {
        return db.select().from(rewards).where(eq(rewards.isClaimed, false));
      }
      async getClaimedRewards() {
        return db.select().from(rewards).where(eq(rewards.isClaimed, true)).orderBy(desc(rewards.claimedAt));
      }
      async claimReward(rewardId, userId, matchId) {
        const [reward] = await db.update(rewards).set({ isClaimed: true, claimedByUserId: userId, claimedMatchId: matchId, claimedAt: /* @__PURE__ */ new Date() }).where(eq(rewards.id, rewardId)).returning();
        return reward;
      }
      async getRandomAvailableReward() {
        const available = await this.getAvailableRewards();
        if (available.length === 0) return void 0;
        return available[Math.floor(Math.random() * available.length)];
      }
      async getRewardForUserMatch(userId, matchId) {
        const [reward] = await db.select().from(rewards).where(and(eq(rewards.claimedByUserId, userId), eq(rewards.claimedMatchId, matchId)));
        return reward;
      }
      async getRewardForMatch(matchId) {
        const [reward] = await db.select().from(rewards).where(eq(rewards.claimedMatchId, matchId));
        return reward;
      }
      async getUserRewards(userId) {
        return db.select().from(rewards).where(eq(rewards.claimedByUserId, userId)).orderBy(desc(rewards.claimedAt));
      }
      async deleteReward(rewardId) {
        await db.delete(rewards).where(eq(rewards.id, rewardId));
      }
      async getLedgerForMatch(matchId) {
        return db.select().from(tournamentLedger).where(eq(tournamentLedger.matchId, matchId));
      }
      async createLedgerEntry(data) {
        const [entry] = await db.insert(tournamentLedger).values(data).returning();
        return entry;
      }
      async getDistinctTournamentNames() {
        const result = await db.selectDistinct({ name: tournamentLedger.tournamentName }).from(tournamentLedger);
        return result.map((r) => r.name);
      }
      async getTournamentStandings(tName) {
        const result = await db.select({
          userId: tournamentLedger.userId,
          userName: tournamentLedger.userName,
          totalPoints: sql2`SUM(${tournamentLedger.pointsChange})`.as("total_points"),
          matchCount: sql2`COUNT(DISTINCT ${tournamentLedger.matchId})`.as("match_count")
        }).from(tournamentLedger).where(eq(tournamentLedger.tournamentName, tName)).groupBy(tournamentLedger.userId, tournamentLedger.userName).orderBy(desc(sql2`total_points`));
        return result.map((r) => ({
          userId: r.userId,
          userName: r.userName,
          totalPoints: Number(r.totalPoints),
          matchCount: Number(r.matchCount)
        }));
      }
      // ====== IST Week Helpers ======
      getISTWeekStart(date) {
        const d = date || /* @__PURE__ */ new Date();
        const istOffset = 5.5 * 60 * 60 * 1e3;
        const istDate = new Date(d.getTime() + istOffset);
        const day = istDate.getUTCDay();
        const diff = day === 0 ? 6 : day - 1;
        const monday = new Date(istDate);
        monday.setUTCDate(istDate.getUTCDate() - diff);
        return monday.toISOString().slice(0, 10);
      }
      getISTWeekEnd(weekStartDate) {
        const d = /* @__PURE__ */ new Date(weekStartDate + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 6);
        return d.toISOString().slice(0, 10);
      }
      // ====== Match Player Status ======
      async getMatchPlayerStatuses(matchId) {
        return db.select().from(matchPlayerStatus).where(eq(matchPlayerStatus.matchId, matchId));
      }
      async getMatchPlayerStatus(matchId, playerId) {
        const [status] = await db.select().from(matchPlayerStatus).where(and(eq(matchPlayerStatus.matchId, matchId), eq(matchPlayerStatus.playerId, playerId)));
        return status;
      }
      async upsertMatchPlayerStatus(data) {
        const existing = await this.getMatchPlayerStatus(data.matchId, data.playerId);
        if (existing) {
          const updateData = { updatedAt: /* @__PURE__ */ new Date() };
          if (data.adminStatus !== void 0) updateData.adminStatus = data.adminStatus;
          if (data.actualParticipationStatus !== void 0) updateData.actualParticipationStatus = data.actualParticipationStatus;
          if (data.officialImpactSubUsed !== void 0) updateData.officialImpactSubUsed = data.officialImpactSubUsed;
          if (data.sourceType !== void 0) updateData.sourceType = data.sourceType;
          const [updated] = await db.update(matchPlayerStatus).set(updateData).where(eq(matchPlayerStatus.id, existing.id)).returning();
          return updated;
        } else {
          const [created] = await db.insert(matchPlayerStatus).values({
            matchId: data.matchId,
            playerId: data.playerId,
            adminStatus: data.adminStatus || "not_active",
            actualParticipationStatus: data.actualParticipationStatus || "unknown",
            officialImpactSubUsed: data.officialImpactSubUsed || false,
            sourceType: data.sourceType || "admin"
          }).returning();
          return created;
        }
      }
      async bulkSetAdminStatus(matchId, playerIds, adminStatus) {
        for (const playerId of playerIds) {
          await this.upsertMatchPlayerStatus({ matchId, playerId, adminStatus, sourceType: "admin" });
        }
      }
      async getImpactSubPlayers(matchId) {
        return db.select().from(matchPlayerStatus).where(and(
          eq(matchPlayerStatus.matchId, matchId),
          eq(matchPlayerStatus.officialImpactSubUsed, true)
        ));
      }
      // ====== User Weekly Usage ======
      async getUserWeeklyUsage(userId, weekStartDate) {
        const week = weekStartDate || this.getISTWeekStart();
        const [usage] = await db.select().from(userWeeklyUsage).where(and(eq(userWeeklyUsage.userId, userId), eq(userWeeklyUsage.weekStartDate, week)));
        return usage;
      }
      async getOrCreateWeeklyUsage(userId, weekStartDate) {
        const week = weekStartDate || this.getISTWeekStart();
        const existing = await this.getUserWeeklyUsage(userId, week);
        if (existing) return existing;
        const [created] = await db.insert(userWeeklyUsage).values({
          userId,
          weekStartDate: week,
          multiTeamUsageCount: 0,
          invisibleModeUsageCount: 0
        }).returning();
        return created;
      }
      async incrementMultiTeamUsage(userId) {
        const usage = await this.getOrCreateWeeklyUsage(userId);
        const [updated] = await db.update(userWeeklyUsage).set({ multiTeamUsageCount: usage.multiTeamUsageCount + 1 }).where(eq(userWeeklyUsage.id, usage.id)).returning();
        return updated;
      }
      async incrementInvisibleUsage(userId) {
        const usage = await this.getOrCreateWeeklyUsage(userId);
        const [updated] = await db.update(userWeeklyUsage).set({ invisibleModeUsageCount: usage.invisibleModeUsageCount + 1 }).where(eq(userWeeklyUsage.id, usage.id)).returning();
        return updated;
      }
      async decrementInvisibleUsage(userId) {
        const usage = await this.getOrCreateWeeklyUsage(userId);
        if (usage.invisibleModeUsageCount > 0) {
          await db.update(userWeeklyUsage).set({ invisibleModeUsageCount: usage.invisibleModeUsageCount - 1 }).where(eq(userWeeklyUsage.id, usage.id));
        }
      }
      canUseMultiTeam(usage) {
        return usage.multiTeamUsageCount < 3;
      }
      canUseInvisibleMode(usage) {
        return usage.invisibleModeUsageCount < 1;
      }
      // ====== Admin Audit Log ======
      async createAuditLog(data) {
        const [log2] = await db.insert(adminAuditLog).values({
          adminUserId: data.adminUserId,
          actionType: data.actionType,
          entityType: data.entityType,
          entityId: data.entityId,
          matchId: data.matchId,
          metadata: data.metadata || ""
        }).returning();
        return log2;
      }
      async getAuditLogsForMatch(matchId) {
        return db.select().from(adminAuditLog).where(eq(adminAuditLog.matchId, matchId)).orderBy(desc(adminAuditLog.createdAt));
      }
      async getAllAuditLogs(limit = 50) {
        return db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit);
      }
      // ====== Impact Slot Resolution ======
      async resolveImpactSlot(matchId, primaryImpactId, backupImpactId) {
        if (primaryImpactId) {
          const primaryStatus = await this.getMatchPlayerStatus(matchId, primaryImpactId);
          if (primaryStatus?.officialImpactSubUsed) {
            return { activePlayerId: primaryImpactId, activatedBy: "primary" };
          }
        }
        if (backupImpactId) {
          const backupStatus = await this.getMatchPlayerStatus(matchId, backupImpactId);
          if (backupStatus?.officialImpactSubUsed) {
            return { activePlayerId: backupImpactId, activatedBy: "backup" };
          }
        }
        return { activePlayerId: null, activatedBy: null };
      }
      // ====== Match Feature Toggle ======
      async setImpactFeaturesEnabled(matchId, enabled) {
        await db.update(matches).set({ impactFeaturesEnabled: enabled }).where(eq(matches.id, matchId));
      }
      async setMatchVoid(matchId, isVoid) {
        await db.update(matches).set({ isVoid }).where(eq(matches.id, matchId));
      }
      async setOfficialWinner(matchId, winner) {
        await db.update(matches).set({ officialWinner: winner }).where(eq(matches.id, matchId));
      }
      async deleteUser(userId) {
        await db.delete(users).where(eq(users.id, userId));
      }
      async getAllUsers() {
        return db.select().from(users);
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
  fetchMatchScorecardWithScore: () => fetchMatchScorecardWithScore,
  fetchMatchSquad: () => fetchMatchSquad,
  fetchPlayingXI: () => fetchPlayingXI,
  fetchPlayingXIFromMatchInfo: () => fetchPlayingXIFromMatchInfo,
  fetchPlayingXIFromScorecard: () => fetchPlayingXIFromScorecard,
  fetchSeriesMatches: () => fetchSeriesMatches,
  fetchSeriesSquad: () => fetchSeriesSquad,
  fetchUpcomingMatches: () => fetchUpcomingMatches,
  getInMemoryApiCallCount: () => getInMemoryApiCallCount,
  refreshPlayingXIForLiveMatches: () => refreshPlayingXIForLiveMatches,
  refreshStaleMatchStatuses: () => refreshStaleMatchStatuses,
  syncMatchesFromApi: () => syncMatchesFromApi
});
function detectDotBalls(externalId, bowlerName, newBowling) {
  if (!newBowling || typeof newBowling.o !== "number") return 0;
  const cacheKey = externalId;
  let matchCache = scorecardStateCache.get(cacheKey);
  if (!matchCache) {
    matchCache = /* @__PURE__ */ new Map();
    scorecardStateCache.set(cacheKey, matchCache);
  }
  const previousState = matchCache.get(bowlerName);
  const currentState = { o: newBowling.o, r: newBowling.r, w: newBowling.w };
  if (previousState) {
    const newBalls = Math.floor(currentState.o) * 6 + Math.round(currentState.o % 1 * 10);
    const oldBalls = Math.floor(previousState.o) * 6 + Math.round(previousState.o % 1 * 10);
    const ballsThrown = newBalls - oldBalls;
    const runsGiven = currentState.r - previousState.r;
    const dots = Math.max(0, ballsThrown - runsGiven);
    matchCache.set(bowlerName, currentState);
    return dots;
  }
  matchCache.set(bowlerName, currentState);
  return 0;
}
async function trackApiCall() {
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    if (dailyApiCallDate !== today) {
      dailyApiCalls = 0;
      dailyApiCallDate = today;
    }
    dailyApiCalls++;
    const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    const count = await storage2.incrementApiCallCount();
    dailyApiCalls = count;
  } catch (e) {
    console.error("[API Tracker] Failed to track call:", e);
  }
}
function getInMemoryApiCallCount() {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (dailyApiCallDate !== today) return 0;
  return dailyApiCalls;
}
function markTier1Blocked() {
  tier1BlockedUntil = Date.now() + 60 * 60 * 1e3;
  console.log("[CricAPI] Tier 1 key blocked, switching to Tier 2 for 1 hour");
}
async function trackedFetch(url, init) {
  await trackApiCall();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1e4);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}
function getActiveApiKey() {
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
  return void 0;
}
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
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    console.log("No CricAPI key available, skipping API fetch");
    return [];
  }
  try {
    const allApiMatches = [];
    const seenIds = /* @__PURE__ */ new Set();
    const endpoints = [
      `${CRICKET_API_BASE}/currentMatches?apikey=${apiKey}&offset=0`,
      `${CRICKET_API_BASE}/matches?apikey=${apiKey}&offset=0`,
      `${CRICKET_API_BASE}/matches?apikey=${apiKey}&offset=25`,
      `${CRICKET_API_BASE}/matches?apikey=${apiKey}&offset=50`
    ];
    for (const url of endpoints) {
      try {
        const res = await trackedFetch(url);
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
          const reason = json.reason || "";
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
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];
  try {
    const url = `${CRICKET_API_BASE}/series_info?apikey=${apiKey}&id=${seriesId}`;
    const res = await trackedFetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    if (json.status !== "success" || !json.data?.matchList) {
      const reason = (json.reason || json.message || "").toLowerCase();
      if (reason.includes("limit") || reason.includes("quota") || reason.includes("blocked")) {
        markTier1Blocked();
      }
      return [];
    }
    console.log(`Series Info API: fetched ${json.data.matchList.length} matches for ${seriesName}, hits: ${json.info?.hitsUsed}/${json.info?.hitsLimit}`);
    return json.data.matchList.filter((m) => m.teams && m.teams.length >= 2 && m.dateTimeGMT).map((m) => {
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
      if (m.team1 !== "Tbc" && dup.team1 !== m.team1) {
        updates.team1 = m.team1;
        updates.team1Short = m.team1Short;
        updates.team1Color = m.team1Color;
      }
      if (m.team2 !== "Tbc" && dup.team2 !== m.team2) {
        updates.team2 = m.team2;
        updates.team2Short = m.team2Short;
        updates.team2Color = m.team2Color;
      }
      if (Object.keys(updates).length > 0) {
        await storage2.updateMatch(dup.id, updates);
        console.log(`Match ${m.team1} vs ${m.team2}: updated [${Object.keys(updates).join(", ")}]`);
        updated++;
      }
    }
  }
  return { created, updated };
}
async function syncMatchesFromApi() {
  const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    console.log("No CricAPI key available, skipping auto-sync");
    return;
  }
  console.log("Auto-syncing matches (IPL only)...");
  try {
    const existing = await storage2.getAllMatches();
    const allApiRaw = [];
    const seenIds = /* @__PURE__ */ new Set();
    for (const url of [
      `${CRICKET_API_BASE}/currentMatches?apikey=${apiKey}&offset=0`,
      `${CRICKET_API_BASE}/matches?apikey=${apiKey}&offset=0`
    ]) {
      try {
        const res = await trackedFetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        if (json.status !== "success" || !json.data) {
          const reason = json.reason || "";
          if (reason.toLowerCase().includes("limit") || reason.toLowerCase().includes("blocked")) {
            markTier1Blocked();
            break;
          }
          continue;
        }
        const label = url.includes("currentMatches") ? "currentMatches" : "matches";
        console.log(`Auto-sync: ${json.data.length} matches from ${label}, hits: ${json.info?.hitsUsed}/${json.info?.hitsLimit}`);
        for (const m of json.data) {
          if (!seenIds.has(m.id)) {
            seenIds.add(m.id);
            allApiRaw.push(m);
          }
        }
      } catch (e) {
        console.error("Auto-sync endpoint error:", e);
      }
    }
    if (allApiRaw.length === 0) {
      console.log("Auto-sync: no matches returned from API");
      return;
    }
    const isIPL = (m) => {
      const name = (m.name || "").toLowerCase();
      const series = (m.series_id || "").toLowerCase();
      return name.includes("indian premier league") || name.includes(" ipl") || series.includes("ipl");
    };
    const apiMatches = allApiRaw.filter((m) => m.teams && m.teams.length >= 2 && m.dateTimeGMT && m.matchType === "t20" && isIPL(m)).map((m) => {
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
        league
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
async function fetchMatchInfo(matchId) {
  const apiKey = getActiveApiKey();
  if (!apiKey) return null;
  try {
    const url = `${CRICKET_API_BASE}/match_info?apikey=${apiKey}&id=${matchId}`;
    const res = await trackedFetch(url);
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
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];
  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await trackedFetch(url);
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
      if (match.playingXIManual) {
        console.log(`Playing XI skipped (admin manual): ${match.team1} vs ${match.team2}`);
        continue;
      }
      const existingCount = await storage2.getPlayingXICount(match.id);
      if (existingCount >= 22) continue;
      const playingIds = await fetchPlayingXI(match.externalId);
      if (playingIds.length >= 2) {
        await storage2.markPlayingXI(match.id, playingIds);
        console.log(`Playing XI updated for ${match.team1} vs ${match.team2}: ${playingIds.length} players marked`);
        const updatedPlayers = await storage2.getPlayersForMatch(match.id);
        const playerById = new Map(updatedPlayers.map((p) => [p.id, p]));
        const playerByExtId = new Map(updatedPlayers.filter((p) => p.externalId).map((p) => [p.externalId, p]));
        const allTeams = await storage2.getAllTeamsForMatch(match.id);
        for (const team of allTeams) {
          const teamPlayerIds = team.playerIds;
          let totalPoints = 0;
          for (const pid of teamPlayerIds) {
            const p = playerById.get(pid) || playerByExtId.get(pid);
            if (p) {
              let pts = p.points || 0;
              if (pid === team.captainId) pts *= 2;
              else if (pid === team.viceCaptainId) pts *= 1.5;
              totalPoints += pts;
            }
          }
          await storage2.updateUserTeamPoints(team.id, totalPoints);
        }
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
  const apiKey = getActiveApiKey();
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
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];
  try {
    const url = `${CRICKET_API_BASE}/series_squad?apikey=${apiKey}&id=${seriesId}`;
    const res = await trackedFetch(url);
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
async function fetchPlayingXIFromMatchInfo(externalMatchId) {
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];
  try {
    const url = `${CRICKET_API_BASE}/match_info?apikey=${apiKey}&id=${externalMatchId}`;
    const res = await trackedFetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    if (json.status !== "success" || !json.data) return [];
    const playerIds = [];
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
async function fetchMatchSquad(externalMatchId) {
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];
  try {
    const url = `${CRICKET_API_BASE}/match_squad?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await trackedFetch(url);
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
    if (allPlayers.length > 0) return allPlayers;
    console.log(`[fetchMatchSquad] match_squad returned 0 for ${externalMatchId}, trying match_info fallback...`);
    const infoApiKey = getActiveApiKey();
    if (!infoApiKey) return [];
    const infoUrl = `${CRICKET_API_BASE}/match_info?apikey=${infoApiKey}&id=${externalMatchId}`;
    const infoRes = await trackedFetch(infoUrl);
    if (!infoRes.ok) return [];
    const infoJson = await infoRes.json();
    if (infoJson.status !== "success" || !infoJson.data) return [];
    const infoPlayers = [];
    const teamInfo = infoJson.data.teamInfo || [];
    for (const team of teamInfo) {
      const teamName = team.name || "";
      const teamShort = team.shortname || getTeamShort(teamName);
      const teamPlayers = team.players || [];
      for (const p of teamPlayers) {
        if (!p.id || !p.name) continue;
        const role = mapCricApiRole(p.role || "");
        infoPlayers.push({
          externalId: p.id,
          name: p.name,
          team: teamName,
          teamShort,
          role,
          credits: assignCredits(role)
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
function calculateFantasyPoints(playerId, scorecard) {
  let points = 0;
  let totalCatches = 0;
  for (const inning of scorecard) {
    const bat = inning.batting?.find((b) => b.batsman?.id === playerId);
    if (bat) {
      points += bat.r;
      points += bat["4s"] * 4;
      points += bat["6s"] * 6;
      if (bat.r >= 100) points += 16;
      else if (bat.r >= 75) points += 12;
      else if (bat.r >= 50) points += 8;
      else if (bat.r >= 25) points += 4;
      if (bat.r === 0 && bat.b > 0) points -= 2;
      if (bat.b >= 10) {
        if (bat.sr > 170) points += 6;
        else if (bat.sr > 150) points += 4;
        else if (bat.sr >= 130) points += 2;
        else if (bat.sr <= 70 && bat.sr >= 60) points -= 2;
        else if (bat.sr < 60 && bat.sr >= 50) points -= 4;
        else if (bat.sr < 50) points -= 6;
      }
    }
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
      const battingEntries2 = inning.batting || [];
      for (const b of battingEntries2) {
        const d = (b.dismissal || "").toLowerCase();
        if (d.startsWith("lbw") || d.startsWith("b ")) {
          if (bowl.bowler?.name && d.includes(bowl.bowler.name.toLowerCase())) {
            points += 8;
          }
        }
      }
    }
    const catcher = inning.catching?.find((c) => c.catcher?.id === playerId);
    if (catcher) {
      const catches = catcher.catches || 0;
      points += catches * 8;
      totalCatches += catches;
    }
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
          const fielderNames = fieldersStr.split("/").map((f) => f.trim().toLowerCase());
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
async function fetchPlayingXIFromScorecard(externalMatchId) {
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];
  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await trackedFetch(url);
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
    if (playerIds.size > 0) {
      console.log(`Playing XI from scorecard: ${playerIds.size} players for ${externalMatchId}`);
    }
    return Array.from(playerIds);
  } catch (err) {
    console.error("Scorecard Playing XI error:", err);
    return [];
  }
}
async function fetchMatchScorecardWithScore(externalMatchId) {
  const apiKey = getActiveApiKey();
  const pointsMap = /* @__PURE__ */ new Map();
  const namePointsMap = /* @__PURE__ */ new Map();
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
    let json;
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
      scoreString = scoreArr.map((s) => `${s?.inning ?? "?"}: ${s?.r ?? 0}/${s?.w ?? 0} (${s?.o ?? 0} ov)`).join(" | ");
      totalOvers = scoreArr.reduce((sum, s) => sum + (s?.o || 0), 0);
    }
    const scorecardInningsRaw = Array.isArray(json.data.scorecard) ? json.data.scorecard : [];
    if (scorecardInningsRaw.length > scoreArr.length) {
      console.log(`[ScorecardWithScore] scorecard has ${scorecardInningsRaw.length} innings but score array has ${scoreArr.length} \u2014 building score from scorecard`);
      const builtScoreParts = [];
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
    matchEnded = matchStatus.includes("won") || matchStatus.includes("draw") || matchStatus.includes("tied") || matchStatus.includes("finished") || matchStatus.includes("ended") || matchStatus.includes("result") || matchStatus.includes("aban") || matchStatus.includes("no result") || matchStatus.includes("d/l") || matchStatus.includes("dls") || matchStatus.includes("beat") || matchStatus.includes("defeat");
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
      scoreString += ` \u2014 ${statusText}`;
    }
    const scorecardInnings = Array.isArray(json.data.scorecard) ? json.data.scorecard : [];
    if (scorecardInnings.length > 0) {
      const allPlayers = /* @__PURE__ */ new Map();
      for (const inning of scorecardInnings) {
        const batting = Array.isArray(inning?.batting) ? inning.batting : [];
        const bowling = Array.isArray(inning?.bowling) ? inning.bowling : [];
        const catching = Array.isArray(inning?.catching) ? inning.catching : [];
        batting.forEach((b) => {
          if (b?.batsman?.id) allPlayers.set(b.batsman.id, b.batsman.name || "");
        });
        bowling.forEach((b) => {
          if (b?.bowler?.id) allPlayers.set(b.bowler.id, b.bowler.name || "");
        });
        catching.forEach((c) => {
          if (c?.catcher?.id) allPlayers.set(c.catcher.id, c.catcher.name || "");
        });
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
async function fetchMatchScorecard(externalMatchId) {
  const apiKey = getActiveApiKey();
  const pointsMap = /* @__PURE__ */ new Map();
  const namePointsMap = /* @__PURE__ */ new Map();
  if (!apiKey) return { pointsMap, namePointsMap };
  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await trackedFetch(url);
    if (!res.ok) return { pointsMap, namePointsMap };
    const json = await res.json();
    if (json.status !== "success" || !json.data?.scorecard) return { pointsMap, namePointsMap };
    console.log(`Scorecard API: fetched ${json.data.scorecard.length} innings for match ${externalMatchId}`);
    const allPlayers = /* @__PURE__ */ new Map();
    for (const inning of json.data.scorecard) {
      inning.batting?.forEach((b) => {
        if (b.batsman?.id) allPlayers.set(b.batsman.id, b.batsman.name || "");
      });
      inning.bowling?.forEach((b) => {
        if (b.bowler?.id) allPlayers.set(b.bowler.id, b.bowler.name || "");
      });
      inning.catching?.forEach((c) => {
        if (c.catcher?.id) allPlayers.set(c.catcher.id, c.catcher.name || "");
      });
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
async function fetchLiveScorecard(externalMatchId) {
  const apiKey = getActiveApiKey();
  if (!apiKey) return null;
  try {
    const url = `${CRICKET_API_BASE}/match_scorecard?apikey=${apiKey}&offset=0&id=${externalMatchId}`;
    const res = await trackedFetch(url);
    if (!res.ok) {
      console.error(`[LiveScorecard] HTTP ${res.status} for ${externalMatchId}`);
      return null;
    }
    let json;
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
    const innings = scorecard.map((inn, idx) => {
      const battingArr = Array.isArray(inn?.batting) ? inn.batting : [];
      const bowlingArr = Array.isArray(inn?.bowling) ? inn.bowling : [];
      const batterRuns = battingArr.reduce((sum, b) => sum + (b?.r || 0), 0);
      const matchScore = scoreArr.find((s) => s?.inning === inn?.inning) || scoreArr[idx];
      const totalFromApi = matchScore ? matchScore.r ?? 0 : batterRuns;
      const extrasTotal = totalFromApi - batterRuns;
      const rawExtras = inn?.extras;
      const apiExtrasTotal = rawExtras?.total ?? rawExtras?.r;
      const finalExtras = apiExtrasTotal != null ? apiExtrasTotal : extrasTotal > 0 ? extrasTotal : 0;
      return {
        inning: inn?.inning ?? `Inning ${idx + 1}`,
        extras: finalExtras,
        totals: matchScore ? { r: matchScore.r ?? 0, w: matchScore.w ?? 0, o: matchScore.o ?? 0 } : void 0,
        batting: battingArr.map((b) => ({
          name: b?.batsman?.name || b?.name || "",
          r: b?.r ?? 0,
          b: b?.b ?? 0,
          fours: b?.["4s"] ?? 0,
          sixes: b?.["6s"] ?? 0,
          sr: b?.sr ?? 0,
          dismissal: b?.dismissal || "not out",
          fantasyPoints: b?.batsman?.id ? calculateFantasyPoints(b.batsman.id, scorecard) : 0
        })),
        bowling: bowlingArr.map((b) => {
          const dots = detectDotBalls(externalMatchId, b?.bowler?.name || b?.name || "", b);
          return {
            name: b?.bowler?.name || b?.name || "",
            o: b?.o ?? 0,
            m: b?.m ?? 0,
            r: b?.r ?? 0,
            w: b?.w ?? 0,
            eco: b?.eco ?? 0,
            dots,
            fantasyPoints: b?.bowler?.id ? calculateFantasyPoints(b.bowler.id, scorecard) : 0
          };
        })
      };
    });
    let finalScore = scoreArr.map((s) => ({ r: s?.r ?? 0, w: s?.w ?? 0, o: s?.o ?? 0, inning: s?.inning ?? "" }));
    if (scorecard.length > 0) {
      const builtScore = scorecard.map((inn, idx) => {
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
        for (const bw of bowlingArr) {
          overs += bw?.o || 0;
        }
        const existingScore = scoreArr.find((s) => s?.inning === inn?.inning) || scoreArr[idx];
        const builtR = runs;
        const builtW = wickets;
        const builtO = overs;
        const apiR = existingScore?.r ?? 0;
        const apiO = existingScore?.o ?? 0;
        const useBuilt = builtO > apiO || builtR > apiR || !existingScore;
        return {
          r: useBuilt ? builtR : apiR,
          w: useBuilt ? builtW : existingScore?.w ?? 0,
          o: useBuilt ? builtO : apiO,
          inning: inn?.inning ?? existingScore?.inning ?? `Inning ${idx + 1}`
        };
      });
      const builtTotalOvers = builtScore.reduce((sum, s) => sum + s.o, 0);
      const apiTotalOvers = finalScore.reduce((sum, s) => sum + s.o, 0);
      if (builtTotalOvers > apiTotalOvers || builtScore.length > finalScore.length) {
        console.log(`[LiveScorecard] Using scorecard-derived scores (${builtScore.length} innings, ${builtTotalOvers} ov) over API score (${finalScore.length} innings, ${apiTotalOvers} ov)`);
        finalScore = builtScore;
      }
    }
    return {
      score: finalScore,
      innings,
      status: json.data.name || json.data.status || ""
    };
  } catch (err) {
    console.error("Live scorecard error:", err);
    return null;
  }
}
var CRICKET_API_BASE, dailyApiCalls, dailyApiCallDate, tier1BlockedUntil, scorecardStateCache, DELAY_KEYWORDS, TEAM_COLORS, lastStatusRefresh, STATUS_REFRESH_INTERVAL;
var init_cricket_api = __esm({
  "server/cricket-api.ts"() {
    "use strict";
    CRICKET_API_BASE = "https://api.cricapi.com/v1";
    dailyApiCalls = 0;
    dailyApiCallDate = "";
    tier1BlockedUntil = 0;
    scorecardStateCache = /* @__PURE__ */ new Map();
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
      GT: "#1B2133"
    };
    lastStatusRefresh = 0;
    STATUS_REFRESH_INTERVAL = 5 * 60 * 1e3;
  }
});

// server/index.ts
import express from "express";

// server/routes.ts
init_storage();
init_db();
init_schema();
init_cricket_api();
import { createServer } from "node:http";
import { eq as eq2, and as and2, sql as sql3 } from "drizzle-orm";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createHmac } from "crypto";
import pg2 from "pg";
var ADMIN_PHONES = ["9840872462", "9884334973", "7406020777"];
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
function getEffectiveLockMs(match) {
  const effectiveStart = match.revisedStartTime ?? match.startTime;
  return new Date(effectiveStart).getTime() - 1e3;
}
function checkUnlockEligibility(match) {
  if (!match.firstScorecardAt) return { allowed: true };
  const cutoff = new Date(match.firstScorecardAt).getTime() + 5 * 6e4;
  if (Date.now() < cutoff) return { allowed: true };
  return { allowed: false, reason: "Cannot unlock: live scorecard data has been running for more than 5 minutes" };
}
function isEntryOpen(match, nowMs) {
  const lockMs = getEffectiveLockMs(match);
  if (match.adminUnlockOverride === true && nowMs < lockMs) {
    if (match.firstScorecardAt) {
      const cutoff = new Date(match.firstScorecardAt).getTime() + 5 * 6e4;
      if (nowMs >= cutoff) return false;
    }
    return true;
  }
  return nowMs < lockMs;
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
    console.log(`Auth failed: Bearer token invalid for ${req.path}`);
  } else {
    console.log(`Auth failed: No session or bearer token for ${req.path}, auth header: ${authHeader || "none"}`);
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
var LIVE_CACHE_TTL_MS = 45e3;
var liveScorecardCache = /* @__PURE__ */ new Map();
var liveScoreCache = /* @__PURE__ */ new Map();
async function registerRoutes(app2) {
  const PgStore = connectPgSimple(session);
  const dbUrl = process.env.DATABASE_URL || "";
  const needsSsl = dbUrl.includes("railway") || dbUrl.includes("rlwy");
  const sessionPool = new pg2.Pool({
    connectionString: dbUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : void 0,
    max: 10,
    idleTimeoutMillis: 3e4,
    connectionTimeoutMillis: 2e3
  });
  sessionPool.on("error", (err) => {
    console.error("[DB:session] Unexpected pool error:", err.message);
  });
  sessionPool.on("connect", (client) => {
    client.query("SET statement_timeout = 5000").catch((err) => {
      console.error("[DB:session] Failed to set statement_timeout:", err.message);
    });
  });
  app2.use(
    session({
      store: new PgStore({
        pool: sessionPool,
        tableName: "session",
        createTableIfMissing: true
      }),
      secret: process.env.SESSION_SECRET || "cdo-session-secret-dev",
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        secure: "auto",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1e3,
        sameSite: "lax"
      }
    })
  );
  app2.get("/health", async (_req, res) => {
    let dbStatus = "disconnected";
    try {
      const client = await sessionPool.connect();
      await client.query("SELECT 1");
      client.release();
      dbStatus = "connected";
    } catch {
      dbStatus = "disconnected";
    }
    res.status(dbStatus === "connected" ? 200 : 503).json({
      server: "running",
      database: dbStatus
    });
  });
  app2.get("/ready", async (_req, res) => {
    const checks = {
      database: false,
      api: serverReady,
      routes: true
    };
    try {
      const client = await sessionPool.connect();
      await client.query("SELECT 1");
      client.release();
      checks.database = true;
    } catch {
      checks.database = false;
    }
    const allReady = checks.database && checks.api && checks.routes;
    res.status(allReady ? 200 : 503).json({
      ready: allReady,
      checks
    });
  });
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
        email: email || null,
        phone: phone || "",
        password
      });
      if (isAdminUser) {
        await storage.setUserAdmin(user.id, true);
        await storage.updateUserVerified(user.id, true);
        user.isAdmin = true;
        user.isVerified = true;
      }
      if (user.isVerified) {
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
      }
      return res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          teamName: user.teamName,
          isVerified: false,
          isAdmin: false
        },
        message: "pending_approval"
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
      if (ADMIN_PHONES.includes(phone) && !user.isAdmin) {
        await storage.setUserAdmin(user.id, true);
        user.isAdmin = true;
      }
      if (!user.isVerified && !user.isAdmin) {
        return res.status(403).json({ message: "pending_approval", detail: "Your account is pending admin approval. Please wait for an admin to approve your signup." });
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
  app2.post(
    "/api/admin/promote-by-phone",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ message: "phone required" });
      const user = await storage.getUserByPhone(phone);
      if (!user) return res.status(404).json({ message: "User not found" });
      await storage.setUserAdmin(user.id, true);
      return res.json({ ok: true, username: user.username });
    }
  );
  app2.get("/api/matches", isAuthenticated, async (_req, res) => {
    try {
      await refreshStaleMatchStatuses();
    } catch (e) {
      console.error("Status refresh error:", e);
    }
    const allMatches = await storage.getAllMatches();
    const nowMs = Date.now();
    const MS_7D = 7 * 24 * 60 * 60 * 1e3;
    const MS_3H = 3 * 60 * 60 * 1e3;
    const matchesWithParticipants = [];
    for (const m of allMatches) {
      const startMs = new Date(m.startTime).getTime();
      const teams = await storage.getAllTeamsForMatch(m.id);
      const uniqueUsers = new Set(teams.map((t) => t.userId));
      const participantCount = uniqueUsers.size;
      const isUpcomingOrDelayed = m.status === "upcoming" || m.status === "delayed";
      const startsWithin7d = startMs <= nowMs + MS_7D;
      const isUpcoming = isUpcomingOrDelayed && startsWithin7d;
      const isLive = m.status === "live";
      const included = isUpcoming || isLive || m.status === "delayed";
      if (included) {
        matchesWithParticipants.push({ match: m, participantCount });
      }
    }
    matchesWithParticipants.sort((a, b) => {
      const order = { live: 0, delayed: 0, upcoming: 1, completed: 2 };
      const oa = order[a.match.status] ?? 1;
      const ob = order[b.match.status] ?? 1;
      if (oa !== ob) return oa - ob;
      if (a.match.status === "completed" && b.match.status === "completed") {
        if (a.participantCount > 0 && b.participantCount === 0) return -1;
        if (a.participantCount === 0 && b.participantCount > 0) return 1;
      }
      if (a.match.status === "upcoming" || a.match.status === "delayed") {
        return new Date(a.match.startTime).getTime() - new Date(b.match.startTime).getTime();
      }
      return new Date(b.match.startTime).getTime() - new Date(a.match.startTime).getTime();
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
        const match = await storage.getMatch(matchId);
        if (match?.externalId) {
          try {
            const { fetchMatchSquad: fetchMatchSquad2, fetchSeriesSquad: fetchSeriesSquad2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
            let squad = await fetchMatchSquad2(match.externalId);
            if (squad.length === 0 && match.seriesId) {
              console.log(`Match squad empty, trying series squad for series ${match.seriesId}...`);
              const seriesPlayers = await fetchSeriesSquad2(match.seriesId);
              const team1 = match.team1.toLowerCase();
              const team2 = match.team2.toLowerCase();
              squad = seriesPlayers.filter((p) => {
                const pTeam = p.team.toLowerCase();
                return pTeam === team1 || pTeam === team2 || pTeam.includes(team1) || team1.includes(pTeam) || pTeam.includes(team2) || team2.includes(pTeam);
              });
              if (squad.length > 0) {
                console.log(`Found ${squad.length} players from series squad for ${match.team1} vs ${match.team2}`);
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
              await storage.upsertPlayersForMatch(matchId, playersToCreate);
              matchPlayers = await storage.getPlayersForMatch(matchId);
              console.log(`Auto-fetched ${matchPlayers.length} players for match ${matchId}`);
            }
          } catch (err) {
            console.error("Auto-fetch squad error:", err);
          }
        }
      }
      let lastMatchXI = {};
      try {
        const matchForXI = await storage.getMatch(matchId);
        if (matchForXI) {
          for (const teamShort of [matchForXI.team1Short, matchForXI.team2Short]) {
            const [prevMatch] = await db.select({ id: matches.id }).from(matches).where(
              and2(
                sql3`(${matches.team1Short} = ${teamShort} OR ${matches.team2Short} = ${teamShort})`,
                eq2(matches.status, "completed"),
                sql3`${matches.id} != ${matchId}`
              )
            ).orderBy(sql3`${matches.startTime} DESC`).limit(1);
            if (prevMatch) {
              const prevPlayers = await storage.getPlayersForMatch(prevMatch.id);
              const teamPrev = prevPlayers.filter((p) => p.teamShort === teamShort);
              const xi = teamPrev.filter((p) => p.isPlayingXI).sort((a, b) => b.credits - a.credits).map((p) => p.name);
              const impactPlayer = teamPrev.find(
                (p) => p.isImpactPlayer && !p.isPlayingXI
              );
              lastMatchXI[teamShort] = {
                xi,
                impact: impactPlayer?.name ?? null
              };
            }
          }
        }
      } catch (err) {
        console.error("[lastMatchXI] fetch error:", err);
        lastMatchXI = {};
      }
      const playerPointsMap = {};
      try {
        const matchForPts = await storage.getMatch(matchId);
        if (matchForPts && matchPlayers.length > 0) {
          const prevPointsLookup = {};
          for (const teamShort of [matchForPts.team1Short, matchForPts.team2Short]) {
            const [prevMatch] = await db.select({ id: matches.id }).from(matches).where(
              and2(
                sql3`(${matches.team1Short} = ${teamShort} OR ${matches.team2Short} = ${teamShort})`,
                eq2(matches.status, "completed"),
                sql3`${matches.id} != ${matchId}`
              )
            ).orderBy(sql3`${matches.startTime} DESC`).limit(1);
            if (prevMatch) {
              const prevPlayers = await storage.getPlayersForMatch(prevMatch.id);
              for (const p of prevPlayers) {
                if (p.teamShort === teamShort && p.points > 0) {
                  prevPointsLookup[`${p.name}|${p.teamShort}`] = p.points;
                }
              }
            }
          }
          const tournamentTotalsLookup = {};
          if (matchForPts.tournamentName) {
            const rows = await db.select({
              name: players.name,
              teamShort: players.teamShort,
              total: sql3`CAST(SUM(${players.points}) AS INTEGER)`
            }).from(players).innerJoin(matches, eq2(players.matchId, matches.id)).where(
              and2(
                eq2(matches.tournamentName, matchForPts.tournamentName),
                eq2(matches.status, "completed"),
                sql3`${players.points} > 0`
              )
            ).groupBy(players.name, players.teamShort);
            for (const row of rows) {
              tournamentTotalsLookup[`${row.name}|${row.teamShort}`] = row.total;
            }
          }
          for (const p of matchPlayers) {
            const key = `${p.name}|${p.teamShort}`;
            playerPointsMap[p.id] = {
              lastMatchPoints: prevPointsLookup[key] ?? null,
              tournamentPoints: tournamentTotalsLookup[key] ?? null
            };
          }
        }
      } catch (err) {
        console.error("[playerPoints] fetch error:", err);
      }
      const augmentedPlayers = matchPlayers.map((p) => ({
        ...p,
        lastMatchPoints: playerPointsMap[p.id]?.lastMatchPoints ?? null,
        tournamentPoints: playerPointsMap[p.id]?.tournamentPoints ?? null
      }));
      return res.json({ players: augmentedPlayers, lastMatchXI });
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
        const result = await fetchMatchScorecard3(match.externalId);
        const pointsMap = result.pointsMap;
        const namePointsMap = result.namePointsMap;
        if (pointsMap.size === 0) {
          return res.json({ message: "No scorecard data available yet", updated: 0 });
        }
        const matchPlayers = await storage.getPlayersForMatch(matchId);
        let updated = 0;
        for (const player of matchPlayers) {
          let pts = void 0;
          if (player.externalId && pointsMap.has(player.externalId)) {
            pts = pointsMap.get(player.externalId);
          }
          if (pts === void 0 && namePointsMap.size > 0 && player.name) {
            const normName = player.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
            if (namePointsMap.has(normName)) {
              pts = namePointsMap.get(normName);
            } else {
              for (const [apiName, apiPts] of namePointsMap) {
                if (apiName.includes(normName) || normName.includes(apiName)) {
                  pts = apiPts;
                  break;
                }
                const p1 = apiName.split(" "), p2 = normName.split(" ");
                if (p1.length > 0 && p2.length > 0 && p1[0][0] === p2[0][0]) {
                  const l1 = p1[p1.length - 1], l2 = p2[p2.length - 1];
                  if (l1 === l2 || l1.substring(0, 3) === l2.substring(0, 3) && p1[0].substring(0, 3) === p2[0].substring(0, 3)) {
                    pts = apiPts;
                    break;
                  }
                }
              }
            }
          }
          if (pts !== void 0) {
            pts += 4;
            await storage.updatePlayer(player.id, { points: pts });
            updated++;
          } else if (player.isPlayingXI) {
            await storage.updatePlayer(player.id, { points: 4 });
            updated++;
          }
        }
        const recalcAfterScorecard = globalThis.__recalculateTeamTotals;
        if (recalcAfterScorecard) {
          await recalcAfterScorecard(matchId, `${match.team1Short} vs ${match.team2Short}`);
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
      try {
        if (!match.externalId) {
          return res.json({ scorecard: null, message: "No external match ID" });
        }
        const cacheKey = match.externalId;
        const cached = liveScorecardCache.get(cacheKey);
        const now = Date.now();
        if (cached && now - cached.fetchedAt < LIVE_CACHE_TTL_MS) {
          console.log(`[LiveScorecard] cache HIT for ${cacheKey} (age ${Math.round((now - cached.fetchedAt) / 1e3)}s)`);
          return res.json(cached.data);
        }
        console.log(`[LiveScorecard] cache MISS for ${cacheKey} \u2014 fetching from CricAPI`);
        let scorecard = null;
        let source = "none";
        try {
          const { fetchLiveScorecard: fetchLiveScorecard2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
          scorecard = await fetchLiveScorecard2(cacheKey);
          if (scorecard) source = "CricAPI";
        } catch (apiErr) {
          console.error(`[LiveScorecard] fetch failed for ${cacheKey}:`, apiErr?.message || apiErr);
        }
        const payload = scorecard ? { scorecard, source } : { scorecard: null, message: "No scorecard data available yet" };
        liveScorecardCache.set(cacheKey, { data: payload, fetchedAt: now });
        return res.json(payload);
      } catch (err) {
        console.error("Live scorecard route error:", err?.message || err);
        return res.json({ scorecard: null, error: err?.message || "Failed to fetch scorecard" });
      }
    }
  );
  app2.get(
    "/api/matches/:id/live-score",
    isAuthenticated,
    async (req, res) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });
      try {
        if (!match.externalId) return res.json({ score: null });
        const cacheKey = match.externalId;
        const cached = liveScoreCache.get(cacheKey);
        const now = Date.now();
        if (cached && now - cached.fetchedAt < LIVE_CACHE_TTL_MS) {
          console.log(`[LiveScore] cache HIT for ${cacheKey} (age ${Math.round((now - cached.fetchedAt) / 1e3)}s)`);
          return res.json(cached.data);
        }
        console.log(`[LiveScore] cache MISS for ${cacheKey} \u2014 fetching from CricAPI`);
        let scoreData = null;
        const info = await fetchMatchInfo(cacheKey);
        if (info) {
          scoreData = {
            score: info.score || [],
            status: info.status,
            matchStarted: info.matchStarted,
            matchEnded: info.matchEnded,
            source: "CricAPI"
          };
        }
        const payload = scoreData ?? { score: null };
        liveScoreCache.set(cacheKey, { data: payload, fetchedAt: now });
        return res.json(payload);
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
      const matchPlayers = await storage.getPlayersForMatch(req.params.id);
      const isCompleted = match.status === "completed";
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
      const userTeamsByUser = /* @__PURE__ */ new Map();
      for (const t of allTeams) {
        const arr = userTeamsByUser.get(t.userId) || [];
        arr.push(t);
        userTeamsByUser.set(t.userId, arr);
      }
      if (isLive || isCompleted) {
        const teamsWithInfo = allTeams.map((t) => {
          const isOwn = t.userId === req.session.userId;
          const isInvisible = t.invisibleMode === true;
          const shouldHide = isInvisible && !isOwn && !isCompleted;
          if (shouldHide) {
            return {
              id: t.id,
              userId: t.userId,
              matchId: t.matchId,
              name: t.name,
              username: allUsers[t.userId]?.username || "Unknown",
              userTeamName: allUsers[t.userId]?.teamName || "",
              invisibleMode: true,
              invisibleHidden: true,
              playerIds: [],
              captainId: null,
              viceCaptainId: null,
              primaryImpactId: null,
              backupImpactId: null,
              captainType: null,
              vcType: null,
              totalPoints: t.totalPoints,
              createdAt: t.createdAt
            };
          }
          return {
            ...t,
            username: allUsers[t.userId]?.username || "Unknown",
            userTeamName: allUsers[t.userId]?.teamName || "",
            invisibleHidden: false
          };
        });
        return res.json({ teams: teamsWithInfo, visibility: isCompleted ? "full" : "live", players: matchPlayers, impactFeaturesEnabled: match.impactFeaturesEnabled });
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
          primaryImpactId: t.userId === req.session.userId ? t.primaryImpactId : null,
          backupImpactId: t.userId === req.session.userId ? t.backupImpactId : null,
          captainType: t.userId === req.session.userId ? t.captainType : null,
          vcType: t.userId === req.session.userId ? t.vcType : null,
          invisibleMode: t.userId === req.session.userId ? t.invisibleMode : void 0,
          totalPoints: t.totalPoints,
          createdAt: t.createdAt
        }));
        return res.json({ teams: hiddenTeams, visibility: "hidden", impactFeaturesEnabled: match.impactFeaturesEnabled });
      }
    }
  );
  app2.get(
    "/api/matches/:id/standings",
    isAuthenticated,
    async (req, res) => {
      const matchId = req.params.id;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });
      const now = /* @__PURE__ */ new Date();
      const matchStart = new Date(match.startTime);
      const isLive = now.getTime() >= matchStart.getTime();
      if (!isLive) {
        return res.json({ standings: [], isLive: false, message: "Match has not started yet" });
      }
      try {
        const allTeams = await storage.getAllTeamsForMatch(matchId);
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
        const matchPlayersForResponse = await storage.getPlayersForMatch(matchId);
        const playerById = new Map(matchPlayersForResponse.map((p) => [p.id, p]));
        const standings = allTeams.map((t) => {
          let resolvedPlayers = t.playerIds.map((pid) => {
            const p = playerById.get(pid);
            if (p) return { id: p.id, name: p.name, role: p.role, points: p.points || 0, teamShort: p.teamShort };
            return null;
          }).filter(Boolean);
          if (resolvedPlayers.length === 0 && matchPlayersForResponse.length > 0) {
            const targetPts = t.totalPoints || 0;
            const numPlayers = t.playerIds.length || 11;
            const sorted = [...matchPlayersForResponse].sort((a, b) => (b.points || 0) - (a.points || 0));
            const topPlayers = sorted.slice(0, numPlayers);
            resolvedPlayers = topPlayers.map((p) => ({
              id: p.id,
              name: p.name,
              role: p.role,
              points: p.points || 0,
              teamShort: p.teamShort
            }));
          }
          return {
            teamId: t.id,
            teamName: t.name,
            userId: t.userId,
            username: allUsers[t.userId]?.username || "Unknown",
            userTeamName: allUsers[t.userId]?.teamName || "",
            totalPoints: t.totalPoints || 0,
            playerIds: t.playerIds,
            captainId: t.captainId,
            viceCaptainId: t.viceCaptainId,
            resolvedPlayers
          };
        }).sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
        let rank = 1;
        const rankedStandings = standings.map((s, i) => {
          if (i > 0 && s.totalPoints < standings[i - 1].totalPoints) {
            rank = i + 1;
          }
          return { ...s, rank };
        });
        return res.json({ standings: rankedStandings, isLive: true, players: matchPlayersForResponse });
      } catch (err) {
        console.error("Standings error:", err);
        return res.status(500).json({ message: "Failed to load standings" });
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
        const { matchId, name, playerIds, captainId, viceCaptainId, primaryImpactId, backupImpactId, captainType, vcType, invisibleMode } = req.body;
        console.log("Receiving Team:", JSON.stringify({ matchId, name, playerIds, captainId, viceCaptainId, primaryImpactId, backupImpactId, captainType, vcType }));
        console.log("Player IDs count:", playerIds?.length, "IDs:", playerIds);
        const match = await storage.getMatch(matchId);
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }
        const now = /* @__PURE__ */ new Date();
        if (!isEntryOpen(match, now.getTime())) {
          return res.status(400).json({ message: "Entry deadline has passed" });
        }
        if (match.status === "live" || match.status === "completed") {
          return res.status(400).json({ message: "Match has already started" });
        }
        const existingTeams = await storage.getUserTeamsForMatch(
          req.session.userId,
          matchId
        );
        const weeklyUsage = await storage.getOrCreateWeeklyUsage(req.session.userId);
        const maxTeams = storage.canUseMultiTeam(weeklyUsage) ? 3 : 1;
        if (existingTeams.length >= maxTeams) {
          if (maxTeams === 1) {
            return res.status(400).json({ message: "You've used all 3 multi-team slots this week. Only 1 team allowed for this match." });
          }
          return res.status(400).json({ message: "Maximum 3 teams per match" });
        }
        if (!playerIds || playerIds.length !== 11) {
          return res.status(400).json({ message: "Must select exactly 11 players" });
        }
        if (!captainId || !viceCaptainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain required" });
        }
        const matchPlayers = await storage.getPlayersForMatch(matchId);
        const playerMap = new Map(matchPlayers.map((p) => [p.id, p]));
        const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
        const teamPlayerCounts = {};
        for (const pid of playerIds) {
          const p = playerMap.get(pid);
          if (p) {
            roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
            const ts = p.teamShort || "";
            teamPlayerCounts[ts] = (teamPlayerCounts[ts] || 0) + 1;
          }
        }
        const ROLE_LIMITS = {
          WK: { min: 1, max: 4 },
          BAT: { min: 1, max: 6 },
          AR: { min: 1, max: 6 },
          BOWL: { min: 1, max: 6 }
        };
        for (const [role, limits] of Object.entries(ROLE_LIMITS)) {
          const count = roleCounts[role] || 0;
          if (count < limits.min || count > limits.max) {
            return res.status(400).json({ message: `You must select between ${limits.min}-${limits.max} ${role}s` });
          }
        }
        for (const [team2, count] of Object.entries(teamPlayerCounts)) {
          if (count > 10) {
            return res.status(400).json({ message: "You can only select a maximum of 10 players from one team." });
          }
        }
        const impactEnabled = match.impactFeaturesEnabled === true;
        let validPrimaryImpactId = null;
        let validBackupImpactId = null;
        let validCaptainType = "player";
        let validVcType = "player";
        if (impactEnabled) {
          if (primaryImpactId) {
            if (playerIds.includes(primaryImpactId)) {
              return res.status(400).json({ message: "Primary Impact Pick cannot be from your Main XI." });
            }
            const primaryPlayer = playerMap.get(primaryImpactId);
            if (!primaryPlayer) {
              return res.status(400).json({ message: "Invalid Primary Impact Pick player." });
            }
            validPrimaryImpactId = primaryImpactId;
          }
          if (backupImpactId) {
            if (playerIds.includes(backupImpactId)) {
              return res.status(400).json({ message: "Backup Impact Pick cannot be from your Main XI." });
            }
            if (backupImpactId === primaryImpactId) {
              return res.status(400).json({ message: "Backup Impact Pick must be different from Primary." });
            }
            const backupPlayer = playerMap.get(backupImpactId);
            if (!backupPlayer) {
              return res.status(400).json({ message: "Invalid Backup Impact Pick player." });
            }
            if (primaryImpactId) {
              const primaryPlayer = playerMap.get(primaryImpactId);
              if (primaryPlayer && backupPlayer && primaryPlayer.teamShort !== backupPlayer.teamShort) {
                return res.status(400).json({ message: "Backup Impact Pick must be from the same franchise as Primary." });
              }
            }
            validBackupImpactId = backupImpactId;
          }
          if (captainType === "impact_slot") {
            if (!validPrimaryImpactId) {
              return res.status(400).json({ message: "Cannot set Captain on Impact Slot without an Impact Pick." });
            }
            validCaptainType = "impact_slot";
          }
          if (vcType === "impact_slot") {
            if (!validPrimaryImpactId) {
              return res.status(400).json({ message: "Cannot set Vice-Captain on Impact Slot without an Impact Pick." });
            }
            validVcType = "impact_slot";
          }
          if (captainType === "impact_slot" && vcType === "impact_slot") {
            return res.status(400).json({ message: "Both Captain and Vice-Captain cannot be on the Impact Slot." });
          }
        }
        const sortedNewIds = [...playerIds].sort();
        for (const et of existingTeams) {
          const sortedExisting = [...et.playerIds || []].sort();
          const samePlayerIds = sortedNewIds.length === sortedExisting.length && sortedNewIds.every((id, i) => id === sortedExisting[i]);
          if (samePlayerIds && et.captainId === captainId && et.viceCaptainId === viceCaptainId && et.primaryImpactId === validPrimaryImpactId && et.backupImpactId === validBackupImpactId && et.captainType === validCaptainType && et.vcType === validVcType) {
            return res.status(400).json({ message: "You have already created this exact team. Please change at least one player or the Captain/VC." });
          }
        }
        const existingPrediction = await storage.getUserPredictionForMatch(req.session.userId, matchId);
        if (!existingPrediction) {
          return res.status(400).json({ message: "You must predict a match winner before submitting your team." });
        }
        let useInvisible = false;
        if (impactEnabled && invisibleMode === true) {
          const invUsage = await storage.getOrCreateWeeklyUsage(req.session.userId);
          if (!storage.canUseInvisibleMode(invUsage)) {
            return res.status(400).json({ message: "You've already used Invisible Mode once this week." });
          }
          const existingInvisible = existingTeams.some((t) => t.invisibleMode === true);
          if (existingInvisible) {
            useInvisible = true;
          } else {
            useInvisible = true;
            await storage.incrementInvisibleUsage(req.session.userId);
          }
        }
        const team = await storage.createUserTeam({
          userId: req.session.userId,
          matchId,
          name: name || `Team ${existingTeams.length + 1}`,
          playerIds,
          captainId,
          viceCaptainId,
          primaryImpactId: validPrimaryImpactId,
          backupImpactId: validBackupImpactId,
          captainType: validCaptainType,
          vcType: validVcType,
          invisibleMode: useInvisible
        });
        return res.json({ team, weeklyUsage: { maxTeams, teamsCreated: existingTeams.length + 1 } });
      } catch (err) {
        console.error("CRITICAL TEAM SAVE ERROR:", err);
        console.error("CRITICAL TEAM SAVE STACK:", err?.stack);
        return res.status(500).json({
          message: "Server Crash: " + (err?.message || "Unknown Error"),
          details: String(err?.stack || err)
        });
      }
    }
  );
  app2.put(
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
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }
        const now = /* @__PURE__ */ new Date();
        if (!isEntryOpen(match, now.getTime())) {
          return res.status(400).json({ message: "Entry deadline has passed" });
        }
        if (match.status === "live" || match.status === "completed") {
          return res.status(400).json({ message: "Match has already started" });
        }
        const { playerIds, captainId, viceCaptainId, primaryImpactId, backupImpactId, captainType, vcType, invisibleMode } = req.body;
        if (!playerIds || playerIds.length !== 11) {
          return res.status(400).json({ message: "Must select exactly 11 players" });
        }
        if (!captainId || !viceCaptainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain required" });
        }
        const matchPlayers = await storage.getPlayersForMatch(team.matchId);
        const playerMap = new Map(matchPlayers.map((p) => [p.id, p]));
        const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
        const teamPlayerCounts = {};
        for (const pid of playerIds) {
          const p = playerMap.get(pid);
          if (p) {
            roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
            const ts = p.teamShort || "";
            teamPlayerCounts[ts] = (teamPlayerCounts[ts] || 0) + 1;
          }
        }
        const ROLE_LIMITS = {
          WK: { min: 1, max: 4 },
          BAT: { min: 1, max: 6 },
          AR: { min: 1, max: 6 },
          BOWL: { min: 1, max: 6 }
        };
        for (const [role, limits] of Object.entries(ROLE_LIMITS)) {
          const count = roleCounts[role] || 0;
          if (count < limits.min || count > limits.max) {
            return res.status(400).json({ message: `You must select between ${limits.min}-${limits.max} ${role}s` });
          }
        }
        for (const [t, count] of Object.entries(teamPlayerCounts)) {
          if (count > 10) {
            return res.status(400).json({ message: "You can only select a maximum of 10 players from one team." });
          }
        }
        const impactEnabled = match.impactFeaturesEnabled === true;
        let validPrimaryImpactId = null;
        let validBackupImpactId = null;
        let validCaptainType = "player";
        let validVcType = "player";
        if (impactEnabled) {
          if (primaryImpactId) {
            if (playerIds.includes(primaryImpactId)) {
              return res.status(400).json({ message: "Primary Impact Pick cannot be from your Main XI." });
            }
            const primaryPlayer = playerMap.get(primaryImpactId);
            if (!primaryPlayer) return res.status(400).json({ message: "Invalid Primary Impact Pick player." });
            validPrimaryImpactId = primaryImpactId;
          }
          if (backupImpactId) {
            if (playerIds.includes(backupImpactId)) {
              return res.status(400).json({ message: "Backup Impact Pick cannot be from your Main XI." });
            }
            if (backupImpactId === primaryImpactId) {
              return res.status(400).json({ message: "Backup Impact Pick must be different from Primary." });
            }
            const backupPlayer = playerMap.get(backupImpactId);
            if (!backupPlayer) return res.status(400).json({ message: "Invalid Backup Impact Pick player." });
            if (primaryImpactId) {
              const primaryPlayer = playerMap.get(primaryImpactId);
              if (primaryPlayer && backupPlayer && primaryPlayer.teamShort !== backupPlayer.teamShort) {
                return res.status(400).json({ message: "Backup Impact Pick must be from the same franchise as Primary." });
              }
            }
            validBackupImpactId = backupImpactId;
          }
          if (captainType === "impact_slot") {
            if (!validPrimaryImpactId) return res.status(400).json({ message: "Cannot set Captain on Impact Slot without an Impact Pick." });
            validCaptainType = "impact_slot";
          }
          if (vcType === "impact_slot") {
            if (!validPrimaryImpactId) return res.status(400).json({ message: "Cannot set Vice-Captain on Impact Slot without an Impact Pick." });
            validVcType = "impact_slot";
          }
          if (captainType === "impact_slot" && vcType === "impact_slot") {
            return res.status(400).json({ message: "Both Captain and Vice-Captain cannot be on the Impact Slot." });
          }
        }
        const existingTeams = await storage.getUserTeamsForMatch(req.session.userId, team.matchId);
        const sortedNewIds = [...playerIds].sort();
        for (const et of existingTeams) {
          if (et.id === team.id) continue;
          const sortedExisting = [...et.playerIds || []].sort();
          const samePlayerIds = sortedNewIds.length === sortedExisting.length && sortedNewIds.every((id, i) => id === sortedExisting[i]);
          if (samePlayerIds && et.captainId === captainId && et.viceCaptainId === viceCaptainId && et.primaryImpactId === validPrimaryImpactId && et.backupImpactId === validBackupImpactId && et.captainType === validCaptainType && et.vcType === validVcType) {
            return res.status(400).json({ message: "You have already created this exact team. Please change at least one player or the Captain/VC." });
          }
        }
        let useInvisible = team.invisibleMode || false;
        if (impactEnabled && invisibleMode === true && !team.invisibleMode) {
          const invUsage = await storage.getOrCreateWeeklyUsage(req.session.userId);
          if (!storage.canUseInvisibleMode(invUsage)) {
            return res.status(400).json({ message: "You've already used Invisible Mode once this week." });
          }
          const existingInvisible = existingTeams.some((t) => t.id !== team.id && t.invisibleMode === true);
          if (!existingInvisible) {
            await storage.incrementInvisibleUsage(req.session.userId);
          }
          useInvisible = true;
        } else if (invisibleMode === false && team.invisibleMode) {
          const existingInvisible = existingTeams.filter((t) => t.id !== team.id && t.invisibleMode === true);
          if (existingInvisible.length === 0) {
            await storage.decrementInvisibleUsage(req.session.userId);
          }
          useInvisible = false;
        }
        const updated = await storage.updateUserTeam(req.params.id, req.session.userId, {
          playerIds,
          captainId,
          viceCaptainId,
          primaryImpactId: validPrimaryImpactId,
          backupImpactId: validBackupImpactId,
          captainType: validCaptainType,
          vcType: validVcType,
          invisibleMode: useInvisible
        });
        return res.json({ team: updated });
      } catch (err) {
        console.error("Update team error:", err);
        return res.status(500).json({ message: "Failed to update team" });
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
          if (match.status === "live" || match.status === "completed") {
            return res.status(400).json({ message: "Cannot delete team after match has started" });
          }
          if (!isEntryOpen(match, now.getTime())) {
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
  app2.post(
    "/api/predictions",
    isAuthenticated,
    async (req, res) => {
      try {
        const { matchId, predictedWinner } = req.body;
        if (!matchId || !predictedWinner) {
          return res.status(400).json({ message: "matchId and predictedWinner are required" });
        }
        const match = await storage.getMatch(matchId);
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }
        const now = /* @__PURE__ */ new Date();
        if (!isEntryOpen(match, now.getTime())) {
          return res.status(400).json({ message: "Prediction deadline has passed" });
        }
        if (match.status === "live" || match.status === "completed") {
          return res.status(400).json({ message: "Match has already started" });
        }
        if (predictedWinner !== match.team1Short && predictedWinner !== match.team2Short) {
          return res.status(400).json({ message: "Invalid team selection" });
        }
        const existing = await storage.getUserPredictionForMatch(req.session.userId, matchId);
        let prediction;
        if (existing) {
          prediction = await storage.updatePrediction(req.session.userId, matchId, predictedWinner);
        } else {
          prediction = await storage.createPrediction({
            userId: req.session.userId,
            matchId,
            predictedWinner
          });
        }
        return res.json({ prediction });
      } catch (err) {
        console.error("Prediction error:", err);
        return res.status(500).json({ message: "Failed to save prediction" });
      }
    }
  );
  app2.get(
    "/api/predictions/:matchId",
    isAuthenticated,
    async (req, res) => {
      try {
        const match = await storage.getMatch(req.params.matchId);
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }
        const isRevealed = match.status === "live" || match.status === "completed";
        const myPrediction = await storage.getUserPredictionForMatch(
          req.session.userId,
          req.params.matchId
        );
        if (!isRevealed) {
          return res.json({
            isRevealed: false,
            myPrediction: myPrediction ? { id: myPrediction.id, predictedWinner: myPrediction.predictedWinner } : null,
            predictions: []
          });
        }
        const allPredictions = await storage.getPredictionsForMatch(req.params.matchId);
        const userIds = [...new Set(allPredictions.map((p) => p.userId))];
        const usersData = {};
        for (const uid of userIds) {
          const u = await storage.getUser(uid);
          if (u) usersData[uid] = { username: u.username, teamName: u.teamName || "" };
        }
        const predictions = allPredictions.map((p) => ({
          id: p.id,
          userId: p.userId,
          username: usersData[p.userId]?.username || "Unknown",
          teamName: usersData[p.userId]?.teamName || "",
          predictedWinner: p.predictedWinner
        }));
        return res.json({
          isRevealed: true,
          myPrediction: myPrediction ? { id: myPrediction.id, predictedWinner: myPrediction.predictedWinner } : null,
          predictions
        });
      } catch (err) {
        console.error("Get predictions error:", err);
        return res.status(500).json({ message: "Failed to fetch predictions" });
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
        await syncMatchesFromApi();
        await refreshStaleMatchStatuses();
        return res.json({
          message: "T20 World Cup match sync triggered successfully"
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
  app2.get(
    "/api/admin/browse-api-matches",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const [apiMatches, existingMatches] = await Promise.all([
          fetchUpcomingMatches(),
          storage.getAllMatches()
        ]);
        const existingIds = new Set(existingMatches.map((m) => m.externalId).filter(Boolean));
        const isIPL = (name, league) => {
          const n = (name + " " + league).toLowerCase();
          return n.includes("indian premier league") || n.includes(" ipl") || n.includes("ipl ");
        };
        const now = Date.now();
        const ms7d = 7 * 24 * 60 * 60 * 1e3;
        const filtered = apiMatches.filter((m) => {
          if (existingIds.has(m.externalId)) return false;
          if (isIPL(m.team1 + " " + m.team2, m.league)) return false;
          if (m.status === "completed") return false;
          const t = new Date(m.startTime).getTime();
          return t >= now - 864e5 && t <= now + ms7d;
        });
        return res.json({ matches: filtered });
      } catch (err) {
        console.error("Browse API matches error:", err);
        return res.status(500).json({ message: "Failed to fetch API matches" });
      }
    }
  );
  app2.post(
    "/api/admin/import-api-match",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { externalId, seriesId, team1, team1Short, team1Color, team2, team2Short, team2Color, venue, startTime, league } = req.body;
        if (!team1 || !team2 || !startTime) {
          return res.status(400).json({ message: "team1, team2, and startTime are required" });
        }
        const existing = await storage.getAllMatches();
        if (externalId && existing.some((m) => m.externalId === externalId)) {
          return res.status(409).json({ message: "Match already exists in database" });
        }
        const match = await storage.createMatch({
          externalId: externalId || null,
          seriesId: seriesId || null,
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
        let playersLoaded = 0;
        let squadMessage = "No squad data found yet \u2014 use 'Fetch Squad' in Match Controls.";
        if (externalId) {
          try {
            const { fetchMatchSquad: fetchMatchSquad2, fetchSeriesSquad: fetchSeriesSquad2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
            let squad = await fetchMatchSquad2(externalId);
            if (squad.length === 0 && seriesId) {
              const seriesPlayers = await fetchSeriesSquad2(seriesId);
              const t1 = team1.toLowerCase();
              const t2 = team2.toLowerCase();
              const t1s = (team1Short || "").toLowerCase();
              const t2s = (team2Short || "").toLowerCase();
              squad = seriesPlayers.filter((p) => {
                const pTeam = p.team.toLowerCase();
                const pShort = p.teamShort.toLowerCase();
                return pTeam === t1 || pTeam === t2 || pTeam.includes(t1) || t1.includes(pTeam) || pTeam.includes(t2) || t2.includes(pTeam) || pShort === t1s || pShort === t2s;
              });
            }
            if (squad.length > 0) {
              await storage.upsertPlayersForMatch(match.id, squad.map((p) => ({
                matchId: match.id,
                externalId: p.externalId,
                name: p.name,
                team: p.team,
                teamShort: p.teamShort,
                role: p.role,
                credits: p.credits
              })));
              playersLoaded = squad.length;
              squadMessage = `${playersLoaded} players loaded automatically.`;
            }
          } catch (e) {
            console.error("Auto squad fetch failed:", e);
          }
        }
        return res.json({ match, playersLoaded, squadMessage });
      } catch (err) {
        console.error("Import API match error:", err);
        return res.status(500).json({ message: "Failed to import match" });
      }
    }
  );
  app2.patch(
    "/api/admin/matches/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const updates = req.body;
        if (updates.startTime) updates.startTime = new Date(updates.startTime);
        await storage.updateMatch(matchId, updates);
        return res.json({ message: "Match updated" });
      } catch (err) {
        console.error("Update match error:", err);
        return res.status(500).json({ message: "Failed to update match" });
      }
    }
  );
  app2.delete(
    "/api/admin/matches/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const forceDelete = req.query.force === "true";
        const teams = await storage.getAllTeamsForMatch(matchId);
        if (teams.length > 0 && !forceDelete) {
          return res.status(400).json({ message: `Cannot delete match with ${teams.length} existing teams. Use force=true to override.` });
        }
        if (teams.length > 0 && forceDelete) {
          for (const team of teams) {
            await storage.deleteTeam(team.id);
          }
        }
        await storage.deleteMatchCascade(matchId);
        await storage.createAuditLog({
          adminUserId: req.session.userId,
          actionType: "delete_match",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ forced: forceDelete, teamsRemoved: teams.length })
        });
        return res.json({ message: "Match permanently deleted" });
      } catch (err) {
        console.error("Delete match error:", err);
        return res.status(500).json({ message: "Failed to delete match" });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/fetch-squad",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      const matchId = req.params.id;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });
      if (!match.externalId) return res.status(400).json({ message: "This match has no external API ID \u2014 squad cannot be fetched automatically." });
      try {
        const { fetchMatchSquad: fetchMatchSquad2, fetchSeriesSquad: fetchSeriesSquad2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
        let squad = await fetchMatchSquad2(match.externalId);
        let source = "CricAPI (match_squad)";
        console.log(`[Fetch Squad] Tier 1 match_squad returned ${squad.length} players for ${match.team1Short} vs ${match.team2Short}`);
        if (squad.length === 0 && match.seriesId) {
          const seriesPlayers = await fetchSeriesSquad2(match.seriesId);
          const team1 = match.team1.toLowerCase();
          const team2 = match.team2.toLowerCase();
          const t1Short = match.team1Short.toLowerCase();
          const t2Short = match.team2Short.toLowerCase();
          squad = seriesPlayers.filter((p) => {
            const pTeam = p.team.toLowerCase();
            const pShort = p.teamShort.toLowerCase();
            return pTeam === team1 || pTeam === team2 || pTeam.includes(team1) || team1.includes(pTeam) || pTeam.includes(team2) || team2.includes(pTeam) || pShort === t1Short || pShort === t2Short;
          });
          source = "CricAPI (series_squad)";
          console.log(`[Fetch Squad] Tier 1 series_squad filtered ${squad.length} players`);
        }
        if (squad.length === 0) {
          return res.json({
            message: `No squad data found for ${match.team1Short} vs ${match.team2Short}. API may not have squads yet.`,
            totalPlayers: 0,
            source: "none"
          });
        }
        await storage.upsertPlayersForMatch(matchId, squad.map((p) => ({
          matchId,
          externalId: p.externalId,
          name: p.name,
          team: p.team,
          teamShort: p.teamShort,
          role: p.role,
          credits: p.credits
        })));
        const matchPlayers = await storage.getPlayersForMatch(matchId);
        return res.json({
          message: `Squad imported successfully! ${matchPlayers.length} players loaded for ${match.team1Short} vs ${match.team2Short}`,
          totalPlayers: matchPlayers.length,
          source
        });
      } catch (err) {
        console.error("[Fetch Squad] error:", err);
        return res.status(500).json({ message: "Failed to fetch squad from API" });
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
          apiName: p.apiName || null,
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
  app2.delete(
    "/api/admin/players/:playerId",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        await storage.deletePlayer(req.params.playerId);
        return res.json({ message: "Player deleted" });
      } catch (err) {
        console.error("Delete player error:", err);
        return res.status(500).json({ message: "Failed to delete player" });
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
        const { fetchPlayingXIFromScorecard: fetchPlayingXIFromScorecard2, fetchPlayingXIFromMatchInfo: fetchPlayingXIFromMatchInfo2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
        let playingIds = await fetchPlayingXIFromScorecard2(match.externalId);
        let source = "scorecard";
        if (playingIds.length === 0) {
          playingIds = await fetchPlayingXIFromMatchInfo2(match.externalId);
          source = "match_info";
        }
        if (playingIds.length === 0) {
          return res.json({ message: "No Playing XI data available yet - match may not have started", count: 0 });
        }
        await storage.markPlayingXI(matchId, playingIds);
        const recalcAfterXI = globalThis.__recalculateTeamTotals;
        if (recalcAfterXI) await recalcAfterXI(matchId, `${match.team1Short} vs ${match.team2Short}`);
        return res.json({ message: `Playing XI updated: ${playingIds.length} players marked, team points recalculated`, count: playingIds.length, source });
      } catch (err) {
        console.error("Refresh Playing XI error:", err);
        return res.status(500).json({ message: "Failed to refresh Playing XI" });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/set-playing-xi",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const { playerIds } = req.body;
        if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
          return res.status(400).json({ message: "playerIds array required" });
        }
        if (playerIds.length < 11 || playerIds.length > 22) {
          return res.status(400).json({ message: "Expected 11-22 player IDs (Playing XI for both teams)" });
        }
        const updated = await storage.markPlayingXIByIds(matchId, playerIds);
        await storage.updateMatch(matchId, { playingXIManual: true });
        const recalcAfterManualXI = globalThis.__recalculateTeamTotals;
        if (recalcAfterManualXI) await recalcAfterManualXI(matchId, `${match.team1Short} vs ${match.team2Short}`);
        return res.json({
          message: `Playing XI manually set: ${updated} players marked, team points recalculated`,
          count: updated,
          source: "admin_manual"
        });
      } catch (err) {
        console.error("Manual Playing XI error:", err);
        return res.status(500).json({ message: "Failed to set Playing XI" });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/repair-teams",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const matchPlayers = await storage.getPlayersForMatch(matchId);
        if (matchPlayers.length === 0) {
          return res.json({ message: "No players found for this match", repaired: 0 });
        }
        const playerById = new Map(matchPlayers.map((p) => [p.id, p]));
        const playerByExtId = new Map(matchPlayers.filter((p) => p.externalId).map((p) => [p.externalId, p]));
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        let repaired = 0;
        for (const team of allTeams) {
          const teamPlayerIds = team.playerIds;
          let hasOrphans = false;
          for (const pid of teamPlayerIds) {
            if (!playerById.has(pid)) {
              hasOrphans = true;
              break;
            }
          }
          if (!hasOrphans) continue;
          const newPlayerIds = [];
          let newCaptainId = team.captainId;
          let newViceCaptainId = team.viceCaptainId;
          const usedPlayerIds = /* @__PURE__ */ new Set();
          for (const pid of teamPlayerIds) {
            if (playerById.has(pid)) {
              newPlayerIds.push(pid);
              usedPlayerIds.add(pid);
            } else {
              const byExt = playerByExtId.get(pid);
              if (byExt && !usedPlayerIds.has(byExt.id)) {
                newPlayerIds.push(byExt.id);
                usedPlayerIds.add(byExt.id);
                if (pid === team.captainId) newCaptainId = byExt.id;
                if (pid === team.viceCaptainId) newViceCaptainId = byExt.id;
              }
            }
          }
          if (newPlayerIds.length === teamPlayerIds.length) {
            await db.update(userTeams).set({
              playerIds: newPlayerIds,
              captainId: newCaptainId,
              viceCaptainId: newViceCaptainId
            }).where(eq2(userTeams.id, team.id));
            repaired++;
          }
        }
        return res.json({
          message: `Repaired ${repaired} teams out of ${allTeams.length}`,
          repaired,
          total: allTeams.length
        });
      } catch (err) {
        console.error("Repair teams error:", err);
        return res.status(500).json({ message: "Failed to repair teams" });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/purge-points",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const matchPlayers = await storage.getPlayersForMatch(matchId);
        let playersReset = 0;
        for (const p of matchPlayers) {
          if (p.points !== 0) {
            await storage.updatePlayer(p.id, { points: 0 });
            playersReset++;
          }
        }
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        let teamsReset = 0;
        for (const t of allTeams) {
          if ((t.totalPoints || 0) !== 0) {
            await storage.updateUserTeamPoints(t.id, 0);
            teamsReset++;
          }
        }
        console.log(`[Admin] Purged points for ${match.team1Short} vs ${match.team2Short}: ${playersReset} players, ${teamsReset} teams zeroed`);
        return res.json({
          message: `Purged: ${playersReset} players and ${teamsReset} teams reset to 0`,
          playersReset,
          teamsReset
        });
      } catch (err) {
        console.error("Purge points error:", err);
        return res.status(500).json({ message: "Failed to purge points" });
      }
    }
  );
  app2.get(
    "/api/admin/teams/:teamShort/last-playing-xi",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const teamShort = req.params.teamShort;
        const excludeMatchId = req.query.excludeMatch;
        const allMatches = await storage.getAllMatches();
        const relevantMatches = allMatches.filter((m) => (m.team1Short === teamShort || m.team2Short === teamShort) && (m.status === "completed" || m.status === "live") && m.id !== excludeMatchId).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        if (relevantMatches.length === 0) {
          return res.json({ found: false, message: "No previous match found", playerNames: [] });
        }
        const prevMatch = relevantMatches[0];
        const prevPlayers = await storage.getPlayersForMatch(prevMatch.id);
        const xiPlayers = prevPlayers.filter((p) => p.isPlayingXI && p.teamShort === teamShort);
        const playerNames = xiPlayers.map((p) => p.name);
        return res.json({
          found: true,
          matchId: prevMatch.id,
          matchLabel: `${prevMatch.team1Short} vs ${prevMatch.team2Short}`,
          playerNames,
          count: playerNames.length
        });
      } catch (err) {
        console.error("Last playing XI error:", err);
        return res.status(500).json({ message: "Failed to fetch last playing XI" });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:matchId/map-player",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { matchId } = req.params;
        const { dbPlayerId, newName, newExternalId, newApiName } = req.body;
        if (!dbPlayerId) return res.status(400).json({ message: "dbPlayerId required" });
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const player = await storage.getPlayersForMatch(matchId);
        const target = player.find((p) => p.id === dbPlayerId);
        if (!target) return res.status(404).json({ message: "Player not found in this match" });
        const updates = {};
        if (newName) updates.name = newName;
        if (newExternalId) updates.externalId = newExternalId;
        if (newApiName !== void 0) updates.apiName = newApiName || null;
        if (Object.keys(updates).length > 0) {
          await storage.updatePlayer(dbPlayerId, updates);
          console.log(`[Admin] Mapped player ${target.name} -> name=${newName || target.name}, extId=${newExternalId || target.externalId}`);
        }
        return res.json({
          message: `Player updated: ${target.name} -> ${newName || target.name}`,
          updated: updates
        });
      } catch (err) {
        console.error("Map player error:", err);
        return res.status(500).json({ message: "Failed to map player" });
      }
    }
  );
  app2.get(
    "/api/admin/matches/:matchId/player-mapping",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { matchId } = req.params;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const dbPlayers = await storage.getPlayersForMatch(matchId);
        let scorecardNames = [];
        if (match.externalId) {
          try {
            const { fetchMatchScorecard: fetchMatchScorecard3 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
            const result = await fetchMatchScorecard3(match.externalId);
            scorecardNames = Array.from(result.namePointsMap.keys());
          } catch (e) {
          }
        }
        return res.json({
          dbPlayers: dbPlayers.map((p) => ({
            id: p.id,
            name: p.name,
            apiName: p.apiName,
            externalId: p.externalId,
            points: p.points,
            role: p.role,
            team: p.team,
            teamShort: p.teamShort,
            isPlayingXI: p.isPlayingXI
          })),
          scorecardNames
        });
      } catch (err) {
        console.error("Player mapping error:", err);
        return res.status(500).json({ message: "Failed to get player mapping" });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/mark-completed",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const matchLabel = `${match.team1Short} vs ${match.team2Short}`;
        if (match.status !== "completed") {
          await storage.updateMatch(matchId, { status: "completed" });
          console.log(`[Admin] Match ${matchLabel} manually marked as completed`);
        }
        const existingReward = await storage.getRewardForMatch(matchId);
        if (existingReward) {
          return res.json({ message: `${matchLabel} already completed, reward already distributed to winner` });
        }
        try {
          await distributeMatchReward(matchId);
          console.log(`[Admin] Reward distribution triggered for ${matchLabel}`);
        } catch (rewardErr) {
          console.error(`[Admin] Reward distribution failed for match ${matchId}:`, rewardErr);
        }
        return res.json({ message: `${matchLabel} marked as completed, reward distribution triggered` });
      } catch (err) {
        console.error("Mark completed error:", err);
        return res.status(500).json({ message: "Failed to mark match as completed" });
      }
    }
  );
  app2.post(
    "/api/debug/force-sync",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      const matchId = req.body?.matchId;
      try {
        console.log(`[Force Sync] Admin triggered manual sync${matchId ? ` for match ${matchId}` : " for all live matches"}`);
        if (matchId) {
          const match = await storage.getMatch(matchId);
          if (!match) {
            return res.status(404).json({ message: "Match not found" });
          }
          if (match.status === "upcoming" || match.status === "delayed") {
            const { fetchMatchSquad: fetchMatchSquad2, fetchSeriesSquad: fetchSeriesSquad2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
            let squad = await fetchMatchSquad2(match.externalId);
            console.log(`[Force Sync] Match squad API returned ${squad.length} players for ${match.team1Short} vs ${match.team2Short}`);
            if (squad.length === 0 && match.seriesId) {
              console.log(`[Force Sync] Match squad empty, trying tournament/series squad for series ${match.seriesId}...`);
              const seriesPlayers = await fetchSeriesSquad2(match.seriesId);
              const team1 = match.team1.toLowerCase();
              const team2 = match.team2.toLowerCase();
              const t1Short = match.team1Short.toLowerCase();
              const t2Short = match.team2Short.toLowerCase();
              squad = seriesPlayers.filter((p) => {
                const pTeam = p.team.toLowerCase();
                const pShort = p.teamShort.toLowerCase();
                return pTeam === team1 || pTeam === team2 || pTeam.includes(team1) || team1.includes(pTeam) || pTeam.includes(team2) || team2.includes(pTeam) || pShort === t1Short || pShort === t2Short;
              });
              console.log(`[Force Sync] Tournament squad: filtered ${squad.length} players for ${match.team1} vs ${match.team2} from ${seriesPlayers.length} total`);
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
              await storage.upsertPlayersForMatch(matchId, playersToCreate);
              const matchPlayers = await storage.getPlayersForMatch(matchId);
              return res.json({
                message: `Squad synced: ${matchPlayers.length} players loaded for ${match.team1Short} vs ${match.team2Short}`,
                match: {
                  id: match.id,
                  teams: `${match.team1Short} vs ${match.team2Short}`,
                  status: match.status
                },
                totalPlayers: matchPlayers.length,
                teamsCount: 0
              });
            } else {
              return res.json({
                message: `No squad data found for ${match.team1Short} vs ${match.team2Short}. The API may not have squads for this match yet.`,
                totalPlayers: 0
              });
            }
          }
        }
        const heartbeat = globalThis.__matchHeartbeat;
        if (!heartbeat) {
          return res.status(500).json({ message: "Heartbeat not initialized" });
        }
        await heartbeat(matchId);
        if (matchId) {
          const match = await storage.getMatch(matchId);
          const matchPlayers = await storage.getPlayersForMatch(matchId);
          const teams = await storage.getAllTeamsForMatch(matchId);
          return res.json({
            message: "Force sync completed",
            match: match ? {
              id: match.id,
              teams: `${match.team1Short} vs ${match.team2Short}`,
              status: match.status,
              scoreString: match.scoreString || "",
              lastSyncAt: match.lastSyncAt
            } : null,
            playersWithPoints: matchPlayers.filter((p) => p.points > 0).length,
            totalPlayers: matchPlayers.length,
            teamsCount: teams.length
          });
        }
        return res.json({ message: "Force sync completed for all live matches" });
      } catch (err) {
        console.error("Force sync error:", err);
        return res.status(500).json({ message: "Force sync failed: " + err.message });
      }
    }
  );
  app2.get(
    "/api/debug/match-status",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        const allMatches = await storage.getAllMatches();
        const now = Date.now();
        const THIRTY_SIX_HOURS = 36 * 60 * 60 * 1e3;
        const filteredMatches = allMatches.filter((m) => {
          if (m.status !== "completed") return true;
          const startMs = new Date(m.startTime).getTime();
          return now - startMs <= THIRTY_SIX_HOURS;
        });
        const playerCountRows = await db.select({ matchId: players.matchId, cnt: sql3`count(*)::int` }).from(players).groupBy(players.matchId);
        const playerCountMap = /* @__PURE__ */ new Map();
        for (const row of playerCountRows) {
          if (row.matchId) playerCountMap.set(row.matchId, row.cnt);
        }
        const matchStatuses = filteredMatches.map((m) => {
          const startMs = new Date(m.startTime).getTime();
          return {
            id: m.id,
            teams: `${m.team1Short} vs ${m.team2Short}`,
            status: m.status,
            scoreString: m.scoreString || "",
            lastSyncAt: m.lastSyncAt,
            startTime: m.startTime,
            hasExternalId: !!m.externalId,
            isLocked: now >= startMs,
            minutesUntilStart: Math.round((startMs - now) / 6e4),
            playerCount: playerCountMap.get(m.id) ?? 0,
            impactFeaturesEnabled: m.impactFeaturesEnabled
          };
        });
        return res.json({ matches: matchStatuses, serverTime: (/* @__PURE__ */ new Date()).toISOString() });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.get(
    "/api/admin/api-calls",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { getInMemoryApiCallCount: getInMemoryApiCallCount2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
        const dbCount = await storage.getApiCallCount();
        const inMemory = getInMemoryApiCallCount2();
        return res.json({
          today: dbCount.count || inMemory,
          date: dbCount.date,
          lastCalledAt: dbCount.lastCalledAt,
          dailyLimit: 2e3,
          tier1Key: !!process.env.CRICKET_API_KEY,
          tier2Key: !!process.env.CRICAPI_KEY_TIER2
        });
      } catch (err) {
        console.error("API call tracking error:", err);
        return res.status(500).json({ message: "Failed to get API call data" });
      }
    }
  );
  async function distributeMatchReward(matchId) {
    try {
      const match = await storage.getMatch(matchId);
      const matchLabel = match ? `${match.team1Short} vs ${match.team2Short}` : matchId;
      console.log(`[Rewards] Starting distribution for ${matchLabel}...`);
      const existingMatchReward = await storage.getRewardForMatch(matchId);
      if (existingMatchReward) {
        console.log(`[Rewards] ${matchLabel}: Reward already distributed for this match (to userId ${existingMatchReward.claimedByUserId}), skipping \u2014 idempotent`);
        return;
      }
      const allTeams = await storage.getAllTeamsForMatch(matchId);
      if (allTeams.length === 0) {
        console.log(`[Rewards] No teams found for ${matchLabel}, skipping`);
        return;
      }
      console.log(`[Rewards] ${matchLabel}: ${allTeams.length} teams submitted`);
      const sorted = [...allTeams].sort((a, b) => {
        if ((b.totalPoints || 0) !== (a.totalPoints || 0)) {
          return (b.totalPoints || 0) - (a.totalPoints || 0);
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      const winner = sorted[0];
      if (!winner || (winner.totalPoints || 0) === 0) {
        console.log(`[Rewards] No valid winner for ${matchLabel} (top team points: ${winner?.totalPoints || 0})`);
        return;
      }
      console.log(`[Rewards] ${matchLabel}: Rank 1 = userId ${winner.userId} with ${winner.totalPoints} pts (team: ${winner.teamName})`);
      const reward = await storage.getRandomAvailableReward();
      if (!reward) {
        console.log(`[Rewards] \u26A0 Vault empty, no reward distributed for match ${matchLabel} \u2014 add coupons via Admin Panel`);
        return;
      }
      await storage.claimReward(reward.id, winner.userId, matchId);
      console.log(`[Rewards] \u2713 ${matchLabel}: "${reward.title}" (${reward.brand}) \u2192 userId ${winner.userId}`);
    } catch (err) {
      console.error(`[Rewards] \u2717 Distribution FAILED for match ${matchId}:`, err);
    }
  }
  globalThis.__distributeMatchReward = distributeMatchReward;
  (async () => {
    try {
      const assignments = [
        {
          matchId: "3cc4d1b3-2959-43c5-9d7c-09f2ed4d0997",
          label: "ENG vs SL",
          rewardId: "5bb13e61-6a04-4229-8ed5-5425f6b8e451",
          rewardBrand: "Zomato"
        },
        {
          matchId: "56467706-bbab-44ff-a4e9-6b369b2470c9",
          label: "IND vs RSA",
          rewardId: "1e89dd29-3c92-48dd-82a6-0df4167ef083",
          rewardBrand: "Domino's"
        }
      ];
      for (const a of assignments) {
        const existing = await storage.getRewardForMatch(a.matchId);
        if (existing) {
          console.log(`[Retroactive] ${a.label}: Already distributed, skipping`);
          continue;
        }
        const allTeams = await storage.getAllTeamsForMatch(a.matchId);
        if (allTeams.length === 0) {
          console.log(`[Retroactive] ${a.label}: No teams found, skipping`);
          continue;
        }
        const sorted = [...allTeams].sort((x, y) => {
          if ((y.totalPoints || 0) !== (x.totalPoints || 0))
            return (y.totalPoints || 0) - (x.totalPoints || 0);
          return new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime();
        });
        const winner = sorted[0];
        await storage.claimReward(a.rewardId, winner.userId, a.matchId);
        console.log(`[Retroactive] \u2713 ${a.label}: ${a.rewardBrand} \u2192 userId ${winner.userId} (${winner.totalPoints} pts)`);
      }
    } catch (err) {
      console.error("[Retroactive] One-time distribution failed:", err);
    }
  })();
  app2.get(
    "/api/admin/rewards",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        const allRewards = await storage.getAllRewards();
        const available = allRewards.filter((r) => !r.isClaimed);
        const claimed = allRewards.filter((r) => r.isClaimed);
        const claimedWithInfo = [];
        for (const r of claimed) {
          let username = "Unknown";
          let matchLabel = "";
          if (r.claimedByUserId) {
            const user = await storage.getUser(r.claimedByUserId);
            if (user) username = user.username;
          }
          if (r.claimedMatchId) {
            const match = await storage.getMatch(r.claimedMatchId);
            if (match) matchLabel = `${match.team1Short} vs ${match.team2Short}`;
          }
          claimedWithInfo.push({ ...r, claimedByUsername: username, matchLabel });
        }
        return res.json({ available, claimed: claimedWithInfo });
      } catch (err) {
        console.error("Admin rewards error:", err);
        return res.status(500).json({ message: "Failed to fetch rewards" });
      }
    }
  );
  app2.post(
    "/api/admin/rewards",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { brand, title, code, terms } = req.body;
        if (!brand || !title || !code) {
          return res.status(400).json({ message: "Brand, title, and code are required" });
        }
        const reward = await storage.createReward({ brand, title, code, terms: terms || "" });
        return res.json({ reward });
      } catch (err) {
        console.error("Create reward error:", err);
        return res.status(500).json({ message: "Failed to create reward" });
      }
    }
  );
  app2.delete(
    "/api/admin/rewards/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        await storage.deleteReward(req.params.id);
        return res.json({ message: "Reward deleted" });
      } catch (err) {
        console.error("Delete reward error:", err);
        return res.status(500).json({ message: "Failed to delete reward" });
      }
    }
  );
  app2.get(
    "/api/rewards/match/:matchId",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = req.session.userId;
        const reward = await storage.getRewardForUserMatch(userId, req.params.matchId);
        return res.json({ reward: reward || null });
      } catch (err) {
        console.error("Get match reward error:", err);
        return res.status(500).json({ message: "Failed to fetch reward" });
      }
    }
  );
  app2.get(
    "/api/rewards/my",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = req.session.userId;
        const myRewards = await storage.getUserRewards(userId);
        const withMatchInfo = [];
        for (const r of myRewards) {
          let matchLabel = "";
          if (r.claimedMatchId) {
            const match = await storage.getMatch(r.claimedMatchId);
            if (match) matchLabel = `${match.team1Short} vs ${match.team2Short}`;
          }
          withMatchInfo.push({ ...r, matchLabel });
        }
        return res.json({ rewards: withMatchInfo });
      } catch (err) {
        console.error("My rewards error:", err);
        return res.status(500).json({ message: "Failed to fetch your rewards" });
      }
    }
  );
  app2.post(
    "/api/tournament/process",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { matchId, tournamentName, stake } = req.body;
        if (!matchId || !tournamentName || !stake) {
          return res.status(400).json({ message: "matchId, tournamentName, and stake are required" });
        }
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (match.status !== "completed") {
          return res.status(400).json({ message: "Match must be COMPLETED before processing pot" });
        }
        if (match.potProcessed) {
          return res.status(400).json({ message: "Pot already processed for this match (idempotency lock)" });
        }
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        if (allTeams.length < 2) {
          return res.status(400).json({ message: `Not enough players. Found ${allTeams.length} team(s), need at least 2.` });
        }
        const entryStake = Number(stake) || 30;
        const maxPoints = Math.max(...allTeams.map((t) => t.totalPoints));
        const winningTeams = allTeams.filter((t) => t.totalPoints === maxPoints);
        const losingTeams = allTeams.filter((t) => t.totalPoints < maxPoints);
        const totalPot = losingTeams.length * entryStake;
        const winnerPointsEach = losingTeams.length > 0 ? Math.round(totalPot / winningTeams.length) : 0;
        const userMap = /* @__PURE__ */ new Map();
        for (const t of allTeams) {
          if (!userMap.has(t.userId)) {
            const u = await storage.getUser(t.userId);
            userMap.set(t.userId, u?.teamName || u?.username || "Unknown");
          }
        }
        for (const t of losingTeams) {
          await storage.createLedgerEntry({
            userId: t.userId,
            userName: userMap.get(t.userId) || "Unknown",
            matchId,
            tournamentName,
            pointsChange: -entryStake
          });
        }
        for (const t of winningTeams) {
          await storage.createLedgerEntry({
            userId: t.userId,
            userName: userMap.get(t.userId) || "Unknown",
            matchId,
            tournamentName,
            pointsChange: winnerPointsEach
          });
        }
        await storage.updateMatch(matchId, {
          tournamentName,
          entryStake,
          potProcessed: true
        });
        console.log(`[Tournament Pot] Processed for ${match.team1Short} vs ${match.team2Short}: ${winningTeams.length} winner(s) (+${winnerPointsEach}), ${losingTeams.length} loser(s) (-${entryStake}), totalPot=${totalPot}`);
        return res.json({
          message: "Pot processed successfully",
          winners: winningTeams.length,
          losers: losingTeams.length,
          winnerPoints: winnerPointsEach,
          loserPoints: -entryStake,
          totalPot,
          totalTeams: allTeams.length
        });
      } catch (err) {
        console.error("Process pot error:", err);
        return res.status(500).json({ message: "Failed to process tournament pot" });
      }
    }
  );
  app2.get(
    "/api/admin/matches/unprocessed",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        const allMatches = await storage.getAllMatches();
        const completed = allMatches.filter((m) => m.status === "completed" && !m.potProcessed);
        const withParticipation = [];
        for (const m of completed) {
          const teams = await storage.getAllTeamsForMatch(m.id);
          if (teams.length > 0) {
            withParticipation.push({
              id: m.id,
              team1Short: m.team1Short,
              team2Short: m.team2Short,
              startTime: m.startTime,
              teamCount: teams.length
            });
          }
        }
        return res.json({ matches: withParticipation });
      } catch (err) {
        console.error("Unprocessed matches error:", err);
        return res.status(500).json({ message: "Failed to fetch unprocessed matches" });
      }
    }
  );
  app2.get(
    "/api/tournament/names",
    isAuthenticated,
    async (_req, res) => {
      try {
        const names = await storage.getDistinctTournamentNames();
        return res.json({ names });
      } catch (err) {
        console.error("Tournament names error:", err);
        return res.status(500).json({ message: "Failed to fetch tournament names" });
      }
    }
  );
  app2.get(
    "/api/tournament/standings",
    isAuthenticated,
    async (req, res) => {
      try {
        const name = req.query.name;
        if (!name) return res.status(400).json({ message: "Tournament name required" });
        const standings = await storage.getTournamentStandings(name);
        return res.json({ standings });
      } catch (err) {
        console.error("Tournament standings error:", err);
        return res.status(500).json({ message: "Failed to fetch tournament standings" });
      }
    }
  );
  app2.post(
    "/api/admin/fix-player-ids",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const oldPlayerMapping = req.body.oldPlayerMapping;
        if (!oldPlayerMapping || Object.keys(oldPlayerMapping).length === 0) {
          return res.status(400).json({ message: "Provide oldPlayerMapping: { oldId: playerName }" });
        }
        const allTeams = await db.select().from(userTeams);
        const allPlayers = await db.select().from(players);
        const playerIdToName = {};
        for (const p of allPlayers) {
          playerIdToName[p.id] = p.name;
        }
        const playersByMatchAndName = {};
        for (const p of allPlayers) {
          if (!playersByMatchAndName[p.matchId]) playersByMatchAndName[p.matchId] = {};
          playersByMatchAndName[p.matchId][p.name.toLowerCase().trim()] = p.id;
        }
        let updatedCount = 0;
        let skippedCount = 0;
        const issues = [];
        for (const team of allTeams) {
          const currentIds = team.playerIds;
          const allIdsValid = currentIds.every((pid) => playerIdToName[pid]);
          if (allIdsValid) {
            skippedCount++;
            continue;
          }
          const matchPlayerNames = playersByMatchAndName[team.matchId] || {};
          const newPlayerIds = [];
          let newCaptainId = team.captainId;
          let newViceCaptainId = team.viceCaptainId;
          let allMapped = true;
          for (const oldId of currentIds) {
            if (playerIdToName[oldId]) {
              newPlayerIds.push(oldId);
              continue;
            }
            const oldName = oldPlayerMapping[oldId];
            if (!oldName) {
              allMapped = false;
              issues.push(`Team ${team.name}: No name mapping for old ID ${oldId}`);
              newPlayerIds.push(oldId);
              continue;
            }
            const newId = matchPlayerNames[oldName.toLowerCase().trim()];
            if (newId) {
              newPlayerIds.push(newId);
              if (team.captainId === oldId) newCaptainId = newId;
              if (team.viceCaptainId === oldId) newViceCaptainId = newId;
            } else {
              allMapped = false;
              issues.push(`Team ${team.name}: Player "${oldName}" not found in match ${team.matchId.substring(0, 8)}`);
              newPlayerIds.push(oldId);
            }
          }
          if (allMapped && newPlayerIds.length === currentIds.length) {
            await db.update(userTeams).set({
              playerIds: newPlayerIds,
              captainId: newCaptainId,
              viceCaptainId: newViceCaptainId
            }).where(eq2(userTeams.id, team.id));
            updatedCount++;
          }
        }
        return res.json({
          message: `Migration complete`,
          totalTeams: allTeams.length,
          updated: updatedCount,
          skipped: skippedCount,
          issueCount: issues.length,
          issues: issues.slice(0, 50)
        });
      } catch (err) {
        console.error("Fix player IDs error:", err);
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/reset-password",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      const { phone, newPassword } = req.body;
      if (!phone || !newPassword) return res.status(400).json({ message: "phone and newPassword required" });
      try {
        await db.update(users).set({ password: newPassword }).where(eq2(users.phone, phone));
        return res.json({ message: "Password reset", phone });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/verify-all-users",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const result = await db.update(users).set({ isVerified: true }).where(eq2(users.isVerified, false));
        return res.json({ message: "All users verified" });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.get(
    "/api/admin/pending-users",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        const pending = await db.select({
          id: users.id,
          username: users.username,
          phone: users.phone,
          email: users.email,
          joinedAt: users.joinedAt
        }).from(users).where(eq2(users.isVerified, false));
        return res.json({ users: pending });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/approve-user",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: "userId required" });
        await db.update(users).set({ isVerified: true }).where(eq2(users.id, userId));
        return res.json({ message: "User approved" });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/reject-user",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: "userId required" });
        await db.delete(userTeams).where(eq2(userTeams.userId, userId));
        await db.delete(users).where(eq2(users.id, userId));
        return res.json({ message: "User rejected and deleted" });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.get(
    "/api/admin/users",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const allUsers = await db.select({
          id: users.id,
          username: users.username,
          phone: users.phone,
          email: users.email,
          teamName: users.teamName,
          isVerified: users.isVerified,
          isAdmin: users.isAdmin,
          password: users.password
        }).from(users);
        return res.json({ users: allUsers });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/cleanup-test-users",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const realUserIds = req.body.keepUserIds;
        if (!realUserIds || realUserIds.length === 0) {
          return res.status(400).json({ message: "Provide keepUserIds array" });
        }
        const allUsersResult = await db.select({ id: users.id }).from(users);
        const toDelete = allUsersResult.filter((u) => !realUserIds.includes(u.id)).map((u) => u.id);
        let deleted = 0;
        for (const uid of toDelete) {
          await db.delete(userTeams).where(eq2(userTeams.userId, uid));
          await db.delete(users).where(eq2(users.id, uid));
          deleted++;
        }
        return res.json({ message: `Deleted ${deleted} test users`, kept: realUserIds.length });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.get(
    "/api/weekly-usage",
    isAuthenticated,
    async (req, res) => {
      try {
        const usage = await storage.getOrCreateWeeklyUsage(req.session.userId);
        const weekStart = storage.getISTWeekStart();
        const weekEnd = storage.getISTWeekEnd(weekStart);
        return res.json({
          weekStart,
          weekEnd,
          multiTeamUsageCount: usage.multiTeamUsageCount,
          multiTeamRemaining: Math.max(0, 3 - usage.multiTeamUsageCount),
          invisibleModeUsageCount: usage.invisibleModeUsageCount,
          canUseInvisibleMode: storage.canUseInvisibleMode(usage),
          canUseMultiTeam: storage.canUseMultiTeam(usage)
        });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.get(
    "/api/matches/:id/player-statuses",
    isAuthenticated,
    async (req, res) => {
      try {
        const statuses = await storage.getMatchPlayerStatuses(req.params.id);
        return res.json({ statuses });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/toggle-impact",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const { enabled } = req.body;
        if (typeof enabled !== "boolean") {
          return res.status(400).json({ message: "enabled (boolean) required" });
        }
        await storage.setImpactFeaturesEnabled(matchId, enabled);
        await storage.createAuditLog({
          adminUserId: req.session.userId,
          actionType: "toggle_impact_features",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ enabled })
        });
        return res.json({ message: `Impact features ${enabled ? "enabled" : "disabled"}` });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/player-status",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const { playerId, playerIds, adminStatus, officialImpactSubUsed } = req.body;
        const validStatuses = ["playing_xi", "impact_sub", "not_active"];
        if (adminStatus && !validStatuses.includes(adminStatus)) {
          return res.status(400).json({ message: `adminStatus must be one of: ${validStatuses.join(", ")}` });
        }
        if (playerIds && Array.isArray(playerIds)) {
          await storage.bulkSetAdminStatus(matchId, playerIds, adminStatus);
          await storage.createAuditLog({
            adminUserId: req.session.userId,
            actionType: "bulk_set_player_status",
            entityType: "player",
            matchId,
            metadata: JSON.stringify({ playerIds, adminStatus })
          });
          return res.json({ message: `Updated ${playerIds.length} players to ${adminStatus}` });
        }
        if (!playerId) {
          return res.status(400).json({ message: "playerId or playerIds required" });
        }
        const data = { matchId, playerId, sourceType: "admin" };
        if (adminStatus) data.adminStatus = adminStatus;
        if (typeof officialImpactSubUsed === "boolean") data.officialImpactSubUsed = officialImpactSubUsed;
        const status = await storage.upsertMatchPlayerStatus(data);
        await storage.createAuditLog({
          adminUserId: req.session.userId,
          actionType: officialImpactSubUsed !== void 0 ? "set_impact_sub" : "set_player_status",
          entityType: "player",
          entityId: playerId,
          matchId,
          metadata: JSON.stringify({ adminStatus, officialImpactSubUsed })
        });
        return res.json({ status });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/void",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const { isVoid } = req.body;
        if (typeof isVoid !== "boolean") {
          return res.status(400).json({ message: "isVoid (boolean) required" });
        }
        await storage.setMatchVoid(matchId, isVoid);
        if (isVoid) {
          const allTeams = await storage.getAllTeamsForMatch(matchId);
          for (const team of allTeams) {
            await storage.updateUserTeamPoints(team.id, 0);
          }
        }
        await storage.createAuditLog({
          adminUserId: req.session.userId,
          actionType: isVoid ? "void_match" : "unvoid_match",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ isVoid })
        });
        return res.json({ message: isVoid ? "Match voided, all points zeroed" : "Match un-voided" });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/admin-unlock",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const { unlock } = req.body;
        if (typeof unlock !== "boolean") {
          return res.status(400).json({ message: "unlock (boolean) required" });
        }
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (unlock) {
          const eligibility = checkUnlockEligibility(match);
          if (!eligibility.allowed) {
            return res.status(409).json({ message: eligibility.reason });
          }
        }
        await storage.updateMatch(matchId, { adminUnlockOverride: unlock });
        await storage.createAuditLog({
          adminUserId: req.session.userId,
          actionType: unlock ? "admin_unlock_match" : "admin_lock_match",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ unlock })
        });
        return res.json({ message: unlock ? "Match entry window unlocked" : "Match entry window locked" });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/revised-start-time",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const { revisedStartTime } = req.body;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (revisedStartTime !== null && revisedStartTime !== void 0) {
          const eligibility = checkUnlockEligibility(match);
          if (!eligibility.allowed) {
            return res.status(409).json({ message: eligibility.reason });
          }
          const parsed = new Date(revisedStartTime);
          if (isNaN(parsed.getTime())) {
            return res.status(400).json({ message: "Invalid date format" });
          }
          await storage.updateMatch(matchId, { revisedStartTime: parsed });
          await storage.createAuditLog({
            adminUserId: req.session.userId,
            actionType: "set_revised_start_time",
            entityType: "match",
            entityId: matchId,
            matchId,
            metadata: JSON.stringify({ revisedStartTime: parsed.toISOString() })
          });
          return res.json({ message: `Revised start time set to ${parsed.toISOString()}` });
        } else {
          await storage.updateMatch(matchId, { revisedStartTime: null });
          await storage.createAuditLog({
            adminUserId: req.session.userId,
            actionType: "clear_revised_start_time",
            entityType: "match",
            entityId: matchId,
            matchId,
            metadata: JSON.stringify({ cleared: true })
          });
          return res.json({ message: "Revised start time cleared" });
        }
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/set-winner",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const { winner } = req.body;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (winner && winner !== match.team1Short && winner !== match.team2Short) {
          return res.status(400).json({ message: "Winner must be team1Short or team2Short" });
        }
        await storage.setOfficialWinner(matchId, winner || null);
        await storage.createAuditLog({
          adminUserId: req.session.userId,
          actionType: "set_winner",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ winner })
        });
        return res.json({ message: `Official winner set to ${winner || "none"}` });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/recalculate",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const matchLabel = `${match.team1Short} vs ${match.team2Short}`;
        const recalcFn = globalThis.__recalculateTeamTotals;
        if (recalcFn) {
          await recalcFn(matchId, matchLabel);
        } else {
          return res.status(500).json({ message: "Recalculation engine not initialized" });
        }
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        if (match.officialWinner) {
          for (const team of allTeams) {
            const prediction = await storage.getUserPredictionForMatch(team.userId, matchId);
            const predPts = prediction && prediction.predictedWinner === match.officialWinner ? 50 : 0;
            await db.update(userTeams).set({ predictionPoints: predPts }).where(eq2(userTeams.id, team.id));
          }
        }
        await storage.createAuditLog({
          adminUserId: req.session.userId,
          actionType: "recalculate",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ teamsUpdated: allTeams.length, impactEnabled: match.impactFeaturesEnabled, isVoid: match.isVoid })
        });
        return res.json({ message: `Recalculated ${allTeams.length} teams`, updated: allTeams.length });
      } catch (err) {
        console.error("Recalc error:", err);
        return res.status(500).json({ message: "Recalculation failed" });
      }
    }
  );
  app2.get(
    "/api/admin/matches/:id/audit-log",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const logs = await storage.getAuditLogsForMatch(req.params.id);
        return res.json({ logs });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.get(
    "/api/admin/audit-log",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = await storage.getAllAuditLogs(limit);
        return res.json({ logs });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/lock-multi-team",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        const userTeamCounts = /* @__PURE__ */ new Map();
        for (const t of allTeams) {
          userTeamCounts.set(t.userId, (userTeamCounts.get(t.userId) || 0) + 1);
        }
        let usagesIncremented = 0;
        for (const [userId, count] of userTeamCounts) {
          if (count > 1) {
            await storage.incrementMultiTeamUsage(userId);
            usagesIncremented++;
          }
        }
        await storage.createAuditLog({
          adminUserId: req.session.userId,
          actionType: "lock_multi_team_usage",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ usersWithMultiTeams: usagesIncremented })
        });
        return res.json({ message: `Locked multi-team usage for ${usagesIncremented} users` });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
init_cricket_api();
init_storage();
init_db();
import * as fs from "fs";
import * as path from "path";
var app = express();
console.log(
  "DEPLOY_CHECK",
  process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "no-sha"
);
app.set("trust proxy", 1);
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
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
    const isRailway2 = !!railwayDomain && origin === `https://${railwayDomain}`;
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost || isRailway2)) {
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
    if (req.path.startsWith("/api")) return next();
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      if (req.path === "/" || req.path === "/manifest") {
        return serveExpoManifest(platform, res);
      }
    }
    return next();
  });
  if (hasWebBuild) {
    const expoPath = path.join(webDistPath, "_expo");
    if (fs.existsSync(expoPath)) {
      app2.use(
        "/_expo",
        express.static(expoPath, {
          setHeaders: (res, filePath) => {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            if (/\.(ttf|otf|woff|woff2)$/i.test(filePath)) {
              res.setHeader("Access-Control-Allow-Origin", "*");
            }
          }
        })
      );
    }
    const assetsPath = path.join(webDistPath, "assets");
    if (fs.existsSync(assetsPath)) {
      app2.use(
        "/assets",
        express.static(assetsPath, {
          setHeaders: (res, filePath) => {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            if (/\.(ttf|otf|woff|woff2)$/i.test(filePath)) {
              res.setHeader("Access-Control-Allow-Origin", "*");
            }
          }
        })
      );
    }
    const faviconPath = path.join(webDistPath, "favicon.ico");
    if (fs.existsSync(faviconPath)) {
      app2.get("/favicon.ico", (_req, res) => res.sendFile(faviconPath));
    }
    app2.use(
      express.static(webDistPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
          } else {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        }
      })
    );
  }
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (path.extname(req.path)) {
      return res.status(404).type("text/plain").send("Not Found");
    }
    if (req.method === "GET" && req.accepts("html")) {
      if (hasWebBuild) {
        const indexHtmlPath = path.join(webDistPath, "index.html");
        const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
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
    return next();
  });
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
var DB_ERROR_CODES = /* @__PURE__ */ new Set([
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ECONNRESET",
  "57P01",
  // admin_shutdown
  "57014",
  // query_canceled (statement_timeout fired)
  "08006",
  // connection_failure
  "08001"
  // sqlclient_unable_to_establish_sqlconnection
]);
function setupRequestTimeout(app2) {
  app2.use((req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`[TIMEOUT] ${req.method} ${req.path} exceeded 6000ms`);
        res.status(504).json({ error: "Request timed out. Please try again." });
      }
    }, 6e3);
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));
    next();
  });
}
function isDbError(err) {
  const e = err;
  if (!e) return false;
  if (e.code && DB_ERROR_CODES.has(e.code)) return true;
  const msg = e.message || "";
  return msg.includes("ETIMEDOUT") || msg.includes("ECONNREFUSED") || msg.includes("connection") || msg.includes("database");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    if (isDbError(err)) {
      console.error("[DB] Runtime DB error on request:", err.message);
      if (res.headersSent) return next(err);
      return res.status(503).json({ error: "Database temporarily unavailable. Please try again." });
    }
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
  setupRequestTimeout(app);
  const server = await registerRoutes(app);
  configureExpoAndLanding(app);
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
  const port = Number(process.env.PORT) || 3e3;
  server.listen(port, "0.0.0.0", () => {
    log(`express server listening on port ${port}`);
  });
  await connectWithRetry(10, 3e3);
  markServerReady();
  log(`express server fully ready on port ${port}`);
  seedReferenceCodes().catch((err) => {
    console.error("Reference code seeding failed:", err);
  });
  const ADMIN_PHONES2 = ["9840872462", "9884334973", "7406020777"];
  (async () => {
    for (const phone of ADMIN_PHONES2) {
      try {
        const u = await storage.getUserByPhone(phone);
        if (u && !u.isAdmin) {
          await storage.setUserAdmin(u.id, true);
          log(`Auto-promoted ${u.username} (${phone}) to admin`);
        }
      } catch (e) {
      }
    }
  })();
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
  const HEARTBEAT_INTERVAL = 60 * 1e3;
  let heartbeatSyncing = false;
  let heartbeatLockTime = 0;
  const lastSquadFetchAttempt = /* @__PURE__ */ new Map();
  const SQUAD_POLL_FAR = 20 * 60 * 1e3;
  const SQUAD_POLL_CLOSE = 5 * 60 * 1e3;
  const SQUAD_MIN_PLAYERS = 22;
  function fuzzyNameMatch(name1, name2) {
    if (name1 === name2) return true;
    if (name1.includes(name2) || name2.includes(name1)) return true;
    const p1 = name1.split(" ");
    const p2 = name2.split(" ");
    if (p1.length > 0 && p2.length > 0) {
      const last1 = p1[p1.length - 1], last2 = p2[p2.length - 1];
      if (last1 === last2 && last1.length > 2 && p1[0][0] === p2[0][0])
        return true;
      if (last1.length >= 4 && last2.length >= 4) {
        const a = last1, b = last2, m = a.length, n = b.length;
        const dp = Array.from(
          { length: m + 1 },
          () => Array(n + 1).fill(0)
        );
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++)
          for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        if (dp[m][n] <= 2 && p1[0][0] === p2[0][0]) return true;
      }
      if (p1[0].substring(0, 3) === p2[0].substring(0, 3) && p1[0].length >= 3) {
        if (last1.substring(0, 3) === last2.substring(0, 3)) return true;
      }
    }
    if (name1.length >= 5 && name2.length >= 5) {
      const a = name1, b = name2, m = a.length, n = b.length;
      const dp = Array.from(
        { length: m + 1 },
        () => Array(n + 1).fill(0)
      );
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
          dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      if (dp[m][n] <= 2 && Math.max(m, n) >= 8) return true;
    }
    return false;
  }
  function resolvePlayerPoints(player, pointsMap, namePointsMap) {
    if (player.externalId && pointsMap.has(player.externalId)) {
      return {
        fantasyPts: pointsMap.get(player.externalId),
        matchMethod: "externalId"
      };
    }
    if (namePointsMap.size > 0) {
      if (player.apiName) {
        const normApiName = player.apiName.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
        if (namePointsMap.has(normApiName)) {
          return {
            fantasyPts: namePointsMap.get(normApiName),
            matchMethod: `apiName(${player.apiName})`
          };
        }
      }
      if (player.name) {
        const normName = player.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
        if (namePointsMap.has(normName)) {
          return {
            fantasyPts: namePointsMap.get(normName),
            matchMethod: "exactName"
          };
        }
        for (const [apiName, apiPts] of namePointsMap) {
          if (fuzzyNameMatch(apiName, normName)) {
            return { fantasyPts: apiPts, matchMethod: `fuzzy(${apiName})` };
          }
        }
      }
    }
    return { fantasyPts: void 0, matchMethod: "none" };
  }
  async function updateLiveScore(match) {
    const empty = {
      pointsMap: /* @__PURE__ */ new Map(),
      namePointsMap: /* @__PURE__ */ new Map(),
      scoreString: "",
      matchEnded: false,
      totalOvers: 0,
      source: ""
    };
    if (!match.externalId) return empty;
    try {
      const { fetchMatchScorecardWithScore: fetchMatchScorecardWithScore2, fetchMatchInfo: fetchMatchInfo2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
      const result = await fetchMatchScorecardWithScore2(match.externalId);
      const source = result.pointsMap.size > 0 || result.scoreString ? "CricAPI" : "";
      log(
        `[Heartbeat:Score] ${match.team1Short} vs ${match.team2Short}: ${result.pointsMap.size} players in scorecard, score="${result.scoreString.substring(0, 80)}", ended=${result.matchEnded}, overs=${result.totalOvers}`
      );
      try {
        const matchInfo = await fetchMatchInfo2(match.externalId);
        if (matchInfo && matchInfo.score && Array.isArray(matchInfo.score) && matchInfo.score.length > 0) {
          const infoScoreArr = matchInfo.score;
          const infoScoreString = infoScoreArr.map(
            (s) => `${s?.inning ?? "?"}: ${s?.r ?? 0}/${s?.w ?? 0} (${s?.o ?? 0} ov)`
          ).join(" | ");
          const infoTotalOvers = infoScoreArr.reduce(
            (sum, s) => sum + (s?.o || 0),
            0
          );
          const infoStatus = (matchInfo.name || matchInfo.status || "").toLowerCase();
          const infoEnded = infoStatus.includes("won") || infoStatus.includes("draw") || infoStatus.includes("tied") || infoStatus.includes("finished") || infoStatus.includes("beat") || infoStatus.includes("defeat") || infoStatus.includes("result") || infoStatus.includes("aban") || matchInfo.matchEnded === true;
          if (infoTotalOvers > result.totalOvers) {
            log(
              `[Heartbeat:LiveScore] ${match.team1Short} vs ${match.team2Short}: match_info has fresher score ${infoTotalOvers} ov vs scorecard ${result.totalOvers} ov`
            );
            const statusText = matchInfo.name || matchInfo.status || "";
            result.scoreString = statusText ? `${infoScoreString} \u2014 ${statusText}` : infoScoreString;
            result.totalOvers = infoTotalOvers;
          }
          if (infoEnded && !result.matchEnded) {
            log(
              `[Heartbeat:LiveScore] ${match.team1Short} vs ${match.team2Short}: match_info says ended`
            );
            result.matchEnded = true;
          }
        }
      } catch (infoErr) {
        log(
          `[Heartbeat:LiveScore] match_info fallback failed for ${match.team1Short} vs ${match.team2Short}: ${infoErr}`
        );
      }
      return { ...result, source };
    } catch (err) {
      console.error(
        `[Heartbeat:Score] FAILED for ${match.team1Short} vs ${match.team2Short}:`,
        err
      );
      return empty;
    }
  }
  async function updateFantasyPoints(matchId, matchLabel, pointsMap, namePointsMap) {
    const matchPlayers = await storage.getPlayersForMatch(matchId);
    const playerUpdates = [];
    let mapped = 0;
    let unmapped = 0;
    let skippedProtected = 0;
    for (const player of matchPlayers) {
      try {
        let resolveResult;
        try {
          resolveResult = resolvePlayerPoints(
            player,
            pointsMap,
            namePointsMap
          );
        } catch (resolveErr) {
          console.error(
            `[Heartbeat:Points] resolvePlayerPoints THREW for "${player.name}" (${player.id}):`,
            resolveErr
          );
          continue;
        }
        const { fantasyPts, matchMethod } = resolveResult;
        const existingPts = player.points || 0;
        const appearedOnScorecard = fantasyPts !== void 0 && fantasyPts !== null;
        const xiBase = player.isPlayingXI || appearedOnScorecard ? 4 : 0;
        let finalPts;
        if (appearedOnScorecard) {
          finalPts = fantasyPts + xiBase;
          mapped++;
          if (finalPts < existingPts) {
            log(
              `[Heartbeat:Points] PROTECTED: "${player.name}" scorecard would DROP ${existingPts} -> ${finalPts} \u2014 keeping existing`
            );
            skippedProtected++;
            continue;
          }
          if (matchMethod.startsWith("fuzzy") || matchMethod.startsWith("apiName")) {
            log(
              `[Heartbeat:Points] Match: "${player.name}" -> ${matchMethod} = ${fantasyPts} scorecard + ${xiBase} XI base = ${finalPts}`
            );
          }
        } else if (player.isPlayingXI) {
          finalPts = Math.max(xiBase, existingPts);
          unmapped++;
          if (finalPts <= existingPts) {
            continue;
          }
        } else {
          continue;
        }
        if (finalPts !== existingPts) {
          playerUpdates.push({
            id: player.id,
            name: player.name,
            oldPoints: existingPts,
            newPoints: finalPts,
            method: matchMethod
          });
        }
      } catch (err) {
        console.error(
          `[Heartbeat:Points] OUTER CATCH for player "${player.name}" (${player.id}):`,
          err
        );
        continue;
      }
    }
    if (playerUpdates.length > 0) {
      for (const upd of playerUpdates) {
        try {
          await storage.updatePlayer(upd.id, { points: upd.newPoints });
        } catch (dbErr) {
          console.error(
            `[Heartbeat:Points] DB WRITE FAILED for "${upd.name}" (${upd.id}):`,
            dbErr
          );
        }
      }
      log(
        `[Heartbeat:Points] ${matchLabel}: ${playerUpdates.length} players updated (${mapped} mapped, ${unmapped} unmapped/XI-only, ${skippedProtected} protected from crash)`
      );
      if (playerUpdates.length <= 10) {
        for (const u of playerUpdates) {
          log(
            `  -> ${u.name}: ${u.oldPoints} -> ${u.newPoints} (${u.method})`
          );
        }
      }
    }
    return playerUpdates.length;
  }
  async function recalculateTeamTotals(matchId, matchLabel) {
    const match = await storage.getMatch(matchId);
    if (!match) return;
    if (match.isVoid) {
      const allTeams2 = await storage.getAllTeamsForMatch(matchId);
      for (const team of allTeams2) {
        if ((team.totalPoints || 0) !== 0) {
          await storage.updateUserTeamPoints(team.id, 0);
        }
      }
      log(`[Heartbeat:Teams] ${matchLabel}: Match is VOID \u2014 all points zeroed`);
      return;
    }
    const updatedPlayers = await storage.getPlayersForMatch(matchId);
    const playerById = new Map(updatedPlayers.map((p) => [p.id, p]));
    const playerByExtId = new Map(
      updatedPlayers.filter((p) => p.externalId).map((p) => [p.externalId, p])
    );
    const allTeams = await storage.getAllTeamsForMatch(matchId);
    const impactEnabled = match.impactFeaturesEnabled === true;
    const teamUpdates = [];
    for (const team of allTeams) {
      try {
        const teamPlayerIds = team.playerIds;
        let totalPoints = 0;
        for (const pid of teamPlayerIds) {
          try {
            const p = playerById.get(pid) || playerByExtId.get(pid);
            if (!p) continue;
            let basePts = p.points || 0;
            let multiplier = 1;
            if (pid === team.captainId && (!team.captainType || team.captainType === "player")) {
              multiplier = 2;
            } else if (pid === team.viceCaptainId && (!team.vcType || team.vcType === "player")) {
              multiplier = 1.5;
            }
            const finalPts = Math.round(basePts * multiplier);
            totalPoints += finalPts;
          } catch (playerErr) {
            console.error(
              `[Heartbeat:Teams] FAILED resolving player ${pid} in team ${team.id}:`,
              playerErr
            );
            continue;
          }
        }
        if (impactEnabled) {
          try {
            const resolved = await storage.resolveImpactSlot(matchId, team.primaryImpactId, team.backupImpactId);
            if (resolved.activePlayerId) {
              const impactPlayer = playerById.get(resolved.activePlayerId) || playerByExtId.get(resolved.activePlayerId);
              if (impactPlayer) {
                let impactPts = (impactPlayer.points || 0) + 4;
                let impactMultiplier = 1;
                if (team.captainType === "impact_slot") impactMultiplier = 2;
                else if (team.vcType === "impact_slot") impactMultiplier = 1.5;
                totalPoints += Math.round(impactPts * impactMultiplier);
              }
            }
          } catch (impactErr) {
            console.error(`[Heartbeat:Teams] Impact slot error for team ${team.id}:`, impactErr);
          }
        }
        if (match.officialWinner) {
          try {
            const prediction = await storage.getUserPredictionForMatch(team.userId, matchId);
            if (prediction && prediction.predictedWinner === match.officialWinner) {
              totalPoints += 50;
            }
          } catch (predErr) {
            console.error(`[Heartbeat:Teams] Prediction bonus error for team ${team.id}:`, predErr);
          }
        }
        if (totalPoints !== (team.totalPoints || 0)) {
          teamUpdates.push({
            teamId: team.id,
            teamName: team.name || "unnamed",
            oldTotal: team.totalPoints || 0,
            newTotal: totalPoints
          });
        }
      } catch (err) {
        console.error(
          `[Heartbeat:Teams] OUTER CATCH for team ${team.id}:`,
          err
        );
        continue;
      }
    }
    if (teamUpdates.length > 0) {
      for (const upd of teamUpdates) {
        try {
          await storage.updateUserTeamPoints(upd.teamId, upd.newTotal);
        } catch (dbErr) {
          console.error(
            `[Heartbeat:Teams] DB WRITE FAILED for team ${upd.teamId}:`,
            dbErr
          );
        }
      }
      log(
        `[Heartbeat:Teams] ${matchLabel}: ${teamUpdates.length} teams recalculated \u2014 ${teamUpdates.map((t) => `${t.teamName}: ${t.oldTotal}->${t.newTotal}`).join(", ")}`
      );
    }
  }
  function extractTotalOversFromScoreString(scoreStr) {
    if (!scoreStr) return 0;
    const matches2 = scoreStr.match(/\((\d+(?:\.\d+)?)\s*ov\)/g);
    if (!matches2) return 0;
    return matches2.reduce((sum, m) => {
      const num = parseFloat(m.replace(/[^0-9.]/g, ""));
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }
  async function matchHeartbeat(forcedMatchId) {
    if (heartbeatSyncing && !forcedMatchId) {
      const lockAge = Date.now() - heartbeatLockTime;
      if (lockAge < 6e4) {
        log("[Heartbeat] SKIPPED: previous sync still in progress");
        return;
      }
      log(
        `[Heartbeat] FORCE UNLOCK: lock held for ${Math.round(lockAge / 1e3)}s \u2014 resetting stale lock`
      );
      heartbeatSyncing = false;
    }
    heartbeatSyncing = true;
    heartbeatLockTime = Date.now();
    try {
      const allMatches = await storage.getAllMatches();
      const now = Date.now();
      const liveMatches = allMatches.filter(
        (m) => m.status === "live" || m.status === "delayed" || m.startTime && new Date(m.startTime).getTime() < now && m.status !== "completed"
      );
      log(`[Heartbeat] polling ${liveMatches.length} active matches (${allMatches.length} total in DB)`);
      for (const match of allMatches) {
        if (forcedMatchId && match.id !== forcedMatchId) continue;
        const startMs = match.startTime ? new Date(match.startTime).getTime() : 0;
        const revisedMs = match.revisedStartTime ? new Date(match.revisedStartTime).getTime() : 0;
        const effectiveStartMs = revisedMs > 0 ? revisedMs : startMs;
        const isStarted = effectiveStartMs > 0 && now > effectiveStartMs && match.status !== "completed";
        const isLive = match.status === "live" || match.status === "delayed";
        if (isStarted && !isLive) {
          log(
            `[Heartbeat] LOCKOUT: ${match.team1Short} vs ${match.team2Short} -> status=live (was ${match.status}, started ${Math.round((now - startMs) / 6e4)}m ago)`
          );
          await storage.updateMatch(match.id, { status: "live" });
          try {
            const matchPlayers = await storage.getPlayersForMatch(match.id);
            const xiPlayers = matchPlayers.filter(
              (p) => p.isPlayingXI && (!p.points || p.points < 4)
            );
            if (xiPlayers.length > 0) {
              for (const p of xiPlayers) {
                await storage.updatePlayer(p.id, { points: 4 });
              }
              log(
                `[Heartbeat] LIVE BASE POINTS: Awarded +4 base to ${xiPlayers.length} Playing XI players for ${match.team1Short} vs ${match.team2Short}`
              );
              await recalculateTeamTotals(
                match.id,
                `${match.team1Short} vs ${match.team2Short}`
              );
            }
          } catch (baseErr) {
            console.error(
              `[Heartbeat] Failed to award base XI points on live transition:`,
              baseErr
            );
          }
        }
        if (!isLive && !isStarted && !forcedMatchId) continue;
        const matchLabel = `${match.team1Short} vs ${match.team2Short}`;
        if (!forcedMatchId) {
          const joinedTeams = await storage.getAllTeamsForMatch(match.id);
          if (joinedTeams.length === 0) {
            log(`[Heartbeat] SKIP ${matchLabel} \u2014 0 users joined, no API calls needed`);
            continue;
          }
        }
        try {
          const {
            pointsMap,
            namePointsMap,
            scoreString,
            matchEnded,
            totalOvers,
            source
          } = await updateLiveScore(match);
          const existingScoreStr = match.scoreString || "";
          const existingOvers = extractTotalOversFromScoreString(existingScoreStr);
          const existingInningsCount = (existingScoreStr.match(/\(\d+(?:\.\d+)?\s*ov\)/g) || []).length;
          const incomingInningsCount = scoreString ? (scoreString.match(/\(\d+(?:\.\d+)?\s*ov\)/g) || []).length : 0;
          const isStaleScore = totalOvers > 0 && totalOvers < existingOvers && incomingInningsCount <= existingInningsCount;
          if (isStaleScore) {
            log(
              `[Heartbeat] STALE SCORE skipped for ${matchLabel}: incoming ${totalOvers} ov < existing ${existingOvers} ov \u2014 points still processed`
            );
          }
          if (!isStaleScore && scoreString && scoreString !== match.scoreString) {
            await storage.updateMatch(match.id, {
              scoreString,
              lastSyncAt: /* @__PURE__ */ new Date()
            });
          }
          if (matchEnded && match.status !== "completed") {
            log(`[Heartbeat] COMPLETED: ${matchLabel}`);
            await storage.updateMatch(match.id, { status: "completed" });
            try {
              const distribute = globalThis.__distributeMatchReward;
              if (distribute) await distribute(match.id);
            } catch (rewardErr) {
              console.error(
                `[Heartbeat] Reward distribution failed for ${matchLabel}:`,
                rewardErr
              );
            }
          }
          if (pointsMap.size > 0 && !match.firstScorecardAt) {
            try {
              await storage.updateMatch(match.id, { firstScorecardAt: /* @__PURE__ */ new Date() });
              log(`[Heartbeat] firstScorecardAt recorded for ${matchLabel}`);
            } catch (fse) {
              console.error(`[Heartbeat] Failed to set firstScorecardAt for ${matchLabel}:`, fse);
            }
          }
          if (pointsMap.size > 0) {
            const updatedCount = await updateFantasyPoints(
              match.id,
              matchLabel,
              pointsMap,
              namePointsMap
            );
            if (updatedCount > 0) {
              await recalculateTeamTotals(match.id, matchLabel);
            }
          } else {
            const matchPlayers = await storage.getPlayersForMatch(match.id);
            const xiPlayersWithZero = matchPlayers.filter(
              (p) => p.isPlayingXI && (p.points === 0 || p.points === null)
            );
            if (xiPlayersWithZero.length > 0) {
              log(
                `[Heartbeat:Points] ${matchLabel}: No scorecard data yet, applying +4 XI base to ${xiPlayersWithZero.length} players`
              );
              for (const p of xiPlayersWithZero) {
                await storage.updatePlayer(p.id, { points: 4 });
              }
              await recalculateTeamTotals(match.id, matchLabel);
            }
          }
          if (source) {
            log(
              `[Heartbeat] ${matchLabel} synced via ${source}${scoreString ? ` \u2014 ${scoreString.substring(0, 80)}` : ""}`
            );
          }
        } catch (err) {
          console.error(`[Heartbeat] sync FAILED for ${matchLabel}:`, err);
        }
      }
      try {
        const { fetchMatchSquad: fetchMatchSquad2, fetchSeriesSquad: fetchSeriesSquad2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
        const squadCandidates = allMatches.filter(
          (m) => m.externalId && m.status === "upcoming" && m.startTime
        );
        for (const match of squadCandidates) {
          const startMs = new Date(match.startTime).getTime();
          const minsToStart = (startMs - now) / 6e4;
          if (minsToStart > 48 * 60) continue;
          const existingPlayers = await storage.getPlayersForMatch(match.id);
          if (existingPlayers.length >= SQUAD_MIN_PLAYERS) continue;
          const pollInterval = minsToStart > 60 ? SQUAD_POLL_FAR : SQUAD_POLL_CLOSE;
          const lastAttempt = lastSquadFetchAttempt.get(match.id) ?? 0;
          if (now - lastAttempt < pollInterval) continue;
          lastSquadFetchAttempt.set(match.id, now);
          const label = `${match.team1Short} vs ${match.team2Short}`;
          const windowTag = minsToStart > 60 ? "48h\u201360min window" : "final 60min window";
          log(`[Heartbeat:Squad] Fetching squad for ${label} (${Math.round(minsToStart)}min to start, ${windowTag})`);
          try {
            let squad = await fetchMatchSquad2(match.externalId);
            let squadSource = "match_squad";
            if (squad.length === 0 && match.seriesId) {
              const seriesPlayers = await fetchSeriesSquad2(match.seriesId);
              const t1 = match.team1.toLowerCase();
              const t2 = match.team2.toLowerCase();
              const t1s = (match.team1Short || "").toLowerCase();
              const t2s = (match.team2Short || "").toLowerCase();
              squad = seriesPlayers.filter((p) => {
                const pTeam = p.team.toLowerCase();
                const pShort = p.teamShort.toLowerCase();
                return pTeam === t1 || pTeam === t2 || pTeam.includes(t1) || t1.includes(pTeam) || pTeam.includes(t2) || t2.includes(pTeam) || pShort === t1s || pShort === t2s;
              });
              squadSource = "series_squad";
            }
            if (squad.length > 0) {
              await storage.upsertPlayersForMatch(
                match.id,
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
              log(`[Heartbeat:Squad] Loaded ${squad.length} players for ${label} via ${squadSource}`);
            } else {
              log(`[Heartbeat:Squad] No squad yet for ${label} \u2014 will retry in ${minsToStart > 60 ? "20min" : "5min"}`);
            }
          } catch (squadErr) {
          }
        }
      } catch (squadErr) {
      }
    } catch (err) {
      console.error("[Heartbeat] scheduler error:", err);
    } finally {
      heartbeatSyncing = false;
    }
  }
  globalThis.__matchHeartbeat = matchHeartbeat;
  globalThis.__recalculateTeamTotals = recalculateTeamTotals;
  setInterval(matchHeartbeat, HEARTBEAT_INTERVAL);
  log(
    "Match Heartbeat started (every 60s \u2014 score sync, points, lockout, stale-data rejection)"
  );
})();
