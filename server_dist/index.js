var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
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
  pushTokens: () => pushTokens,
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
var users, referenceCodes, matches, players, userTeams, codeVerifications, matchPredictions, rewards, tournamentLedger, apiCallLog, matchPlayerStatus, userWeeklyUsage, adminAuditLog, insertUserSchema, insertReferenceCodeSchema, insertMatchSchema, insertPlayerSchema, insertUserTeamSchema, pushTokens;
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
      unlockedAt: timestamp("unlocked_at"),
      // Tournament Pot penalty mode fields
      potMode: varchar("pot_mode", { length: 30 }).notNull().default("entries_only"),
      potPenaltyUserIds: jsonb("pot_penalty_user_ids").$type().notNull().default([]),
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
      captainId: varchar("captain_id"),
      viceCaptainId: varchar("vice_captain_id"),
      totalPoints: integer("total_points").notNull().default(0),
      primaryImpactId: varchar("primary_impact_id"),
      backupImpactId: varchar("backup_impact_id"),
      captainType: varchar("captain_type", { length: 20 }).notNull().default("player"),
      vcType: varchar("vc_type", { length: 20 }).notNull().default("player"),
      invisibleMode: boolean("invisible_mode").notNull().default(false),
      predictionPoints: integer("prediction_points").notNull().default(0),
      // XI Backup system: up to 2 global priority backups replacing absent main XI picks
      backupXiPlayer1Id: varchar("backup_xi_player_1_id"),
      backupXiPlayer2Id: varchar("backup_xi_player_2_id"),
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
      captainId: z.string().nullable().optional(),
      viceCaptainId: z.string().nullable().optional(),
      primaryImpactId: z.string().optional(),
      backupImpactId: z.string().optional(),
      captainType: z.enum(["player", "impact_slot"]).default("player"),
      vcType: z.enum(["player", "impact_slot"]).default("player"),
      invisibleMode: z.boolean().default(false),
      backupXiPlayer1Id: z.string().nullable().optional(),
      backupXiPlayer2Id: z.string().nullable().optional()
    });
    pushTokens = pgTable("push_tokens", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      token: text("token").notNull().unique(),
      createdAt: timestamp("created_at").defaultNow()
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
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS series_id VARCHAR;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS team1_color VARCHAR(10) NOT NULL DEFAULT '#333';
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS team2_color VARCHAR(10) NOT NULL DEFAULT '#666';
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_name TEXT;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS entry_stake INTEGER NOT NULL DEFAULT 30;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS pot_processed BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS official_winner VARCHAR(10);
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_void BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS impact_features_enabled BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS revised_start_time TIMESTAMP;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS admin_unlock_override BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS first_scorecard_at TIMESTAMP;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS pot_mode VARCHAR(30) NOT NULL DEFAULT 'entries_only';
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS pot_penalty_user_ids JSONB NOT NULL DEFAULT '[]';
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS api_name TEXT;
    `);
    await client.query(`
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS primary_impact_id VARCHAR;
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS backup_impact_id VARCHAR;
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS captain_type VARCHAR(20) NOT NULL DEFAULT 'player';
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS vc_type VARCHAR(20) NOT NULL DEFAULT 'player';
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS invisible_mode BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS prediction_points INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS backup_xi_player_1_id VARCHAR;
      ALTER TABLE user_teams ADD COLUMN IF NOT EXISTS backup_xi_player_2_id VARCHAR;
    `);
    await client.query(`
      ALTER TABLE user_teams ALTER COLUMN captain_id DROP NOT NULL;
      ALTER TABLE user_teams ALTER COLUMN vice_captain_id DROP NOT NULL;
    `);
    await client.query(`
      ALTER TABLE match_player_status ADD COLUMN IF NOT EXISTS id VARCHAR DEFAULT gen_random_uuid();
      ALTER TABLE match_player_status ADD COLUMN IF NOT EXISTS official_impact_sub_used BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE match_player_status ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'admin';
      UPDATE match_player_status SET id = gen_random_uuid() WHERE id IS NULL;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS player_match_history (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        cricsheet_match_id TEXT NOT NULL,
        season TEXT NOT NULL,
        match_date DATE NOT NULL,
        team TEXT NOT NULL,
        opponent TEXT NOT NULL,
        player_name TEXT NOT NULL,
        role TEXT,
        batting_position INTEGER,
        runs INTEGER NOT NULL DEFAULT 0,
        balls_faced INTEGER NOT NULL DEFAULT 0,
        fours INTEGER NOT NULL DEFAULT 0,
        sixes INTEGER NOT NULL DEFAULT 0,
        powerplay_runs INTEGER NOT NULL DEFAULT 0,
        powerplay_balls INTEGER NOT NULL DEFAULT 0,
        middle_runs INTEGER NOT NULL DEFAULT 0,
        middle_balls INTEGER NOT NULL DEFAULT 0,
        death_runs INTEGER NOT NULL DEFAULT 0,
        death_balls INTEGER NOT NULL DEFAULT 0,
        wickets INTEGER NOT NULL DEFAULT 0,
        overs_bowled FLOAT NOT NULL DEFAULT 0,
        runs_conceded INTEGER NOT NULL DEFAULT 0,
        maidens INTEGER NOT NULL DEFAULT 0,
        dot_balls INTEGER NOT NULL DEFAULT 0,
        powerplay_wickets INTEGER NOT NULL DEFAULT 0,
        death_wickets INTEGER NOT NULL DEFAULT 0,
        catches INTEGER NOT NULL DEFAULT 0,
        stumpings INTEGER NOT NULL DEFAULT 0,
        run_outs_direct INTEGER NOT NULL DEFAULT 0,
        run_outs_indirect INTEGER NOT NULL DEFAULT 0,
        is_out BOOLEAN NOT NULL DEFAULT false,
        dismissal_type TEXT,
        lbw_or_bowled_wickets INTEGER NOT NULL DEFAULT 0,
        cdo_points INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(cricsheet_match_id, player_name, team)
      );

      CREATE TABLE IF NOT EXISTS player_historical_stats (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        player_name TEXT NOT NULL,
        team TEXT NOT NULL,
        matches_played INTEGER NOT NULL DEFAULT 0,
        total_cdo_points INTEGER NOT NULL DEFAULT 0,
        avg_cdo_points FLOAT NOT NULL DEFAULT 0,
        avg_powerplay_runs FLOAT NOT NULL DEFAULT 0,
        avg_middle_runs FLOAT NOT NULL DEFAULT 0,
        avg_death_runs FLOAT NOT NULL DEFAULT 0,
        avg_powerplay_wickets FLOAT NOT NULL DEFAULT 0,
        avg_death_wickets FLOAT NOT NULL DEFAULT 0,
        typical_batting_position FLOAT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(player_name, team)
      );
    `);
    await client.query(`
      ALTER TABLE player_historical_stats
        ADD COLUMN IF NOT EXISTS batting_position_certainty FLOAT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS bowling_quota_certainty FLOAT NOT NULL DEFAULT 0;

      CREATE INDEX IF NOT EXISTS idx_player_historical_stats_name
        ON player_historical_stats(player_name);

      CREATE INDEX IF NOT EXISTS idx_player_match_history_name_season
        ON player_match_history(player_name, season);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS player_name_mappings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        db_name TEXT NOT NULL,
        cricsheet_name TEXT NOT NULL,
        team_short VARCHAR(10),
        confidence TEXT NOT NULL DEFAULT 'auto',
        source TEXT NOT NULL DEFAULT 'auto',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(db_name, team_short)
      );
      CREATE INDEX IF NOT EXISTS idx_player_name_mappings_db_name
        ON player_name_mappings(db_name);
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
      /** Move all user_teams rows from one match to another. Used by mergeMatchDuplicates. */
      async migrateTeamsToMatch(fromMatchId, toMatchId) {
        const result = await db.update(userTeams).set({ matchId: toMatchId }).where(eq(userTeams.matchId, fromMatchId));
        return result.rowCount ?? 0;
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
        if (data.backupXiPlayer1Id !== void 0) updateData.backupXiPlayer1Id = data.backupXiPlayer1Id;
        if (data.backupXiPlayer2Id !== void 0) updateData.backupXiPlayer2Id = data.backupXiPlayer2Id;
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
          await db.update(players).set({ isPlayingXI: true, isImpactPlayer: false, points: 4 }).where(and(eq(players.matchId, matchId), eq(players.id, pid)));
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
          matchesPlayed: sql2`COUNT(DISTINCT CASE WHEN ${matches.status} = 'completed' THEN ${userTeams.matchId} END)`.as("matches_played"),
          teamsCreated: sql2`COUNT(${userTeams.id})`.as("teams_created")
        }).from(users).leftJoin(userTeams, eq(users.id, userTeams.userId)).leftJoin(matches, eq(userTeams.matchId, matches.id)).where(eq(users.isVerified, true)).groupBy(users.id, users.username, users.teamName).orderBy(desc(sql2`total_points_sum`));
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
      async deleteLedgerEntriesForMatch(matchId) {
        await db.delete(tournamentLedger).where(eq(tournamentLedger.matchId, matchId));
      }
      async getDistinctTournamentNames() {
        const rows = await db.selectDistinct({ name: matches.tournamentName }).from(matches).where(
          and(
            sql2`${matches.tournamentName} IS NOT NULL`,
            sql2`LOWER(${matches.tournamentName}) LIKE '%ipl%'`
          )
        );
        return rows.map((r) => r.name).filter(Boolean);
      }
      async getTournamentStandings(tName) {
        const ledgerResult = await db.select({
          userId: tournamentLedger.userId,
          userName: tournamentLedger.userName,
          totalPoints: sql2`SUM(${tournamentLedger.pointsChange})`.as("total_points")
        }).from(tournamentLedger).where(eq(tournamentLedger.tournamentName, tName)).groupBy(tournamentLedger.userId, tournamentLedger.userName).orderBy(desc(sql2`total_points`));
        const matchCounts = await db.select({
          userId: userTeams.userId,
          matchCount: sql2`COUNT(DISTINCT CASE WHEN ${matches.status} = 'completed' THEN ${userTeams.matchId} END)`
        }).from(userTeams).leftJoin(matches, eq(userTeams.matchId, matches.id)).where(eq(matches.tournamentName, tName)).groupBy(userTeams.userId);
        const matchCountMap = new Map(matchCounts.map((r) => [r.userId, Number(r.matchCount)]));
        const teamPlayers = await db.select({
          userId: users.id,
          teamName: users.teamName,
          username: users.username
        }).from(userTeams).innerJoin(matches, and(eq(matches.id, userTeams.matchId), eq(matches.tournamentName, tName))).innerJoin(users, and(eq(users.id, userTeams.userId), eq(users.isVerified, true))).groupBy(users.id, users.teamName, users.username);
        const ledgerUserIds = new Set(ledgerResult.map((r) => r.userId));
        const combined = ledgerResult.map((r) => ({
          userId: r.userId,
          userName: r.userName,
          totalPoints: Number(r.totalPoints),
          matchCount: matchCountMap.get(r.userId) ?? 0
        }));
        for (const tp of teamPlayers) {
          if (!ledgerUserIds.has(tp.userId)) {
            combined.push({ userId: tp.userId, userName: tp.teamName || tp.username, totalPoints: 0, matchCount: matchCountMap.get(tp.userId) ?? 0 });
          }
        }
        return combined.sort((a, b) => b.totalPoints - a.totalPoints);
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
          const [updated] = await db.update(matchPlayerStatus).set(updateData).where(and(eq(matchPlayerStatus.matchId, existing.matchId), eq(matchPlayerStatus.playerId, existing.playerId))).returning();
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
      async savePushToken(userId, token) {
        await db.insert(pushTokens).values({ userId, token }).onConflictDoNothing();
      }
      async getPushTokensForIPLUsers() {
        try {
          const result = await db.selectDistinct({ token: pushTokens.token }).from(pushTokens);
          return result.map((r) => r.token);
        } catch (e) {
          console.error("[FCM] getPushTokensForIPLUsers failed:", e);
          return [];
        }
      }
      async deletePushToken(token) {
        await db.delete(pushTokens).where(eq(pushTokens.token, token));
      }
    };
    storage = new DatabaseStorage();
  }
});

// server/cricket-api.ts
var cricket_api_exports = {};
__export(cricket_api_exports, {
  ensureIPLPreviewMatches: () => ensureIPLPreviewMatches,
  fetchCFLLScoreHeader: () => fetchCFLLScoreHeader,
  fetchCFLLScorecard: () => fetchCFLLScorecard,
  fetchCrexScorecard: () => fetchCrexScorecard,
  fetchCricbuzzLiveScorecard: () => fetchCricbuzzLiveScorecard,
  fetchCricbuzzScorecard: () => fetchCricbuzzScorecard,
  fetchLiveScorecard: () => fetchLiveScorecard,
  fetchMatchInfo: () => fetchMatchInfo,
  fetchMatchScorecard: () => fetchMatchScorecard,
  fetchMatchScorecardWithScore: () => fetchMatchScorecardWithScore,
  fetchMatchSquad: () => fetchMatchSquad,
  fetchPlayingXI: () => fetchPlayingXI,
  fetchPlayingXIFromMatchInfo: () => fetchPlayingXIFromMatchInfo,
  fetchPlayingXIFromScorecard: () => fetchPlayingXIFromScorecard,
  fetchSeriesList: () => fetchSeriesList,
  fetchSeriesMatches: () => fetchSeriesMatches,
  fetchSeriesSquad: () => fetchSeriesSquad,
  fetchUpcomingMatches: () => fetchUpcomingMatches,
  getInMemoryApiCallCount: () => getInMemoryApiCallCount,
  mergeMatchDuplicates: () => mergeMatchDuplicates,
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
    if (isMatchDelayed(apiStatusText)) {
      return { status: "delayed", statusNote };
    }
    if (hasScoreData) {
      return { status: "live", statusNote };
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
  if (KNOWN_TEAM_CODES[fullName]) return KNOWN_TEAM_CODES[fullName];
  const words = fullName.split(" ");
  if (words.length === 1) return fullName.substring(0, 3).toUpperCase();
  return words.map((w) => w[0]).join("").toUpperCase().substring(0, 4);
}
function resolveTeamShort(teamName, apiShortname) {
  if (KNOWN_TEAM_CODES[teamName]) return KNOWN_TEAM_CODES[teamName];
  return apiShortname || getTeamShort(teamName);
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
      const team1Short = resolveTeamShort(team1, team1Info?.shortname);
      const team2Short = resolveTeamShort(team2, team2Info?.shortname);
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
async function fetchSeriesList() {
  const apiKey = getActiveApiKey();
  if (!apiKey) return [];
  const results = [];
  const seen = /* @__PURE__ */ new Set();
  for (const offset of [0, 25]) {
    try {
      const url = `${CRICKET_API_BASE}/series?apikey=${apiKey}&offset=${offset}`;
      const res = await trackedFetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      if (json.status !== "success" || !json.data) {
        const reason = (json.reason || "").toLowerCase();
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
      console.warn(`Series Info API non-success for ${seriesName}: status=${json.status} reason="${reason}"`);
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
      const team1Short = resolveTeamShort(team1, team1Info?.shortname);
      const team2Short = resolveTeamShort(team2, team2Info?.shortname);
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
function buildIPLFixturesFromHardcoded() {
  return IPL_2026_HARDCODED.map((f) => ({
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
    status: "upcoming",
    statusNote: "",
    league: "Indian Premier League 2026"
  }));
}
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
    _iplPreviewCache = { data, expiresAt: Date.now() + IPL_PREVIEW_TTL_MS };
    return data;
  }
  console.log("[IPL Preview] API returned 0 fixtures \u2014 using hardcoded IPL 2026 fallback");
  const fallback = buildIPLFixturesFromHardcoded();
  _iplPreviewCache = { data: fallback, expiresAt: Date.now() + 2 * 60 * 1e3 };
  return fallback;
}
async function ensureIPLPreviewMatches(existingMatches) {
  const nowMs = Date.now();
  let seriesMatches;
  try {
    seriesMatches = await getCachedIPLSeriesMatches();
  } catch (e) {
    console.error("IPL preview: series fetch failed", e);
    return [];
  }
  const next5 = seriesMatches.filter((m) => new Date(m.startTime).getTime() > nowMs && m.status === "upcoming").sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).slice(0, 5);
  if (next5.length === 0) return [];
  const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  const newMatches = [];
  for (const m of next5) {
    if (existingMatches.some((e) => e.externalId === m.externalId)) continue;
    const mDay = new Date(m.startTime).toISOString().split("T")[0];
    const sameTeamDay = existingMatches.find((e) => {
      const eDay = new Date(e.startTime).toISOString().split("T")[0];
      if (eDay !== mDay) return false;
      return e.team1Short === m.team1Short && e.team2Short === m.team2Short || e.team1Short === m.team2Short && e.team2Short === m.team1Short;
    });
    if (sameTeamDay) {
      if (sameTeamDay.externalId !== m.externalId) {
        console.log(`IPL preview: externalId drift for ${m.team1} vs ${m.team2} (${mDay}) \u2014 updating ${sameTeamDay.externalId} \u2192 ${m.externalId}`);
        await storage2.updateMatch(sameTeamDay.id, { externalId: m.externalId });
      }
      continue;
    }
    try {
      const created = await storage2.createMatch({
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
      console.log(`IPL preview: auto-imported ${m.team1} vs ${m.team2} (${m.externalId})`);
      newMatches.push(created);
    } catch (e) {
      console.error(`IPL preview: failed to import ${m.externalId}`, e);
    }
  }
  return newMatches;
}
async function upsertMatches(apiMatches, existingMatches) {
  const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  let created = 0;
  let updated = 0;
  for (const m of apiMatches) {
    let dup = existingMatches.find((e) => e.externalId === m.externalId);
    if (!dup) {
      const mDay = m.startTime.toISOString().split("T")[0];
      dup = existingMatches.find((e) => {
        const eDay = new Date(e.startTime).toISOString().split("T")[0];
        if (eDay !== mDay) return false;
        return e.team1Short === m.team1Short && e.team2Short === m.team2Short || e.team1Short === m.team2Short && e.team2Short === m.team1Short;
      }) ?? null;
      if (dup) {
        console.log(`Match ${m.team1} vs ${m.team2} (${mDay}): externalId drift \u2014 updating ${dup.externalId} \u2192 ${m.externalId}`);
        await storage2.updateMatch(dup.id, { externalId: m.externalId });
        dup = { ...dup, externalId: m.externalId };
      }
    }
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
      const team1Short = resolveTeamShort(team1, team1Info?.shortname);
      const team2Short = resolveTeamShort(team2, team2Info?.shortname);
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
        const recalc = globalThis.__recalculateTeamTotals;
        if (recalc) {
          await recalc(match.id, `${match.team1Short} vs ${match.team2Short}`);
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
      if (!info) {
        console.log(`[StatusRefresh] fetchMatchInfo returned null for ${m.team1Short} vs ${m.team2Short} (${m.externalId})`);
        continue;
      }
      const hasScoreData = !!(info.score && info.score.length > 0 && info.score.some((s) => s.r > 0 || s.w > 0 || s.o > 0));
      console.log(`[StatusRefresh] ${m.team1Short} vs ${m.team2Short}: matchStarted=${info.matchStarted} matchEnded=${info.matchEnded} status="${info.status}" hasScoreData=${hasScoreData} currentDB=${m.status}`);
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
      if (newStatus === "delayed") {
        const deadlinePassed = Date.now() > new Date(m.revisedStartTime ?? m.startTime).getTime();
        const scoringNotStarted = !m.firstScorecardAt;
        if (deadlinePassed && scoringNotStarted) {
          const autoRevised = new Date(Date.now() + 2 * 60 * 60 * 1e3);
          await storage2.updateMatch(m.id, {
            revisedStartTime: autoRevised
          });
          console.log(`[Delay] Auto-extended deadline for ${m.team1Short} vs ${m.team2Short} to ${autoRevised.toISOString()}`);
        }
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
async function mergeMatchDuplicates() {
  const { storage: storage2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  const allMatches = await storage2.getAllMatches();
  const groups = /* @__PURE__ */ new Map();
  for (const m of allMatches) {
    const t1 = m.team1Short;
    const t2 = m.team2Short;
    const key = [t1, t2].sort().join("_");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  let mergeCount = 0;
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1e3;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const timeDiff = Math.abs(
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
        if (timeDiff > THREE_DAYS) continue;
        const aTeams = await storage2.getAllTeamsForMatch(a.id);
        const bTeams = await storage2.getAllTeamsForMatch(b.id);
        let primary = aTeams.length >= bTeams.length ? a : b;
        let secondary = primary === a ? b : a;
        const updates = {};
        if (secondary.externalId && secondary.externalId !== primary.externalId) {
          updates.externalId = secondary.externalId;
          console.log(
            `[MergeDup] ${a.team1Short} vs ${a.team2Short}: externalId drift \u2014 updating primary ${primary.externalId} \u2192 ${secondary.externalId}`
          );
        }
        const statusRank = { upcoming: 0, delayed: 1, live: 2, completed: 3 };
        const pRank = statusRank[primary.status] ?? 0;
        const sRank = statusRank[secondary.status] ?? 0;
        if (sRank > pRank) {
          updates.status = secondary.status;
          if (secondary.statusNote) updates.statusNote = secondary.statusNote;
        }
        if (Object.keys(updates).length > 0) {
          await storage2.updateMatch(primary.id, updates);
        }
        const secondaryTeamCount = secondary === a ? aTeams.length : bTeams.length;
        if (secondaryTeamCount > 0) {
          const moved = await storage2.migrateTeamsToMatch(
            secondary.id,
            primary.id
          );
          console.log(
            `[MergeDup] ${a.team1Short} vs ${a.team2Short}: migrated ${moved} team(s) from duplicate to primary`
          );
        }
        await storage2.deleteMatchCascade(secondary.id);
        console.log(
          `[MergeDup] ${a.team1Short} vs ${a.team2Short}: deleted duplicate ${secondary.id}` + (secondaryTeamCount > 0 ? ` (${secondaryTeamCount} teams migrated to primary)` : ` (was empty)`)
        );
        mergeCount++;
      }
    }
  }
  if (mergeCount > 0) {
    console.log(`[MergeDup] Fixed ${mergeCount} duplicate match pair(s).`);
  }
  return mergeCount;
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
          teamShort: resolveTeamShort(team.teamName, team.shortname),
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
          teamShort: resolveTeamShort(team.teamName, team.shortname),
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
      const teamShort = resolveTeamShort(teamName, team.shortname);
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
async function cricbuzzFetch(path2) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY not configured");
  const res = await fetch(`https://${CRICBUZZ_HOST}${path2}`, {
    headers: {
      "x-rapidapi-host": CRICBUZZ_HOST,
      "x-rapidapi-key": key
    }
  });
  if (!res.ok) throw new Error(`Cricbuzz HTTP ${res.status} for ${path2}`);
  return res.json();
}
async function findCricbuzzMatchId(team1Short, team2Short) {
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
        if (mt1 === t1 && mt2 === t2 || mt1 === t2 && mt2 === t1) {
          return parseInt(mi.matchId, 10);
        }
      }
    }
  }
  return null;
}
function cbOversToDecimal(overs) {
  const s = String(overs);
  const [whole, balls] = s.split(".");
  return parseInt(whole || "0", 10) + parseInt(balls || "0", 10) / 6;
}
function calcCricbuzzBattingPoints(runs, balls, fours, sixes, dismissed) {
  let pts = runs;
  pts += fours * 4;
  pts += sixes * 6;
  if (runs >= 100) pts += 16;
  else if (runs >= 75) pts += 12;
  else if (runs >= 50) pts += 8;
  else if (runs >= 25) pts += 4;
  if (runs === 0 && balls > 0 && dismissed) pts -= 2;
  if (balls >= 10) {
    const sr = runs / balls * 100;
    if (sr > 170) pts += 6;
    else if (sr > 150) pts += 4;
    else if (sr >= 130) pts += 2;
    else if (sr <= 70 && sr >= 60) pts -= 2;
    else if (sr < 60 && sr >= 50) pts -= 4;
    else if (sr < 50) pts -= 6;
  }
  return pts;
}
function calcCricbuzzBowlingPoints(wickets, maidens, economy, actualOvers, lbwBowledBonus) {
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
function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}
function addNamePoints(map, name, pts) {
  if (!name || pts === 0) return;
  const key = normalizeName(name);
  if (!key) return;
  map.set(key, (map.get(key) || 0) + pts);
}
async function fetchCricbuzzScorecard(team1Short, team2Short) {
  if (!process.env.RAPIDAPI_KEY) return null;
  try {
    const matchId = await findCricbuzzMatchId(team1Short, team2Short);
    if (!matchId) {
      console.log(
        `[Cricbuzz] No live match found for ${team1Short} vs ${team2Short}`
      );
      return null;
    }
    const namePointsMap = /* @__PURE__ */ new Map();
    const catchCountMap = /* @__PURE__ */ new Map();
    const scardBowlerKeys = /* @__PURE__ */ new Set();
    const battedOrBowledPlayers = /* @__PURE__ */ new Set();
    const scoreStringParts = [];
    let totalOvers = 0;
    let matchEnded = false;
    const scardData = await cricbuzzFetch(`/mcenter/v1/${matchId}/scard`);
    const scorecard = scardData.scorecard || [];
    console.log(`[Cricbuzz:Scard] ${team1Short} vs ${team2Short}: ${scorecard.length} innings in scard`);
    for (const inn of scorecard) {
      const batsmen = inn.batsman || [];
      const bowling = inn.bowler || inn.bowling || [];
      console.log(`[Cricbuzz:Scard] Inn ${inn.inningsid ?? inn.inningsId}: ${batsmen.length} batsmen, ${bowling.length} bowlers`);
      const lbwBowledByBowler = /* @__PURE__ */ new Map();
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
      for (const b of batsmen) {
        const name = b.name || b.nickname;
        if (!name) continue;
        const dismissed = b.outdec && b.outdec !== "batting" && b.outdec !== "not out";
        const pts = calcCricbuzzBattingPoints(
          b.runs || 0,
          b.balls || 0,
          b.fours || 0,
          b.sixes || 0,
          !!dismissed
        );
        addNamePoints(namePointsMap, name, pts);
        if ((b.balls || 0) >= 1) {
          const normBatsman = name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
          battedOrBowledPlayers.add(normBatsman);
        }
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
      if (bowling.length > 0) {
        console.log(`[Cricbuzz:Bowl:Raw] First bowler object: ${JSON.stringify(bowling[0])}`);
      }
      for (const bw of bowling) {
        const name = bw.name || bw.bowlerName || bw.nickName || bw.fullName;
        if (!name) continue;
        const actualOvers = cbOversToDecimal(bw.overs || bw.ov || bw.o || 0);
        const eco = parseFloat(String(bw.economy || bw.eco || bw.er || 0)) || 0;
        const wickets2 = bw.wickets ?? bw.w ?? bw.wkts ?? 0;
        const maidens = bw.maidens ?? bw.m ?? bw.maiden ?? 0;
        const lbwBonus = lbwBowledByBowler.get(normalizeName(name)) || 0;
        const pts = calcCricbuzzBowlingPoints(
          wickets2,
          maidens,
          eco,
          actualOvers,
          lbwBonus
        );
        console.log(`[Cricbuzz:Bowl] Inn${inn.inningsId} ${name}: ${wickets2}w ${actualOvers}ov eco=${eco} => ${pts}pts`);
        addNamePoints(namePointsMap, name, pts);
        scardBowlerKeys.add(normalizeName(name));
        if (actualOvers > 0) {
          const normBowler = name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
          battedOrBowledPlayers.add(normBowler);
        }
      }
      const runs = batsmen.reduce((s, b) => s + (b.runs || 0), 0) + (inn.extras?.total || 0);
      const wickets = batsmen.filter(
        (b) => b.outdec && b.outdec !== "batting" && b.outdec !== "not out"
      ).length;
      if (runs > 0 || wickets > 0) {
        scoreStringParts.push(
          `${inn.inningsId || "Inn"}: ${runs}/${wickets}`
        );
      }
    }
    for (const [fielder, catches] of catchCountMap.entries()) {
      const pts = catches * 8 + (catches >= 3 ? 4 : 0);
      namePointsMap.set(fielder, (namePointsMap.get(fielder) || 0) + pts);
    }
    try {
      const leanback = await cricbuzzFetch(`/mcenter/v1/${matchId}/leanback`);
      const mini = leanback.miniscore || {};
      const inningsScores = mini.inningsscores?.inningsscore || [];
      const sortedInnScores = [...inningsScores].sort(
        (a, b) => (b.overs || 0) - (a.overs || 0)
      );
      const lbScoreParts = [];
      let lbTotalOvers = 0;
      for (const is of sortedInnScores) {
        lbTotalOvers += is.overs || 0;
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
        scoreStringParts.splice(0, scoreStringParts.length, ...lbScoreParts);
      }
      const bowlerKeys = ["bowlerstriker", "bowlernonstriker"];
      for (const bk of bowlerKeys) {
        const bw = mini[bk];
        if (!bw?.name) continue;
        const name = bw.name;
        const normKey = normalizeName(name);
        const actualOvers = cbOversToDecimal(bw.overs || 0);
        const eco = parseFloat(String(bw.economy || 0)) || 0;
        const existing = namePointsMap.get(normKey) || 0;
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
      const status = (mini.status || "").toLowerCase();
      matchEnded = status.includes("won") || status.includes("draw") || status.includes("tied") || status.includes("result") || status.includes("abandoned");
    } catch (lbErr) {
      console.error("[Cricbuzz] Leanback failed:", lbErr);
    }
    const scoreString = scoreStringParts.join(" | ");
    console.log(
      `[Cricbuzz] ${team1Short} vs ${team2Short}: matchId=${matchId}, ${namePointsMap.size} players, score="${scoreString}", ended=${matchEnded}`
    );
    if (namePointsMap.size > 0) {
      const sorted = [...namePointsMap.entries()].sort((a, b) => b[1] - a[1]);
      console.log(`[Cricbuzz:Map] Points map:
${sorted.map(([n, p]) => `  ${n}: ${p}`).join("\n")}`);
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
async function fetchCricbuzzLiveScorecard(team1Short, team2Short) {
  if (!process.env.RAPIDAPI_KEY) return null;
  try {
    const matchId = await findCricbuzzMatchId(team1Short, team2Short);
    if (!matchId) return null;
    const scardData = await cricbuzzFetch(`/mcenter/v1/${matchId}/scard`);
    const scorecard = scardData.scorecard || [];
    const matchComplete = !!scardData.ismatchcomplete;
    const status = scardData.status || "";
    const score = [];
    const innings = [];
    for (const inn of scorecard) {
      const inningLabel = `${inn.batteamname || inn.batteamsname || "Team"} Innings`;
      const batsmen = inn.batsman || [];
      const bowlers = inn.bowler || inn.bowling || [];
      const extras = inn.extras || {};
      const batting = batsmen.map((b) => {
        const dismissal = b.outdec && b.outdec !== "batting" ? b.outdec : "not out";
        return {
          name: b.name || b.nickname || "",
          r: b.runs ?? 0,
          b: b.balls ?? 0,
          fours: b.fours ?? 0,
          sixes: b.sixes ?? 0,
          sr: parseFloat(String(b.strkrate ?? 0)) || 0,
          dismissal,
          fantasyPoints: 0
        };
      });
      const bowling = bowlers.map((bw) => ({
        name: bw.name || bw.nickname || "",
        o: parseFloat(String(bw.overs ?? 0)) || 0,
        m: bw.maidens ?? 0,
        r: bw.runs ?? 0,
        w: bw.wickets ?? 0,
        eco: parseFloat(String(bw.economy ?? 0)) || 0,
        fantasyPoints: 0
      }));
      const battingRunsSum = batting.reduce((s, b) => s + b.r, 0);
      const totalRuns = inn.score ?? battingRunsSum + (extras.total ?? 0);
      const totalWickets = inn.wickets ?? batsmen.filter((b) => b.outdec && b.outdec !== "batting" && b.outdec !== "not out").length;
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
          p: extras.penalty ?? 0
        },
        totals: { r: totalRuns, w: totalWickets, o: totalOvers },
        batting,
        bowling
      });
    }
    try {
      const lb = await cricbuzzFetch(`/mcenter/v1/${matchId}/leanback`);
      const mini = lb.miniscore || {};
      const currentBatTeam = mini.batsmanStriker?.batTeamName || mini.batsman?.[0]?.batTeamName || "";
      if (currentBatTeam) {
        const alreadyIn = innings.some(
          (inn) => inn.inning.toLowerCase().includes(currentBatTeam.toLowerCase())
        );
        if (!alreadyIn) {
          const liveBatsmen = Array.isArray(mini.batsman) ? mini.batsman : [mini.batsmanStriker, mini.batsmanNonStriker].filter(Boolean);
          const liveBowlers = [mini.bowlerStriker, mini.bowlerNonStriker].filter(Boolean);
          const lbBatting = liveBatsmen.map((b) => ({
            name: b.batName || b.name || "",
            r: b.runs ?? 0,
            b: b.balls ?? 0,
            fours: b.fours ?? b.no4s ?? 0,
            sixes: b.sixes ?? b.no6s ?? 0,
            sr: parseFloat(String(b.strikeRate ?? b.strkrate ?? 0)) || 0,
            dismissal: "batting",
            fantasyPoints: 0
          }));
          const lbBowling = liveBowlers.map((bw) => ({
            name: bw.bowlName || bw.name || "",
            o: parseFloat(String(bw.overs ?? 0)) || 0,
            m: bw.maidens ?? 0,
            r: bw.runs ?? 0,
            w: bw.wickets ?? 0,
            eco: parseFloat(String(bw.economy ?? 0)) || 0,
            fantasyPoints: 0
          }));
          const lbRuns = (mini.inningsscores?.inningsscore || []).find(
            (s) => (s.batteamname || "").toLowerCase().includes(currentBatTeam.toLowerCase()) || (s.batteamshortname || "").toLowerCase() === currentBatTeam.toLowerCase()
          );
          const lbScore = { r: lbRuns?.runs ?? 0, w: lbRuns?.wickets ?? 0, o: lbRuns?.overs ?? 0 };
          score.push({ r: lbScore.r, w: lbScore.w, o: lbScore.o, inning: `${currentBatTeam} Innings` });
          innings.push({
            inning: `${currentBatTeam} Innings`,
            extras: 0,
            totals: lbScore,
            batting: lbBatting,
            bowling: lbBowling
          });
        }
      }
    } catch (_lbErr) {
    }
    if (innings.length === 0) return null;
    console.log(`[Cricbuzz:LiveScorecard] ${team1Short} vs ${team2Short}: ${innings.length} innings, complete=${matchComplete}`);
    return { score, innings, status: status || `${team1Short} vs ${team2Short}` };
  } catch (err) {
    console.error(`[Cricbuzz:LiveScorecard] Failed for ${team1Short} vs ${team2Short}:`, err);
    return null;
  }
}
async function fetchCFLLPage(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12e3);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}
function parseCFLLNextData(html) {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!m) return null;
  try {
    const json = JSON.parse(m[1]);
    const postData = json.props?.pageProps?.postData;
    if (!postData) return null;
    try {
      const zlib = __require("zlib");
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
async function findCFLLMatchUrl(team1Short, team2Short) {
  const now = Date.now();
  if (!cfllScheduleCache || now - cfllScheduleCache.fetchedAt > CFLL_SCHEDULE_TTL_MS) {
    console.log("[CFLL] Refreshing IPL 2026 schedule cache");
    try {
      const html = await fetchCFLLPage(CFLL_IPL_SCHEDULE_URL);
      const data = parseCFLLNextData(html);
      if (!data) throw new Error("No NEXT_DATA from CFLL schedule page");
      const allMatches = [
        ...data.upcommingMatchData || [],
        ...data.liveMatchesData || [],
        ...data.completedMatchData || []
      ];
      const toSlug = (s) => s.toLowerCase().replace(/\s+/g, "-");
      const entries = [];
      for (const match of allMatches) {
        const t12 = (match.t1_id || match.teams?.a?.key || "").toString();
        const t22 = (match.t2_id || match.teams?.b?.key || "").toString();
        const key = (match.key || match.match_id || "").toString();
        const matchNum = toSlug(match.related_name || "");
        const format = (match.format || "t20").toLowerCase();
        if (!t12 || !t22 || !key || !matchNum) continue;
        const slug = `${t12}-vs-${t22}-${matchNum}-${format}-indian-premier-league-2026`;
        const url = `https://cricketfastliveline.in/live-score/${slug}/${key}`;
        entries.push({ team1: t12, team2: t22, url });
      }
      cfllScheduleCache = { entries, fetchedAt: now };
      console.log(`[CFLL] Cached ${entries.length} IPL 2026 match URLs`);
    } catch (e) {
      console.error("[CFLL] Schedule fetch failed:", e);
      return null;
    }
  }
  const t1 = team1Short.toLowerCase();
  const t2 = team2Short.toLowerCase();
  const entry = cfllScheduleCache.entries.find(
    (e) => e.team1 === t1 && e.team2 === t2 || e.team1 === t2 && e.team2 === t1
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
function parseCFLLScore(data) {
  const sd = data?.statesdata || {};
  const comm = data?.commentrydata || [];
  const bsn = String(sd.bsn || sd.tm1_sn || "");
  const bosn = String(sd.bosn || sd.tm2_sn || "");
  const status = String(sd.status || "");
  const result = String(sd.result || "").trim();
  const inningId = String(sd.inning_id || "1");
  const run = String(sd.run || "0");
  const wicket = String(sd.wicket || "0");
  const over = parseFloat(String(sd.over || "0"));
  const matchEnded = status === "completed" || !!result;
  const scoreParts = [];
  if (inningId === "1") {
    if (bsn && (parseInt(run) > 0 || over > 0)) {
      scoreParts.push(`${bsn}: ${run}/${wicket} (${over} ov)`);
    }
  } else {
    const inn1Entries = comm.filter((e) => String(e.inning) === "1");
    const lastInn1 = inn1Entries.length > 0 ? inn1Entries.reduce((best, e) => {
      const bo = parseFloat(String(e.over || "0"));
      const bestO = parseFloat(String(best.over || "0"));
      return bo > bestO ? e : best;
    }, inn1Entries[0]) : null;
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
  if (matchEnded && result) scoreString += ` \u2014 ${result}`;
  const totalOvers = over + (inningId === "2" ? 20 : 0);
  return { scoreString, matchEnded, totalOvers };
}
async function fetchCFLLScoreHeader(team1Short, team2Short) {
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
async function fetchCFLLScorecard(team1Short, team2Short) {
  const empty = {
    namePointsMap: /* @__PURE__ */ new Map(),
    battedOrBowledPlayers: /* @__PURE__ */ new Set(),
    scoreString: "",
    matchEnded: false,
    totalOvers: 0
  };
  try {
    const matchUrl = await findCFLLMatchUrl(team1Short, team2Short);
    if (!matchUrl) {
      console.log(`[CFLL:Scorecard] No match URL found for ${team1Short} vs ${team2Short}`);
      return empty;
    }
    const scorecardUrl = matchUrl.replace("/live-score/", "/scorecard/");
    console.log(`[CFLL:Scorecard] Fetching ${scorecardUrl}`);
    const html = await fetchCFLLPage(scorecardUrl);
    if (!html) return empty;
    const norm = (s) => s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
    const namePointsMap = /* @__PURE__ */ new Map();
    const battedOrBowledPlayers = /* @__PURE__ */ new Set();
    const catchMap = /* @__PURE__ */ new Map();
    const runOutMap = /* @__PURE__ */ new Map();
    const lbwBowledMap = /* @__PURE__ */ new Map();
    const tableRows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const row of tableRows) {
      const cells = [];
      let cellMatch;
      const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      while ((cellMatch = cellRe.exec(row)) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      }
      if (cells.length === 6 && !isNaN(parseInt(cells[1])) && !isNaN(parseInt(cells[2]))) {
        const nameAndDismissal = cells[0];
        const runs = parseInt(cells[1]) || 0;
        const balls = parseInt(cells[2]) || 0;
        const fours = parseInt(cells[3]) || 0;
        const sixes = parseInt(cells[4]) || 0;
        const nameLine = nameAndDismissal.split(/c |b |run|lbw/i)[0].trim();
        const cleanName = nameLine.replace(/\(C\)|\(wk\)|Imp/gi, "").trim();
        if (!cleanName || cleanName.length < 2) continue;
        const normName = norm(cleanName);
        const dismissalLower = nameAndDismissal.toLowerCase();
        const dismissed = balls > 0 && !dismissalLower.includes("not out") && (dismissalLower.includes(" b ") || dismissalLower.startsWith("b ") || dismissalLower.includes("c ") || dismissalLower.includes("lbw") || dismissalLower.includes("run out") || dismissalLower.includes("stumped") || dismissalLower.includes("hit wicket") || dismissalLower.includes("retired"));
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
            if (dismissalLower.includes("lbw") || dismissalLower.match(/^b\s/)) {
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
        const bowlerName = cells[0].replace(/Imp/gi, "").trim();
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
    for (const [fielder, catches] of catchMap.entries()) {
      const pts = Math.floor(catches) * 8 + (Math.floor(catches) >= 3 ? 4 : 0);
      namePointsMap.set(fielder, (namePointsMap.get(fielder) || 0) + pts);
    }
    for (const [fielder, value] of runOutMap.entries()) {
      const isAssist = value % 1 !== 0;
      const pts = isAssist ? 6 : Math.floor(value) * 12;
      namePointsMap.set(fielder, (namePointsMap.get(fielder) || 0) + pts);
    }
    let scoreString = "";
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
async function fetchCrexPage(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15e3);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}
async function findCrexMatchUrl(team1Short, team2Short) {
  const now = Date.now();
  if (!crexScheduleCache || now - crexScheduleCache.fetchedAt > CREX_SCHEDULE_TTL_MS) {
    console.log("[Crex] Refreshing IPL 2026 schedule cache");
    try {
      const html = await fetchCrexPage(CREX_IPL_SCHEDULE_URL);
      const hrefRegex = /href="(\/scoreboard\/[^"]+)"/g;
      const seen = /* @__PURE__ */ new Set();
      const entries = [];
      let m;
      while ((m = hrefRegex.exec(html)) !== null) {
        const path2 = m[1].replace(/\/(scorecard|live|info)$/, "");
        if (seen.has(path2)) continue;
        seen.add(path2);
        const slugMatch = path2.match(
          /\/([a-z]+)-vs-([a-z]+)-[a-z0-9-]+-indian-premier-league/
        );
        if (!slugMatch) continue;
        entries.push({
          team1: slugMatch[1],
          team2: slugMatch[2],
          baseUrl: `https://crex.com${path2}`
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
    (e) => e.team1 === t1 && e.team2 === t2 || e.team1 === t2 && e.team2 === t1
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
function parseCrexHtml(html) {
  const namePointsMap = /* @__PURE__ */ new Map();
  const battedOrBowledPlayers = /* @__PURE__ */ new Set();
  const lbwBowledMap = /* @__PURE__ */ new Map();
  const trSegments = html.split("</tr>");
  for (const seg of trSegments) {
    if (!seg.includes('class="batsman-name"')) continue;
    const nameMatch = seg.match(/class="player-name"[^>]*>([^<]+)</);
    if (!nameMatch) continue;
    const name = nameMatch[1].replace(/\s*\([CWKcwk]+\)\s*/g, "").trim();
    if (!name) continue;
    const decisionMatch = seg.match(/class="decision"[^>]*>\s*([^<]+?)\s*</);
    const dismissal = decisionMatch ? decisionMatch[1].trim() : "batting";
    const statNums = [
      ...seg.matchAll(/<!---->?<div[^>]*>(\d+\.?\d*)<\/div><!---->?/g)
    ].map((m) => parseFloat(m[1]));
    if (statNums.length < 4) continue;
    const [runs, balls, fours, sixes] = statNums;
    const dismissalLower = (dismissal || "").toLowerCase();
    const dismissed = balls > 0 && !dismissalLower.includes("not out") && (dismissalLower.includes(" b ") || dismissalLower.startsWith("b ") || dismissalLower.includes("c ") || dismissalLower.includes("lbw") || dismissalLower.includes("run out") || dismissalLower.includes("stumped") || dismissalLower.includes("hit wicket") || dismissalLower.includes("retired"));
    battedOrBowledPlayers.add(normalizeName(name));
    const lbwMatch = dismissal.match(/^(?:lbw\s+b|b)\s+(.+)/i);
    if (lbwMatch) {
      const bn = normalizeName(lbwMatch[1].trim());
      lbwBowledMap.set(bn, (lbwBowledMap.get(bn) || 0) + 8);
    }
    const catchMatch = dismissal.match(/^c\s+(.+?)\s+b\s+/i);
    const stumpMatch = dismissal.match(/^st\s+(.+?)\s+b\s+/i);
    const runoutMatch = dismissal.match(/run\s*out\s*[\(\[](.+?)[\)\]]/i);
    if (catchMatch) addNamePoints(namePointsMap, catchMatch[1].trim(), 8);
    else if (stumpMatch) addNamePoints(namePointsMap, stumpMatch[1].trim(), 12);
    else if (runoutMatch) addNamePoints(namePointsMap, runoutMatch[1].trim(), 6);
    const pts = calcCricbuzzBattingPoints(runs, balls, fours, sixes, dismissed);
    addNamePoints(namePointsMap, name, pts);
  }
  for (const seg of trSegments) {
    if (!seg.includes('class="bowler-name"')) continue;
    const nameMatch = seg.match(/class="player-name"[^>]*>([^<]+)</);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    if (!name) continue;
    const statNums = [
      ...seg.matchAll(/<!---->?<div[^>]*>(\d+\.?\d*)<\/div><!---->?/g)
    ].map((m) => parseFloat(m[1]));
    if (statNums.length < 5) continue;
    const [overs, maidens, , wickets, economy] = statNums;
    const actualOvers = cbOversToDecimal(String(overs));
    const lbwBonus = lbwBowledMap.get(normalizeName(name)) || 0;
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
  const scoreStringParts = [];
  let totalOvers = 0;
  const stateScriptMatch = html.match(/<script[^>]*id="app-root-state"[^>]*>([\s\S]*?)<\/script>/);
  if (stateScriptMatch) {
    const stateJson = stateScriptMatch[1].replace(/&q;/g, '"');
    const t1FkeyM = stateJson.match(/"team1_fkey"\s*:\s*"([^"]+)"/);
    const t2FkeyM = stateJson.match(/"team2_fkey"\s*:\s*"([^"]+)"/);
    const t1ShortM = stateJson.match(/"team1"\s*:\s*"([^"]+)"/);
    const t2ShortM = stateJson.match(/"team2"\s*:\s*"([^"]+)"/);
    const fkey1 = t1FkeyM ? t1FkeyM[1].toLowerCase() : "";
    const fkey2 = t2FkeyM ? t2FkeyM[1].toLowerCase() : "";
    const teamFullToShort = {
      "mumbai indians": "MI",
      "kolkata knight riders": "KKR",
      "chennai super kings": "CSK",
      "royal challengers bengaluru": "RCB",
      "royal challengers bangalore": "RCB",
      "sunrisers hyderabad": "SRH",
      "delhi capitals": "DC",
      "punjab kings": "PBKS",
      "rajasthan royals": "RR",
      "gujarat titans": "GT",
      "lucknow super giants": "LSG"
    };
    const team1Short = t1ShortM ? teamFullToShort[t1ShortM[1].toLowerCase()] || t1ShortM[1].substring(0, 4).toUpperCase() : "T1";
    const team2Short = t2ShortM ? teamFullToShort[t2ShortM[1].toLowerCase()] || t2ShortM[1].substring(0, 4).toUpperCase() : "T2";
    const inn1M = stateJson.match(new RegExp(`"${fkey2}"\\s*:\\s*"([\\d]+\\/[\\d]+\\([\\d.]+)"`));
    const inn2M = stateJson.match(new RegExp(`"${fkey1}"\\s*:\\s*"([\\d]+\\/[\\d]+\\([\\d.]+)"`));
    const jMatch = !inn1M ? stateJson.match(/"j"\s*:\s*"([\d]+\/[\d]+\([\d.]+)"/) : null;
    const kMatch = !inn2M ? stateJson.match(/"k"\s*:\s*"([\d]+\/[\d]+\([\d.]+)"/) : null;
    const scores = [];
    if (inn1M) scores.push({ team: team2Short, scoreRaw: inn1M[1] });
    else if (jMatch) scores.push({ team: team2Short, scoreRaw: jMatch[1] });
    if (inn2M) scores.push({ team: team1Short, scoreRaw: inn2M[1] });
    else if (kMatch) scores.push({ team: team1Short, scoreRaw: kMatch[1] });
    for (const { team, scoreRaw } of scores) {
      const parsed = scoreRaw.match(/^([\d]+\/[\d]+)\(([\d.]+)/);
      if (parsed) {
        const overs = parseFloat(parsed[2]);
        scoreStringParts.push(`${team}: ${parsed[1]} (${overs} ov)`);
        totalOvers += overs;
      }
    }
  }
  if (scoreStringParts.length === 0) {
    const seenTeams = /* @__PURE__ */ new Set();
    let sm;
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
    totalOvers
  };
}
async function fetchCrexScorecard(team1Short, team2Short) {
  try {
    const baseUrl = await findCrexMatchUrl(team1Short, team2Short);
    if (!baseUrl) return null;
    const scorecardHtml = await fetchCrexPage(`${baseUrl}/scorecard`);
    const result = parseCrexHtml(scorecardHtml);
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
        `[Crex:Map] Points:
${sorted.map(([n, p]) => `  ${n}: ${p}`).join("\n")}`
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
var CRICKET_API_BASE, dailyApiCalls, dailyApiCallDate, tier1BlockedUntil, scorecardStateCache, DELAY_KEYWORDS, TEAM_COLORS, KNOWN_TEAM_CODES, IPL_2026_SERIES_ID_PREVIEW, IPL_2026_HARDCODED, _iplPreviewCache, IPL_PREVIEW_TTL_MS, lastStatusRefresh, STATUS_REFRESH_INTERVAL, CRICBUZZ_HOST, CFLL_IPL_SCHEDULE_URL, CFLL_SCHEDULE_TTL_MS, cfllScheduleCache, crexScheduleCache, CREX_IPL_SCHEDULE_URL, CREX_SCHEDULE_TTL_MS;
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
    KNOWN_TEAM_CODES = {
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
    IPL_2026_SERIES_ID_PREVIEW = "87c62aac-bc3c-4738-ab93-19da0690488f";
    IPL_2026_HARDCODED = [
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
      { externalId: "11d553de-3b2a-4e58-9abd-4bb7d575595e", seriesId: IPL_2026_SERIES_ID_PREVIEW, team1: "Mumbai Indians", team1Short: "MI", team2: "Royal Challengers Bengaluru", team2Short: "RCB", dateTimeGMT: "2026-04-12T14:00:00" }
    ];
    _iplPreviewCache = null;
    IPL_PREVIEW_TTL_MS = 15 * 60 * 1e3;
    lastStatusRefresh = 0;
    STATUS_REFRESH_INTERVAL = 5 * 60 * 1e3;
    CRICBUZZ_HOST = "cricbuzz-cricket.p.rapidapi.com";
    CFLL_IPL_SCHEDULE_URL = "https://cricketfastliveline.in/series/indian-premier-league-2026/schedule/a-rz--cricket--bcci--iplt20--2026-ZGwl";
    CFLL_SCHEDULE_TTL_MS = 24 * 60 * 60 * 1e3;
    cfllScheduleCache = null;
    crexScheduleCache = null;
    CREX_IPL_SCHEDULE_URL = "https://crex.com/series/indian-premier-league-2026-1PW/matches";
    CREX_SCHEDULE_TTL_MS = 24 * 60 * 60 * 1e3;
  }
});

// server/cricsheet-loader.ts
var cricsheet_loader_exports = {};
__export(cricsheet_loader_exports, {
  getLoaderProgress: () => getLoaderProgress,
  loadCricsheetData: () => loadCricsheetData,
  rebuildHistoricalStatsPublic: () => rebuildHistoricalStatsPublic
});
import https from "https";
import http from "http";
import AdmZip from "adm-zip";
function calcBattingPoints(runs, balls, fours, sixes, isOut, dismissalType) {
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
    const sr = runs / balls * 100;
    if (sr > 170) pts += 6;
    else if (sr > 150) pts += 4;
    else if (sr >= 130) pts += 2;
    else if (sr >= 60 && sr <= 70) pts -= 2;
    else if (sr >= 50 && sr <= 59) pts -= 4;
    else if (sr < 50) pts -= 6;
  }
  return pts;
}
function calcBowlingPoints(wickets, overs, runsConceded, maidens, dotBalls, lbwOrBowledWickets) {
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
function calcFieldingPoints(catches, stumpings, runOutsDirect, runOutsIndirect) {
  let pts = 0;
  pts += catches * 8;
  if (catches >= 3) pts += 4;
  pts += stumpings * 12;
  pts += runOutsDirect * 12;
  pts += runOutsIndirect * 6;
  return pts;
}
function getPhase(overNumber) {
  if (overNumber <= 5) return "powerplay";
  if (overNumber <= 14) return "middle";
  return "death";
}
function downloadBuffer(url) {
  return new Promise((resolve2, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve2(downloadBuffer(res.headers.location));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve2(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}
function getLoaderProgress() {
  return { ...loaderProgress };
}
async function loadCricsheetData() {
  if (loaderProgress.status === "running") return;
  loaderProgress = {
    total: 0,
    processed: 0,
    failed: 0,
    status: "running",
    message: "Downloading Cricsheet IPL data..."
  };
  try {
    console.log("[Cricsheet] Downloading IPL JSON zip from cricsheet.org...");
    const zipBuffer = await downloadBuffer("https://cricsheet.org/downloads/ipl_json.zip");
    console.log(`[Cricsheet] Downloaded ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`);
    loaderProgress.message = "Unzipping...";
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries().filter(
      (e) => e.entryName.endsWith(".json") && !e.entryName.toLowerCase().includes("readme") && !e.entryName.toLowerCase().includes("info")
    );
    loaderProgress.total = entries.length;
    loaderProgress.message = `Parsing ${entries.length} match files...`;
    console.log(`[Cricsheet] Found ${entries.length} match JSON files`);
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
      } catch (err) {
        console.error(`[Cricsheet] Failed: ${entry.entryName} \u2014 ${err.message}`);
        loaderProgress.failed++;
      }
    }
    loaderProgress.message = "Rebuilding player_historical_stats...";
    await rebuildHistoricalStats();
    const { invalidateHistoricalStatsCache: invalidateHistoricalStatsCache2, invalidateCanonicalIndex: invalidateCanonicalIndex2, invalidateMappingsCache: invalidateMappingsCache2, runAutoMapping: runAutoMapping2 } = await Promise.resolve().then(() => (init_routes(), routes_exports));
    invalidateHistoricalStatsCache2();
    invalidateCanonicalIndex2();
    invalidateMappingsCache2();
    console.log("[Cricsheet] Running auto name mapping...");
    await runAutoMapping2();
    loaderProgress.status = "done";
    loaderProgress.message = `Complete. ${loaderProgress.processed} matches loaded, ${loaderProgress.failed} failed.`;
    console.log(`[Cricsheet] ${loaderProgress.message}`);
  } catch (err) {
    loaderProgress.status = "error";
    loaderProgress.message = `Fatal error: ${err.message}`;
    console.error("[Cricsheet] Fatal error:", err);
  }
}
async function processMatch(matchData) {
  const info = matchData.info;
  if (!info) return;
  const eventName = info.event?.name || info.competition?.name || "";
  if (!eventName.toLowerCase().includes("indian premier league") && !eventName.toLowerCase().includes("ipl")) return;
  const teams = info.teams || [];
  if (teams.length !== 2) return;
  const matchDate = info.dates?.[0] || "";
  const season = String(info.season || matchDate.split("-")[0] || "unknown");
  const cricsheetMatchId = `${matchDate}_${teams[0]}_${teams[1]}`.replace(/\s+/g, "_");
  const players2 = {};
  function getOrCreate(name, team, opponent) {
    if (!players2[name]) {
      players2[name] = {
        team,
        opponent,
        battingPosition: 0,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        powerplayRuns: 0,
        powerplayBalls: 0,
        middleRuns: 0,
        middleBalls: 0,
        deathRuns: 0,
        deathBalls: 0,
        isOut: false,
        dismissalType: "",
        wickets: 0,
        runsConceded: 0,
        maidens: 0,
        dotBalls: 0,
        powerplayWickets: 0,
        deathWickets: 0,
        lbwOrBowledWickets: 0,
        catches: 0,
        stumpings: 0,
        runOutsDirect: 0,
        runOutsIndirect: 0,
        bowledOvers: /* @__PURE__ */ new Set()
      };
    }
    return players2[name];
  }
  for (const inning of matchData.innings || []) {
    const battingTeam = inning.team;
    const bowlingTeam = teams.find((t) => t !== battingTeam) || "";
    const battingOrder = {};
    let positionCounter = 1;
    const overInfo = {};
    for (const over of inning.overs || []) {
      const overNum = over.over;
      const phase = getPhase(overNum);
      const deliveries = over.deliveries || [];
      if (deliveries.length === 0) continue;
      const overBowler = deliveries[0].bowler;
      overInfo[overNum] = { bowler: overBowler, runs: 0, legal: 0 };
      for (const delivery of deliveries) {
        const batter = delivery.batter;
        const bowler = delivery.bowler;
        const batterStats = getOrCreate(batter, battingTeam, bowlingTeam);
        const bowlerStats = getOrCreate(bowler, bowlingTeam, battingTeam);
        if (!battingOrder[batter]) {
          battingOrder[batter] = positionCounter++;
          batterStats.battingPosition = battingOrder[batter];
        }
        const isWide = delivery.extras?.wides !== void 0;
        const isNoBall = delivery.extras?.noballs !== void 0;
        const batsmanRuns = delivery.runs?.batter || 0;
        const totalRuns = delivery.runs?.total || 0;
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
        bowlerStats.bowledOvers.add(overNum);
        if (!isWide) {
          bowlerStats.runsConceded += totalRuns;
          overInfo[overNum].runs += totalRuns;
          if (!isNoBall) {
            overInfo[overNum].legal++;
            if (totalRuns === 0) bowlerStats.dotBalls++;
          }
        }
        for (const wicket of delivery.wickets || []) {
          const kind = wicket.kind || "";
          const playerOut = wicket.player_out || "";
          const isRunOut = kind === "run out";
          if (!isRunOut && playerOut === batter) {
            bowlerStats.wickets++;
            if (phase === "powerplay") bowlerStats.powerplayWickets++;
            if (phase === "death") bowlerStats.deathWickets++;
            if (kind === "lbw" || kind === "bowled") bowlerStats.lbwOrBowledWickets++;
          }
          if (playerOut === batter) {
            batterStats.isOut = true;
            batterStats.dismissalType = kind;
          }
          const fielders = wicket.fielders || [];
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
    for (const [overNum, info2] of Object.entries(overInfo)) {
      if (info2.legal >= 6 && info2.runs === 0 && info2.bowler) {
        const bowlerStats = players2[info2.bowler];
        if (bowlerStats) bowlerStats.maidens++;
      }
    }
  }
  const client = await pool.connect();
  try {
    for (const [playerName, s] of Object.entries(players2)) {
      const oversBowled = s.bowledOvers.size;
      const battingPts = calcBattingPoints(
        s.runs,
        s.balls,
        s.fours,
        s.sixes,
        s.isOut,
        s.dismissalType
      );
      const bowlingPts = calcBowlingPoints(
        s.wickets,
        oversBowled,
        s.runsConceded,
        s.maidens,
        s.dotBalls,
        s.lbwOrBowledWickets
      );
      const fieldingPts = calcFieldingPoints(
        s.catches,
        s.stumpings,
        s.runOutsDirect,
        s.runOutsIndirect
      );
      const cdoPoints = battingPts + bowlingPts + fieldingPts + 4;
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
        cricsheetMatchId,
        season,
        matchDate,
        s.team,
        s.opponent,
        playerName,
        s.battingPosition,
        s.runs,
        s.balls,
        s.fours,
        s.sixes,
        s.powerplayRuns,
        s.powerplayBalls,
        s.middleRuns,
        s.middleBalls,
        s.deathRuns,
        s.deathBalls,
        s.wickets,
        oversBowled,
        s.runsConceded,
        s.maidens,
        s.dotBalls,
        s.powerplayWickets,
        s.deathWickets,
        s.lbwOrBowledWickets,
        s.catches,
        s.stumpings,
        s.runOutsDirect,
        s.runOutsIndirect,
        s.isOut,
        s.dismissalType,
        cdoPoints
      ]);
    }
  } finally {
    client.release();
  }
}
async function rebuildHistoricalStats() {
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
async function rebuildHistoricalStatsPublic() {
  console.log("[Cricsheet] Manual rebuild of player_historical_stats triggered...");
  await rebuildHistoricalStats();
  const { invalidateHistoricalStatsCache: invalidateHistoricalStatsCache2, invalidateCanonicalIndex: invalidateCanonicalIndex2, invalidateMappingsCache: invalidateMappingsCache2, runAutoMapping: runAutoMapping2 } = await Promise.resolve().then(() => (init_routes(), routes_exports));
  invalidateHistoricalStatsCache2();
  invalidateCanonicalIndex2();
  invalidateMappingsCache2();
  console.log("[Cricsheet] Running auto name mapping...");
  await runAutoMapping2();
  console.log("[Cricsheet] Manual rebuild complete.");
}
var loaderProgress;
var init_cricsheet_loader = __esm({
  "server/cricsheet-loader.ts"() {
    "use strict";
    init_db();
    loaderProgress = {
      total: 0,
      processed: 0,
      failed: 0,
      status: "idle",
      message: "Not started"
    };
  }
});

// server/notifications.ts
var notifications_exports = {};
__export(notifications_exports, {
  notifyMatchEnded: () => notifyMatchEnded,
  notifyMatchStartingSoon: () => notifyMatchStartingSoon,
  notifyXIAndImpactUpdated: () => notifyXIAndImpactUpdated
});
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
function initFirebase() {
  if (initialized || getApps().length > 0) return;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "{}";
    console.log("[FCM] FIREBASE_SERVICE_ACCOUNT present:", raw.length > 10);
    const serviceAccount = JSON.parse(raw);
    console.log("[FCM] Parsed service account project_id:", serviceAccount.project_id);
    initializeApp({ credential: cert(serviceAccount) });
    initialized = true;
    console.log("[FCM] Firebase Admin initialized");
  } catch (e) {
    console.error("[FCM] Firebase Admin init failed:", e);
  }
}
async function sendToTokens(tokens, title, body, data) {
  if (!tokens || tokens.length === 0) {
    console.log("[FCM] No tokens to send to");
    return;
  }
  initFirebase();
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }
  for (const chunk of chunks) {
    try {
      const response = await getMessaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: data || {},
        webpush: {
          notification: {
            title,
            body,
            icon: "/icon.png",
            badge: "/icon.png",
            requireInteraction: false
          },
          fcmOptions: { link: "/" }
        }
      });
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (errCode === "messaging/invalid-registration-token" || errCode === "messaging/registration-token-not-registered") {
            failedTokens.push(chunk[idx]);
          }
        }
      });
      for (const token of failedTokens) {
        await storage.deletePushToken(token);
      }
      console.log(`[FCM] Sent: ${response.successCount} success, ${response.failureCount} failed`);
    } catch (e) {
      console.error("[FCM] Send error:", e);
    }
  }
}
async function notifyMatchStartingSoon(team1Short, team2Short) {
  try {
    const tokens = await storage.getPushTokensForIPLUsers() ?? [];
    console.log(`[FCM] Notifying ${tokens.length} users \u2014 match starting soon`);
    await sendToTokens(
      tokens,
      `${team1Short} vs ${team2Short} starts in 30 minutes`,
      "Lock your team now before the deadline closes!",
      { type: "match_starting" }
    );
  } catch (e) {
    console.error("[FCM] notifyMatchStartingSoon failed:", e);
  }
}
async function notifyXIAndImpactUpdated(team1Short, team2Short) {
  try {
    const tokens = await storage.getPushTokensForIPLUsers() ?? [];
    console.log(`[FCM] Notifying ${tokens.length} users \u2014 XI and Impact updated`);
    await sendToTokens(
      tokens,
      `${team1Short} vs ${team2Short} Playing XI & Impact Updated`,
      "The playing XI and impact players are confirmed. Review your team now!",
      { type: "xi_impact_updated" }
    );
  } catch (e) {
    console.error("[FCM] notifyXIAndImpactUpdated failed:", e);
  }
}
async function notifyMatchEnded(team1Short, team2Short) {
  try {
    const tokens = await storage.getPushTokensForIPLUsers() ?? [];
    console.log(`[FCM] Notifying ${tokens.length} users \u2014 match ended`);
    await sendToTokens(
      tokens,
      `${team1Short} vs ${team2Short} has ended`,
      "The match is over \u2014 check your points and see where you stand!",
      { type: "match_ended" }
    );
  } catch (e) {
    console.error("[FCM] notifyMatchEnded failed:", e);
  }
}
var initialized;
var init_notifications = __esm({
  "server/notifications.ts"() {
    "use strict";
    init_storage();
    initialized = false;
  }
});

// server/routes.ts
var routes_exports = {};
__export(routes_exports, {
  invalidateCanonicalIndex: () => invalidateCanonicalIndex,
  invalidateHistoricalStatsCache: () => invalidateHistoricalStatsCache,
  invalidateMappingsCache: () => invalidateMappingsCache,
  registerRoutes: () => registerRoutes,
  runAutoMapping: () => runAutoMapping,
  startOwnershipWorker: () => startOwnershipWorker
});
import { createServer } from "node:http";
import { eq as eq2, and as and2, sql as sql3, or, desc as desc2 } from "drizzle-orm";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createHmac } from "crypto";
import pg2 from "pg";
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
function checkUnlockEligibility(match) {
  if (!match.firstScorecardAt) return { allowed: true };
  const cutoff = new Date(match.firstScorecardAt).getTime() + 6 * 6e4;
  if (Date.now() < cutoff) return { allowed: true };
  return { allowed: false, reason: "Cannot unlock: live scorecard data has been running for more than 6 minutes" };
}
function isEntryOpen(match, nowMs) {
  if (match.status === "completed") return false;
  if (match.adminUnlockOverride === true) {
    if (!match.firstScorecardAt) return true;
    const cutoff = new Date(match.firstScorecardAt).getTime() + 6 * 6e4;
    return nowMs < cutoff;
  }
  const effectiveDeadline = match.revisedStartTime ?? match.startTime;
  return nowMs < new Date(effectiveDeadline).getTime();
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
function invalidateHistoricalStatsCache() {
  historicalStatsCache = null;
  canonicalCacheIndex = null;
  console.log("[AI] Historical stats cache + canonical index invalidated.");
}
async function getHistoricalStatsCache() {
  if (historicalStatsCache) return historicalStatsCache;
  console.log("[AI] Building historical stats cache from DB...");
  const rows = await db.execute(sql3`
    SELECT player_name, avg_cdo_points,
           avg_powerplay_runs, avg_middle_runs, avg_death_runs,
           avg_powerplay_wickets, avg_death_wickets,
           typical_batting_position, matches_played,
           batting_position_certainty, bowling_quota_certainty
    FROM player_historical_stats
  `);
  const cache = /* @__PURE__ */ new Map();
  for (const row of rows.rows) {
    cache.set(row.player_name, row);
  }
  historicalStatsCache = cache;
  console.log(`[AI] Historical stats cache built \u2014 ${cache.size} players.`);
  return cache;
}
async function refreshOwnershipCache(matchId) {
  try {
    const rows = await db.execute(sql3`
      SELECT ut.player_ids, ut.captain_id, ut.vice_captain_id
      FROM user_teams ut
      WHERE ut.match_id = ${matchId}
    `);
    const teams = rows.rows;
    const teamCount = teams.length;
    if (teamCount === 0) return;
    const playerCounts = {};
    const captainCounts = {};
    const vcCounts = {};
    for (const team of teams) {
      const ids = team.player_ids || [];
      for (const id of ids) playerCounts[id] = (playerCounts[id] || 0) + 1;
      if (team.captain_id) captainCounts[team.captain_id] = (captainCounts[team.captain_id] || 0) + 1;
      if (team.vice_captain_id) vcCounts[team.vice_captain_id] = (vcCounts[team.vice_captain_id] || 0) + 1;
    }
    const playerOwnership = {};
    const captainOwnership = {};
    const vcOwnership = {};
    for (const [id, count] of Object.entries(playerCounts)) playerOwnership[id] = count / teamCount;
    for (const [id, count] of Object.entries(captainCounts)) captainOwnership[id] = count / teamCount;
    for (const [id, count] of Object.entries(vcCounts)) vcOwnership[id] = count / teamCount;
    ownershipCache[matchId] = {
      playerOwnership,
      captainOwnership,
      vcOwnership,
      teamCount,
      calculatedAt: Date.now(),
      source: "real"
    };
  } catch (err) {
    console.error(`[Ownership] Refresh failed for ${matchId}:`, err.message);
  }
}
function getProxyOwnership(player) {
  if (player.credits >= 9.5) return 0.65;
  if (player.role === "WK") return 0.55;
  const pos = player.battingPosition || 0;
  if (pos >= 1 && pos <= 3) return 0.55;
  if (pos >= 4 && pos <= 6) return 0.3;
  if (player.role === "BOWL") return 0.45;
  if (player.role === "AR") return 0.4;
  return 0.2;
}
function getOwnershipForMatch(matchId, matchStartTime, players2) {
  const cached = ownershipCache[matchId];
  const now = Date.now();
  const minsToStart = (new Date(matchStartTime).getTime() - now) / 6e4;
  const ttl = minsToStart <= 20 ? CACHE_TTL_LOCK : CACHE_TTL_NORMAL;
  if (!cached || now - cached.calculatedAt > CACHE_MAX_STALENESS) {
    console.warn(`[Ownership] Cache dead/missing for ${matchId} \u2014 using proxy`);
    const playerOwnership = {};
    for (const p of players2) playerOwnership[p.id] = getProxyOwnership(p);
    return { playerOwnership, captainOwnership: {}, vcOwnership: {}, teamCount: 0, calculatedAt: now, source: "proxy" };
  }
  if (now - cached.calculatedAt > ttl) {
    console.warn(`[Ownership] Cache stale for ${matchId} \u2014 serving stale, triggering refresh`);
    refreshOwnershipCache(matchId).catch(() => {
    });
  }
  return cached;
}
function startOwnershipWorker(getUpcomingMatchIds) {
  setInterval(async () => {
    try {
      const matchIds = await getUpcomingMatchIds();
      for (const matchId of matchIds) await refreshOwnershipCache(matchId);
    } catch (err) {
      console.error("[Ownership] Worker error:", err.message);
    }
  }, CACHE_TTL_NORMAL);
  console.log("[Ownership] Background worker started.");
}
function getAiMode(userId) {
  const count = (userTapCounters[userId] || 0) + 1;
  userTapCounters[userId] = count;
  return count % 2 === 0 ? "differential" : "safe";
}
function canonicalize(name) {
  return name.toLowerCase().replace(/\./g, " ").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}
function extractSurname(name) {
  return canonicalize(name).split(" ").pop() || "";
}
function extractInitial(name) {
  return canonicalize(name)[0] || "";
}
function invalidateCanonicalIndex() {
  canonicalCacheIndex = null;
}
function buildCanonicalIndex(cache) {
  if (canonicalCacheIndex && canonicalCacheIndex.size === cache.size) return canonicalCacheIndex;
  const index = /* @__PURE__ */ new Map();
  for (const row of cache.values()) index.set(canonicalize(row.player_name), row);
  canonicalCacheIndex = index;
  return index;
}
function invalidateMappingsCache() {
  dbMappingsCache = null;
}
async function getDbMappingsCache() {
  if (dbMappingsCache) return dbMappingsCache;
  const rows = await db.execute(sql3`
    SELECT db_name, cricsheet_name, team_short
    FROM player_name_mappings
    WHERE cricsheet_name != '' AND confidence != 'unresolved'
  `);
  const map = /* @__PURE__ */ new Map();
  for (const row of rows.rows) {
    map.set(`${canonicalize(row.db_name)}|${row.team_short}`, row.cricsheet_name);
    map.set(canonicalize(row.db_name), row.cricsheet_name);
  }
  dbMappingsCache = map;
  console.log(`[AI Mapping] Loaded ${rows.rows.length} mappings from DB`);
  return map;
}
async function runAutoMapping() {
  try {
    console.log("[AI Mapping] Starting auto-mapping...");
    const dbPlayersRows = await db.execute(sql3`
      SELECT DISTINCT p.name, p.team_short
      FROM players p
      INNER JOIN matches m ON p.match_id = m.id
      WHERE p.name IS NOT NULL
        AND (
          m.tournament_name ILIKE '%ipl%'
          OR m.league ILIKE '%indian premier league%'
          OR p.team_short IN ('RR','RCB','MI','CSK','KKR','SRH','DC','PBKS','GT','LSG')
        )
    `);
    const cricsheetRows = await db.execute(sql3`
      SELECT DISTINCT player_name, team FROM player_historical_stats
    `);
    const cricsheetByCanonicalTeam = /* @__PURE__ */ new Map();
    for (const row of cricsheetRows.rows) {
      const teamKey = canonicalize(row.team);
      if (!cricsheetByCanonicalTeam.has(teamKey)) cricsheetByCanonicalTeam.set(teamKey, []);
      cricsheetByCanonicalTeam.get(teamKey).push(row.player_name);
    }
    const allCricsheetPlayers = [];
    for (const players2 of cricsheetByCanonicalTeam.values()) allCricsheetPlayers.push(...players2);
    let autoMapped = 0, alreadyMapped = 0, unresolved = 0;
    for (const dbRow of dbPlayersRows.rows) {
      const dbName = dbRow.name;
      const teamShort = dbRow.team_short;
      const canonicalDb = canonicalize(dbName);
      const existing = await db.execute(sql3`
        SELECT confidence FROM player_name_mappings
        WHERE db_name = ${dbName} AND team_short = ${teamShort}
      `);
      if (existing.rows.length > 0 && existing.rows[0].confidence === "manual") {
        alreadyMapped++;
        continue;
      }
      const cricsheetTeamNames = TEAM_SHORT_TO_CRICSHEET[teamShort] || [];
      let teamPlayers = [];
      for (const expectedTeam of cricsheetTeamNames) {
        for (const [cricTeam, players2] of cricsheetByCanonicalTeam.entries()) {
          if (cricTeam.includes(expectedTeam) || expectedTeam.includes(cricTeam)) {
            teamPlayers = [...teamPlayers, ...players2];
          }
        }
      }
      teamPlayers = [...new Set(teamPlayers)];
      const searchPool = teamPlayers.length > 0 ? teamPlayers : allCricsheetPlayers;
      let bestMatch = null;
      let bestConfidence = "unresolved";
      for (const cp of searchPool) {
        if (canonicalize(cp) === canonicalDb) {
          bestMatch = cp;
          bestConfidence = "high";
          break;
        }
      }
      if (!bestMatch) {
        const dbSurname = extractSurname(dbName);
        const dbInit = extractInitial(dbName);
        const surnameMatches = searchPool.filter((cp) => extractSurname(cp) === dbSurname);
        if (surnameMatches.length === 1) {
          bestMatch = surnameMatches[0];
          bestConfidence = extractInitial(surnameMatches[0]) === dbInit ? "high" : "medium";
        } else if (surnameMatches.length > 1) {
          const initMatches = surnameMatches.filter((cp) => extractInitial(cp) === dbInit);
          if (initMatches.length === 1) {
            bestMatch = initMatches[0];
            bestConfidence = "high";
          }
        }
      }
      await db.execute(sql3`
        INSERT INTO player_name_mappings (db_name, cricsheet_name, team_short, confidence, source)
        VALUES (
          ${dbName},
          ${bestMatch ?? ""},
          ${teamShort},
          ${bestConfidence},
          'auto'
        )
        ON CONFLICT (db_name, team_short) DO UPDATE SET
          cricsheet_name = EXCLUDED.cricsheet_name,
          confidence = EXCLUDED.confidence,
          source = CASE WHEN player_name_mappings.source = 'admin' THEN 'admin' ELSE 'auto' END,
          updated_at = NOW()
        WHERE player_name_mappings.source != 'admin'
      `);
      if (bestMatch) autoMapped++;
      else unresolved++;
    }
    dbMappingsCache = null;
    console.log(`[AI Mapping] Done: ${autoMapped} mapped, ${alreadyMapped} manual kept, ${unresolved} unresolved`);
  } catch (err) {
    console.error("[AI Mapping] Error:", err.message);
  }
}
function matchPlayerToHistorical(dbName, cache, dbMappings, teamShort) {
  const canonicalIndex = buildCanonicalIndex(cache);
  const canonicalDb = canonicalize(dbName);
  if (dbMappings) {
    const teamKey = `${canonicalDb}|${teamShort}`;
    const mappingTarget = dbMappings.get(teamKey) || dbMappings.get(canonicalDb);
    if (mappingTarget && mappingTarget !== "") {
      const row = canonicalIndex.get(canonicalize(mappingTarget)) || cache.get(mappingTarget);
      if (row && row.matches_played > 0) {
        const confidence = row.matches_played >= 10 ? "high" : row.matches_played >= 5 ? "medium" : "low";
        console.log(`[AI Match] "${dbName}" \u2192 "${row.player_name}" ${confidence.toUpperCase()} via DB-MAPPING (${row.matches_played} matches)`);
        return { stats: row, confidence, resolvedVia: "db-mapping" };
      }
    }
  }
  const aliasTarget = PLAYER_ALIASES[canonicalDb];
  if (aliasTarget) {
    const row = canonicalIndex.get(canonicalize(aliasTarget)) || cache.get(aliasTarget);
    if (row && row.matches_played > 0) {
      const confidence = row.matches_played >= 10 ? "high" : row.matches_played >= 5 ? "medium" : "low";
      console.log(`[AI Match] "${dbName}" \u2192 "${row.player_name}" ${confidence.toUpperCase()} via ALIAS (${row.matches_played} matches)`);
      return { stats: row, confidence, resolvedVia: "alias" };
    }
  }
  const exactMatch = canonicalIndex.get(canonicalDb);
  if (exactMatch && exactMatch.matches_played > 0) {
    const confidence = exactMatch.matches_played >= 10 ? "high" : exactMatch.matches_played >= 5 ? "medium" : "low";
    console.log(`[AI Match] "${dbName}" \u2192 "${exactMatch.player_name}" ${confidence.toUpperCase()} via EXACT (${exactMatch.matches_played} matches)`);
    return { stats: exactMatch, confidence, resolvedVia: "exact" };
  }
  const dbSurname = extractSurname(dbName);
  const dbInit = extractInitial(dbName);
  const dbHasInitialOnly = canonicalDb.split(" ").length <= 2 && canonicalDb.split(" ")[0].length <= 2;
  const candidates = [];
  for (const row of cache.values()) {
    if (extractSurname(row.player_name) === dbSurname) candidates.push(row);
  }
  if (candidates.length === 0) {
    console.log(`[AI Match] "${dbName}" \u2192 NONE (no match found)`);
    return { stats: null, confidence: "none", resolvedVia: "no-match" };
  }
  if (candidates.length === 1) {
    const row = candidates[0];
    const mp = row.matches_played;
    if (mp === 0) return { stats: null, confidence: "none", resolvedVia: "zero-matches" };
    const cricInit = extractInitial(row.player_name);
    if (dbInit === cricInit) {
      const confidence = mp >= 10 ? "high" : mp >= 5 ? "medium" : "low";
      console.log(`[AI Match] "${dbName}" \u2192 "${row.player_name}" ${confidence.toUpperCase()} via SURNAME+INITIAL (${mp} matches)`);
      return { stats: row, confidence, resolvedVia: "surname-initial" };
    }
    if (!dbHasInitialOnly) {
      console.log(`[AI Match] "${dbName}" \u2192 "${row.player_name}" MEDIUM via SURNAME-ONLY (${mp} matches)`);
      return { stats: row, confidence: "medium", resolvedVia: "surname-only" };
    }
    console.log(`[AI Match] "${dbName}" \u2192 NONE (initial conflict)`);
    return { stats: null, confidence: "none", resolvedVia: "initial-conflict" };
  }
  const initMatches = candidates.filter((c) => extractInitial(c.player_name) === dbInit);
  if (initMatches.length === 1) {
    const row = initMatches[0];
    const mp = row.matches_played;
    if (mp === 0) return { stats: null, confidence: "none", resolvedVia: "zero-matches" };
    const confidence = mp >= 10 ? "high" : mp >= 5 ? "medium" : "low";
    console.log(`[AI Match] "${dbName}" \u2192 "${row.player_name}" ${confidence.toUpperCase()} via COLLISION-RESOLVED (${mp} matches)`);
    return { stats: row, confidence, resolvedVia: "collision-resolved" };
  }
  console.log(`[AI Match] "${dbName}" \u2192 NONE (collision unresolved \u2014 ${candidates.length} candidates)`);
  return { stats: null, confidence: "none", resolvedVia: "collision-unresolved" };
}
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
  app2.post("/api/push-token", isAuthenticated, async (req, res) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Token required" });
      }
      await storage.savePushToken(req.session.userId, token);
      return res.json({ success: true });
    } catch (e) {
      console.error("Push token save error:", e);
      return res.status(500).json({ message: "Failed to save token" });
    }
  });
  app2.get(
    "/api/admin/player-mappings/unresolved",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        const rows = await db.execute(sql3`
          SELECT db_name, team_short, confidence, source, updated_at
          FROM player_name_mappings
          WHERE confidence = 'unresolved' OR cricsheet_name = ''
          ORDER BY team_short, db_name
        `);
        return res.json({ mappings: rows.rows, count: rows.rows.length });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/player-mappings",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { dbName, cricsheetName, teamShort } = req.body;
        if (!dbName || !cricsheetName || !teamShort) {
          return res.status(400).json({ message: "dbName, cricsheetName, teamShort required" });
        }
        await db.execute(sql3`
          INSERT INTO player_name_mappings (db_name, cricsheet_name, team_short, confidence, source)
          VALUES (${dbName}, ${cricsheetName}, ${teamShort}, 'manual', 'admin')
          ON CONFLICT (db_name, team_short) DO UPDATE SET
            cricsheet_name = EXCLUDED.cricsheet_name,
            confidence = 'manual',
            source = 'admin',
            updated_at = NOW()
        `);
        dbMappingsCache = null;
        return res.json({ message: `Mapped "${dbName}" \u2192 "${cricsheetName}" for ${teamShort}` });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/player-mappings/auto-map",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        runAutoMapping().catch((err) => console.error("[AI Mapping] Error:", err));
        return res.json({ message: "Auto-mapping started in background" });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.get(
    "/api/admin/ai-diagnostics/:matchId",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.matchId;
        const matchPlayers = await storage.getPlayersForMatch(matchId);
        const historicalCache = await getHistoricalStatsCache();
        const dbMappings = await getDbMappingsCache();
        const results = matchPlayers.map((p) => {
          const { stats, confidence, resolvedVia } = matchPlayerToHistorical(p.name, historicalCache, dbMappings, p.teamShort);
          return {
            name: p.name,
            teamShort: p.teamShort,
            role: p.role,
            isPlayingXI: p.isPlayingXI,
            confidence,
            resolvedVia,
            matched: stats !== null,
            cricsheetName: stats?.player_name ?? null,
            matchesPlayed: stats?.matches_played ?? 0,
            avgCdoPoints: stats?.avg_cdo_points ?? 0
          };
        });
        const matched = results.filter((r) => r.matched);
        const unresolved = results.filter((r) => !r.matched);
        const byConfidence = {
          high: matched.filter((r) => r.confidence === "high").length,
          medium: matched.filter((r) => r.confidence === "medium").length,
          low: matched.filter((r) => r.confidence === "low").length
        };
        return res.json({
          matchId,
          totalPlayers: results.length,
          matched: matched.length,
          unresolved: unresolved.length,
          byConfidence,
          details: results,
          unresolvedNames: unresolved.map((r) => r.name)
        });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/rebuild-historical-stats",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        const { rebuildHistoricalStatsPublic: rebuildHistoricalStatsPublic2 } = await Promise.resolve().then(() => (init_cricsheet_loader(), cricsheet_loader_exports));
        rebuildHistoricalStatsPublic2().catch((err) => {
          console.error("[Cricsheet] Rebuild error:", err);
        });
        return res.json({ message: "Rebuilding player_historical_stats in background..." });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/load-cricsheet",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        const { getLoaderProgress: getLoaderProgress2, loadCricsheetData: loadCricsheetData2 } = await Promise.resolve().then(() => (init_cricsheet_loader(), cricsheet_loader_exports));
        const current = getLoaderProgress2();
        if (current.status === "running") {
          return res.json({
            message: "Loader already running",
            progress: current
          });
        }
        loadCricsheetData2().catch((err) => {
          console.error("[Cricsheet] Background load error:", err);
        });
        return res.json({
          message: "Cricsheet loader started. Poll /api/admin/load-cricsheet/progress to track."
        });
      } catch (err) {
        console.error("[Cricsheet] Failed to start loader:", err);
        return res.status(500).json({ message: "Failed to start loader", error: err.message });
      }
    }
  );
  app2.get(
    "/api/admin/load-cricsheet/progress",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        const { getLoaderProgress: getLoaderProgress2 } = await Promise.resolve().then(() => (init_cricsheet_loader(), cricsheet_loader_exports));
        return res.json(getLoaderProgress2());
      } catch (err) {
        return res.status(500).json({ message: "Could not get progress", error: err.message });
      }
    }
  );
  app2.post("/api/admin/test-notification", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const { notifyMatchStartingSoon: notifyMatchStartingSoon2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
      await notifyMatchStartingSoon2("TEST", "MATCH");
      return res.json({ message: "Test notification sent \u2014 check Railway logs for [FCM] lines" });
    } catch (e) {
      console.error("[FCM] Test notification error:", e);
      return res.status(500).json({ message: e.message });
    }
  });
  const IPL_2026_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f";
  if (process.env.NODE_ENV !== "production") {
    app2.get("/api/dev/players", async (req, res) => {
      const teamsParam = typeof req.query.teams === "string" ? req.query.teams : "";
      const teams = teamsParam.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 2);
      if (teams.length < 2) return res.json({ players: [], lastMatchXI: {} });
      const allPlayers = [];
      const teamsNeedingApiData = [];
      for (const teamShort of teams) {
        const [recent] = await db.select({ id: matches.id }).from(matches).where(or(eq2(matches.team1Short, teamShort), eq2(matches.team2Short, teamShort))).orderBy(desc2(matches.startTime)).limit(1);
        if (recent) {
          const teamPlayers = await storage.getPlayersForMatch(recent.id);
          const filtered = teamPlayers.filter((p) => p.teamShort === teamShort);
          if (filtered.length > 0) {
            allPlayers.push(...filtered);
            console.log(`[DEV players] DB: ${filtered.length} players for ${teamShort}`);
          } else {
            teamsNeedingApiData.push(teamShort);
          }
        } else {
          teamsNeedingApiData.push(teamShort);
        }
      }
      if (teamsNeedingApiData.length > 0) {
        console.log(`[DEV players] No DB data for ${teamsNeedingApiData.join(", ")} \u2014 fetching from series squad API`);
        const { fetchSeriesSquad: fetchSeriesSquad2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
        const seriesPlayers = await fetchSeriesSquad2(IPL_2026_SERIES_ID);
        console.log(`[DEV players] Series squad returned ${seriesPlayers.length} total players`);
        for (const teamShort of teamsNeedingApiData) {
          const apiTeamPlayers = seriesPlayers.filter((p) => p.teamShort === teamShort);
          console.log(`[DEV players] API: ${apiTeamPlayers.length} players for ${teamShort}`);
          allPlayers.push(
            ...apiTeamPlayers.map((p) => ({
              id: p.externalId,
              matchId: `mock-dev`,
              externalId: p.externalId,
              name: p.name,
              team: p.team,
              teamShort: p.teamShort,
              role: p.role,
              credits: p.credits,
              points: 0,
              selectedBy: 0,
              recentForm: [],
              isImpactPlayer: false,
              isPlayingXI: false,
              apiName: p.name
            }))
          );
        }
      }
      console.log(`[DEV players] Total returned: ${allPlayers.length} players for teams [${teams.join(", ")}]`);
      return res.json({ players: allPlayers, lastMatchXI: {} });
    });
  }
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
    try {
      const newIPL = await ensureIPLPreviewMatches(allMatches);
      if (newIPL.length > 0) allMatches.push(...newIPL);
    } catch (e) {
      console.error("IPL preview error:", e);
    }
    const nowMs = Date.now();
    const MS_7D = 7 * 24 * 60 * 60 * 1e3;
    const MS_3H = 3 * 60 * 60 * 1e3;
    const MS_24H = 24 * 60 * 60 * 1e3;
    const isIPLLeague = (league) => {
      const l = (league || "").toLowerCase();
      return l.includes("indian premier league") || l.includes(" ipl") || l.startsWith("ipl ");
    };
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
      const isIPLPreview = m.status === "upcoming" && isIPLLeague(m.league || "") && !!m.externalId;
      const isRecentlyCompleted = m.status === "completed" && startMs >= nowMs - MS_24H;
      const included = isUpcoming || isLive || m.status === "delayed" || isIPLPreview || isRecentlyCompleted;
      if (included) {
        matchesWithParticipants.push({ match: m, participantCount });
      }
    }
    const upcomingIPLFromApi = matchesWithParticipants.filter((mp) => mp.match.status === "upcoming" && isIPLLeague(mp.match.league) && !!mp.match.externalId).sort((a, b) => new Date(a.match.startTime).getTime() - new Date(b.match.startTime).getTime());
    const top5IPLIds = new Set(upcomingIPLFromApi.slice(0, 5).map((mp) => mp.match.id));
    const cappedMatches = matchesWithParticipants.filter((mp) => {
      const isApiIPL = isIPLLeague(mp.match.league) && !!mp.match.externalId;
      if (!isApiIPL) return true;
      if (mp.match.status !== "upcoming") return true;
      return top5IPLIds.has(mp.match.id);
    });
    cappedMatches.sort((a, b) => {
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
    const result = cappedMatches.map((mp) => ({
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
      const SQUAD_MIN = 15;
      const backoffUntil = squadFetchBackoff.get(matchId) ?? 0;
      const squadFetchAllowed = matchPlayers.length < SQUAD_MIN && Date.now() > backoffUntil;
      if (squadFetchAllowed) {
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
              squadFetchBackoff.delete(matchId);
            } else {
              squadFetchBackoff.set(matchId, Date.now() + SQUAD_BACKOFF_MS);
              console.log(`[SquadFetch] 0 players returned for match ${matchId} \u2014 backing off 1h`);
            }
          } catch (err) {
            console.error("Auto-fetch squad error:", err);
            squadFetchBackoff.set(matchId, Date.now() + SQUAD_BACKOFF_MS);
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
      try {
        const matchForNorm = await storage.getMatch(matchId);
        if (matchForNorm) {
          const t1s = matchForNorm.team1Short ?? "";
          const t2s = matchForNorm.team2Short ?? "";
          const t1f = (matchForNorm.team1 ?? "").toLowerCase();
          const t2f = (matchForNorm.team2 ?? "").toLowerCase();
          matchPlayers = matchPlayers.map((p) => {
            if (p.teamShort === t1s || p.teamShort === t2s) return p;
            const ps = (p.teamShort ?? "").toLowerCase();
            const pt = (p.team ?? "").toLowerCase();
            if (pt.length > 2 && t1f.length > 2 && (pt === t1f || t1f.includes(pt) || pt.includes(t1f))) {
              return { ...p, teamShort: t1s };
            }
            if (pt.length > 2 && t2f.length > 2 && (pt === t2f || t2f.includes(pt) || pt.includes(t2f))) {
              return { ...p, teamShort: t2s };
            }
            const t1sl = t1s.toLowerCase();
            const t2sl = t2s.toLowerCase();
            if (ps.endsWith(t1sl) || t1sl.endsWith(ps)) return { ...p, teamShort: t1s };
            if (ps.endsWith(t2sl) || t2sl.endsWith(ps)) return { ...p, teamShort: t2s };
            return p;
          });
        }
      } catch (normErr) {
        console.error("[teamShort normalization] error:", normErr);
      }
      const statuses = await storage.getMatchPlayerStatuses(matchId);
      const statusMap = new Map(statuses.map((s) => [s.playerId, s]));
      const activatedImpactIds = new Set(
        statuses.filter((s) => s.officialImpactSubUsed === true).map((s) => s.playerId)
      );
      const augmentedPlayers = matchPlayers.map((p) => ({
        ...p,
        isImpactPlayer: statusMap.get(p.id)?.adminStatus === "impact_sub",
        isImpactActivated: activatedImpactIds.has(p.id),
        isPlayingXI: p.isPlayingXI,
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
        console.log(`[LiveScorecard] cache MISS for ${cacheKey} \u2014 fetching (Cricbuzz primary)`);
        let scorecard = null;
        let source = "none";
        if (process.env.RAPIDAPI_KEY && match.team1Short && match.team2Short) {
          try {
            const { fetchCricbuzzLiveScorecard: fetchCricbuzzLiveScorecard2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
            const cbData = await fetchCricbuzzLiveScorecard2(match.team1Short, match.team2Short);
            if (cbData) {
              const dbPlayers = await storage.getPlayersForMatch(match.id);
              const normalize = (n) => n.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
              const pointsByName = /* @__PURE__ */ new Map();
              for (const p of dbPlayers) {
                const key = normalize(p.name);
                if (key) pointsByName.set(key, p.points ?? 0);
              }
              for (const inn of cbData.innings) {
                for (const b of inn.batting) {
                  b.fantasyPoints = pointsByName.get(normalize(b.name)) ?? 0;
                }
                for (const bw of inn.bowling) {
                  bw.fantasyPoints = pointsByName.get(normalize(bw.name)) ?? 0;
                }
              }
              scorecard = cbData;
              source = "Cricbuzz";
              console.log(`[LiveScorecard] Cricbuzz (primary) for ${match.team1Short} vs ${match.team2Short}`);
            }
          } catch (cbErr) {
            console.error(`[LiveScorecard] Cricbuzz primary failed:`, cbErr?.message || cbErr);
          }
        }
        if (!scorecard) {
          try {
            const { fetchLiveScorecard: fetchLiveScorecard2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
            scorecard = await fetchLiveScorecard2(cacheKey);
            if (scorecard) {
              source = "CricAPI";
              console.log(`[LiveScorecard] CricAPI (secondary) for ${cacheKey}`);
            }
          } catch (apiErr) {
            console.error(`[LiveScorecard] CricAPI secondary failed for ${cacheKey}:`, apiErr?.message || apiErr);
          }
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
              name: "Hidden Team",
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
      const isCompleted = match.status === "completed";
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
        const matchPlayersRaw = await storage.getPlayersForMatch(matchId);
        const allStatuses = await storage.getMatchPlayerStatuses(matchId);
        const activatedPlayerIds = new Set(
          allStatuses.filter((s) => s.officialImpactSubUsed === true).map((s) => s.playerId)
        );
        const matchPlayersForResponse = matchPlayersRaw.map((p) => ({
          ...p,
          isImpactActivated: activatedPlayerIds.has(p.id)
        }));
        const playerById = new Map(matchPlayersForResponse.map((p) => [p.id, p]));
        const standings = allTeams.map((t) => {
          const isOwn = t.userId === req.session.userId;
          const shouldHide = t.invisibleMode === true && !isOwn && !isCompleted;
          if (shouldHide) {
            return {
              teamId: t.id,
              teamName: "Hidden Team",
              userId: t.userId,
              username: allUsers[t.userId]?.username || "Unknown",
              userTeamName: allUsers[t.userId]?.teamName || "",
              totalPoints: t.totalPoints || 0,
              playerIds: [],
              captainId: null,
              viceCaptainId: null,
              primaryImpactId: null,
              backupImpactId: null,
              captainType: null,
              vcType: null,
              resolvedPlayers: [],
              invisibleHidden: true,
              rank: 0
            };
          }
          let resolvedPlayers = t.playerIds.map((pid) => {
            const p = playerById.get(pid);
            if (p) return { id: p.id, name: p.name, role: p.role, points: p.points || 0, teamShort: p.teamShort, externalId: p.externalId, isPlayingXI: p.isPlayingXI ?? false, isImpactPlayer: p.isImpactPlayer ?? false, isImpactActivated: p.isImpactActivated ?? false };
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
              teamShort: p.teamShort,
              externalId: p.externalId
            }));
          }
          const xiAnnouncedInMatch = matchPlayersForResponse.some((p) => p.isPlayingXI);
          let effectiveCaptainId = t.captainId ?? null;
          let effectiveVcId = t.viceCaptainId ?? null;
          if (xiAnnouncedInMatch && (t.backupXiPlayer1Id || t.backupXiPlayer2Id)) {
            const backup1P = t.backupXiPlayer1Id ? playerById.get(t.backupXiPlayer1Id) : null;
            const backup2P = t.backupXiPlayer2Id ? playerById.get(t.backupXiPlayer2Id) : null;
            const availableBackupsForDisplay = [backup1P, backup2P].filter(
              (p) => !!p && p.isPlayingXI === true
            );
            if (availableBackupsForDisplay.length > 0) {
              let bCursor = 0;
              for (let i = 0; i < resolvedPlayers.length; i++) {
                if (bCursor >= availableBackupsForDisplay.length) break;
                const rp = resolvedPlayers[i];
                const fullP = playerById.get(rp.id);
                if (fullP && fullP.isPlayingXI !== true) {
                  let bk = null;
                  while (bCursor < availableBackupsForDisplay.length) {
                    const candidate = availableBackupsForDisplay[bCursor++];
                    if (!resolvedPlayers.some((p) => p.id === candidate.id)) {
                      bk = candidate;
                      break;
                    }
                  }
                  if (!bk) break;
                  if (rp.id === effectiveCaptainId) effectiveCaptainId = bk.id;
                  if (rp.id === effectiveVcId) effectiveVcId = bk.id;
                  resolvedPlayers[i] = {
                    id: bk.id,
                    name: bk.name,
                    role: bk.role,
                    points: bk.points || 0,
                    teamShort: bk.teamShort,
                    externalId: bk.externalId,
                    isPlayingXI: true,
                    isImpactPlayer: bk.isImpactPlayer ?? false
                  };
                }
              }
            }
          }
          return {
            teamId: t.id,
            teamName: t.name,
            userId: t.userId,
            username: allUsers[t.userId]?.username || "Unknown",
            userTeamName: allUsers[t.userId]?.teamName || "",
            totalPoints: t.totalPoints || 0,
            playerIds: t.playerIds,
            captainId: effectiveCaptainId,
            viceCaptainId: effectiveVcId,
            primaryImpactId: t.primaryImpactId || null,
            backupImpactId: t.backupImpactId || null,
            captainType: t.captainType || null,
            vcType: t.vcType || null,
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
    "/api/matches/:id/ai-team",
    isAuthenticated,
    async (req, res) => {
      try {
        let tryBuildTeam2 = function(pool2) {
          const picked = [];
          const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
          const teamCounts = {};
          let credits = 0;
          for (const role of ["WK", "BAT", "AR", "BOWL"]) {
            const best = pool2.find(
              (p) => p.role === role && !picked.find((x) => x.id === p.id) && (teamCounts[p.teamShort] || 0) < MAX_FROM_ONE_TEAM && credits + p.credits <= CREDIT_CAP
            );
            if (best) {
              picked.push(best);
              roleCounts[best.role]++;
              teamCounts[best.teamShort] = (teamCounts[best.teamShort] || 0) + 1;
              credits += best.credits;
            }
          }
          for (const p of pool2) {
            if (picked.length >= 11) break;
            if (picked.find((x) => x.id === p.id)) continue;
            if (roleCounts[p.role] >= ROLE_LIMITS[p.role].max) continue;
            if ((teamCounts[p.teamShort] || 0) >= MAX_FROM_ONE_TEAM) continue;
            if (credits + p.credits > CREDIT_CAP) continue;
            picked.push(p);
            roleCounts[p.role]++;
            teamCounts[p.teamShort] = (teamCounts[p.teamShort] || 0) + 1;
            credits += p.credits;
          }
          return picked.length === 11 ? picked : null;
        }, assignCaptains2 = function(team, ownerData, differential) {
          const cvSorted = [...team].sort((a, b) => {
            if (Math.abs(b.aiScore - a.aiScore) < 5) {
              if (b.role === "AR" && a.role !== "AR") return 1;
              if (a.role === "AR" && b.role !== "AR") return -1;
            }
            return b.aiScore - a.aiScore;
          });
          if (!differential || !ownerData) return { captainId: cvSorted[0].id, vcId: cvSorted[1].id };
          const topScore = cvSorted[0].aiScore;
          const leverageCandidate = team.find((p) => {
            const own = ownerData.playerOwnership[p.id] ?? 0;
            const hist = historicalCache.get(p.name);
            const roleCertainty = (hist?.batting_position_certainty ?? 0) >= 0.6 || (hist?.bowling_quota_certainty ?? 0) >= 0.6;
            return own < 0.25 && p.aiScore >= topScore * 0.85 && roleCertainty && p.id !== cvSorted[0].id;
          });
          return leverageCandidate ? { captainId: leverageCandidate.id, vcId: cvSorted[0].id } : { captainId: cvSorted[0].id, vcId: cvSorted[1].id };
        }, calcTeamProjection2 = function(team, captainId, vcId) {
          return team.reduce((sum, p) => sum + p.aiScore * (p.id === captainId ? 2 : p.id === vcId ? 1.5 : 1), 0);
        };
        var tryBuildTeam = tryBuildTeam2, assignCaptains = assignCaptains2, calcTeamProjection = calcTeamProjection2;
        const matchId = req.params.id;
        const userId = req.session.userId;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const matchPlayers = await storage.getPlayersForMatch(matchId);
        const team1XI = matchPlayers.filter(
          (p) => p.teamShort === match.team1Short && p.isPlayingXI === true
        );
        const team2XI = matchPlayers.filter(
          (p) => p.teamShort === match.team2Short && p.isPlayingXI === true
        );
        const xiPool = [...team1XI, ...team2XI];
        const gatePass = team1XI.length >= 11 && team2XI.length >= 11 && xiPool.some((p) => p.role === "WK") && xiPool.some((p) => p.role === "BAT") && xiPool.some((p) => p.role === "AR") && xiPool.some((p) => p.role === "BOWL");
        if (!gatePass) {
          return res.json({
            fallback: true,
            reason: "Playing XI not fully announced \u2014 using Smart Pick instead."
          });
        }
        const mode = getAiMode(userId);
        const xiPlayerNames = xiPool.map((p) => p.name);
        const [historicalCache, formRows, h2hMatches] = await Promise.all([
          getHistoricalStatsCache(),
          match.tournamentName ? db.execute(sql3`
            SELECT p.name, p.team_short, p.points, m.start_time
            FROM players p
            INNER JOIN matches m ON p.match_id = m.id
            WHERE p.name = ANY(ARRAY[${sql3.join(xiPlayerNames.map((n) => sql3`${n}`), sql3`, `)}])
              AND m.tournament_name = ${match.tournamentName}
              AND m.status = 'completed'
              AND m.id != ${matchId}
            ORDER BY p.name, m.start_time DESC
          `) : Promise.resolve({ rows: [] }),
          db.select({ id: matches.id, startTime: matches.startTime }).from(matches).where(and2(
            eq2(matches.status, "completed"),
            sql3`(
                (${matches.team1Short} = ${match.team1Short} AND ${matches.team2Short} = ${match.team2Short})
                OR
                (${matches.team1Short} = ${match.team2Short} AND ${matches.team2Short} = ${match.team1Short})
              )`,
            sql3`${matches.id} != ${matchId}`
          )).orderBy(sql3`${matches.startTime} DESC`)
        ]);
        const formMap = /* @__PURE__ */ new Map();
        const formByPlayer = /* @__PURE__ */ new Map();
        for (const row of formRows.rows) {
          const key = `${row.name}|${row.team_short}`;
          if (!formByPlayer.has(key)) formByPlayer.set(key, []);
          if (formByPlayer.get(key).length < 5) formByPlayer.get(key).push(row.points ?? 0);
        }
        const formWeights = [0.3, 0.25, 0.2, 0.15, 0.1];
        for (const [key, pts] of formByPlayer.entries()) {
          let ws = 0, wt = 0;
          for (let i = 0; i < pts.length; i++) {
            ws += pts[i] * (formWeights[i] ?? 0.1);
            wt += formWeights[i] ?? 0.1;
          }
          formMap.set(key, wt > 0 ? ws / wt : 0);
        }
        const h2hMap = /* @__PURE__ */ new Map();
        if (h2hMatches.length > 0) {
          const recentH2HIds = new Set(h2hMatches.slice(0, 4).map((m) => m.id));
          const h2hMatchIds = h2hMatches.map((m) => m.id);
          const h2hRows = await db.select({ name: players.name, teamShort: players.teamShort, points: players.points, matchId: players.matchId }).from(players).where(sql3`${players.matchId} = ANY(ARRAY[${sql3.join(h2hMatchIds.map((id) => sql3`${id}`), sql3`, `)}]::text[])`);
          const h2hByPlayer = /* @__PURE__ */ new Map();
          for (const row of h2hRows) {
            const key = `${row.name}|${row.teamShort}`;
            const w = recentH2HIds.has(row.matchId) ? 2 : 1;
            if (!h2hByPlayer.has(key)) h2hByPlayer.set(key, { sum: 0, count: 0 });
            h2hByPlayer.get(key).sum += (row.points ?? 0) * w;
            h2hByPlayer.get(key).count += w;
          }
          for (const [key, { sum, count }] of h2hByPlayer.entries()) h2hMap.set(key, count > 0 ? sum / count : 0);
        }
        const dbMappings = await getDbMappingsCache();
        const roleAvgMap = {
          WK: { sum: 0, count: 0 },
          BAT: { sum: 0, count: 0 },
          AR: { sum: 0, count: 0 },
          BOWL: { sum: 0, count: 0 }
        };
        for (const p of xiPool) {
          const { stats, confidence } = matchPlayerToHistorical(p.name, historicalCache, dbMappings, p.teamShort);
          if (stats && confidence !== "none" && roleAvgMap[p.role]) {
            roleAvgMap[p.role].sum += stats.avg_cdo_points;
            roleAvgMap[p.role].count++;
          }
        }
        const roleDefaults = {};
        for (const role of ["WK", "BAT", "AR", "BOWL"]) {
          roleDefaults[role] = roleAvgMap[role].count > 0 ? roleAvgMap[role].sum / roleAvgMap[role].count : 20;
        }
        const scored = xiPool.map((p) => {
          const key = `${p.name}|${p.teamShort}`;
          const { stats, confidence } = matchPlayerToHistorical(p.name, historicalCache, dbMappings, p.teamShort);
          const careerAvg = stats ? stats.avg_cdo_points : roleDefaults[p.role];
          const careerWeight = confidence === "high" ? 0.3 : confidence === "medium" ? 0.2 : confidence === "low" ? 0.15 : 0;
          const formWeight = 1 - careerWeight - 0.15;
          let phaseBonus = 0;
          if (stats) {
            const pos = stats.typical_batting_position || 0;
            if (p.role === "BAT" || p.role === "AR" || p.role === "WK") {
              let b = 0;
              if (pos >= 1 && pos <= 2) {
                const r = stats.avg_powerplay_runs;
                b = r >= 25 ? 15 : r >= 15 ? 10 : r >= 8 ? 5 : 0;
              } else if (pos >= 3 && pos <= 5) {
                const r = stats.avg_middle_runs;
                b = r >= 25 ? 15 : r >= 15 ? 10 : r >= 8 ? 5 : 0;
              } else if (pos >= 6 && pos <= 8) {
                const r = stats.avg_death_runs;
                b = r >= 25 ? 15 : r >= 15 ? 10 : r >= 8 ? 5 : 0;
              }
              phaseBonus += b;
            }
            if (p.role === "BOWL" || p.role === "AR") {
              const ppW = stats.avg_powerplay_wickets;
              const dW = stats.avg_death_wickets;
              phaseBonus += ppW >= 0.8 ? 15 : ppW >= 0.5 ? 10 : ppW >= 0.3 ? 5 : 0;
              phaseBonus += dW >= 0.8 ? 15 : dW >= 0.5 ? 10 : dW >= 0.3 ? 5 : 0;
            }
            phaseBonus = Math.min(phaseBonus, 20);
          }
          const ceilingScore = stats && stats.matches_played >= 3 ? stats.avg_cdo_points * 1.8 : careerAvg * 1.5;
          const aiScore = careerWeight * careerAvg + formWeight * (formMap.get(key) ?? 0) + 0.15 * (h2hMap.get(key) ?? 0) + phaseBonus;
          return { ...p, aiScore, confidence, careerAvg, ceilingScore };
        });
        scored.sort((a, b) => b.aiScore - a.aiScore);
        const ROLE_LIMITS = {
          WK: { min: 1, max: 4 },
          BAT: { min: 1, max: 6 },
          AR: { min: 1, max: 6 },
          BOWL: { min: 1, max: 6 }
        };
        const MAX_FROM_ONE_TEAM = 6;
        const CREDIT_CAP = 100;
        let safeTeam = tryBuildTeam2(scored);
        if (!safeTeam) {
          for (let retry = 0; retry < 3; retry++) {
            const rc = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
            for (const p of scored) rc[p.role]++;
            const drop = [...scored].sort((a, b) => a.aiScore - b.aiScore).find((p) => rc[p.role] > 1);
            if (!drop) break;
            safeTeam = tryBuildTeam2(scored.filter((p) => p.id !== drop.id));
            if (safeTeam) break;
          }
        }
        if (!safeTeam) return res.status(422).json({ message: "Could not build a valid AI team." });
        const safeOwnership = mode === "differential" ? getOwnershipForMatch(matchId, match.startTime, xiPool) : null;
        const { captainId: safeCaptainId, vcId: safeVcId } = assignCaptains2(safeTeam, null, false);
        const safeProjection = calcTeamProjection2(safeTeam, safeCaptainId, safeVcId);
        let finalTeam = safeTeam;
        let finalCaptainId = safeCaptainId;
        let finalVcId = safeVcId;
        let modeDowngraded = false;
        let downgradeReason = "";
        let chalkDropped = null;
        let replacementChosen = null;
        let swapsApplied = 0;
        if (mode === "differential" && safeOwnership) {
          const ownerData = safeOwnership;
          const chalkThresholds = [0.75, 0.6, 0.4];
          let chalkCandidates = [];
          for (const threshold of chalkThresholds) {
            chalkCandidates = safeTeam.filter((p) => (ownerData.playerOwnership[p.id] ?? getProxyOwnership(p)) >= threshold);
            if (chalkCandidates.length > 0) break;
          }
          if (chalkCandidates.length === 0) {
            modeDowngraded = true;
            downgradeReason = "no chalk candidates";
          }
          if (!modeDowngraded) {
            let differentialTeam = null;
            for (const chalkPlayer of chalkCandidates) {
              const rc3 = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
              for (const p of safeTeam) rc3[p.role]++;
              if (rc3[chalkPlayer.role] <= 1) continue;
              const ownerThresholds = [0.2, 0.3, 0.4, 1];
              let replacement = null;
              for (const ownerThreshold of ownerThresholds) {
                const teamWithout = safeTeam.filter((p) => p.id !== chalkPlayer.id);
                const creditsWithout = teamWithout.reduce((s, p) => s + p.credits, 0);
                const twc = {};
                const rwc = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
                for (const p of teamWithout) {
                  twc[p.teamShort] = (twc[p.teamShort] || 0) + 1;
                  rwc[p.role]++;
                }
                replacement = scored.find((p) => {
                  const own = ownerData.playerOwnership[p.id] ?? getProxyOwnership(p);
                  const chalkOwn = ownerData.playerOwnership[chalkPlayer.id] ?? getProxyOwnership(chalkPlayer);
                  return !safeTeam.find((x) => x.id === p.id) && p.role === chalkPlayer.role && own < ownerThreshold && own < chalkOwn && (twc[p.teamShort] || 0) < MAX_FROM_ONE_TEAM && creditsWithout + p.credits <= CREDIT_CAP && rwc[p.role] < ROLE_LIMITS[p.role].max;
                }) || null;
                if (replacement) break;
              }
              if (!replacement) continue;
              const candidateTeam = safeTeam.map((p) => p.id === chalkPlayer.id ? replacement : p);
              const { captainId: diffCaptainId, vcId: diffVcId } = assignCaptains2(candidateTeam, ownerData, true);
              const diffProjection = calcTeamProjection2(candidateTeam, diffCaptainId, diffVcId);
              const guardrailRatio = swapsApplied === 0 ? 0.93 : swapsApplied === 1 ? 0.9 : 0.87;
              if (diffProjection < safeProjection * guardrailRatio) {
                downgradeReason = `projection ${(diffProjection / safeProjection * 100).toFixed(1)}% below guardrail`;
                continue;
              }
              differentialTeam = candidateTeam;
              finalCaptainId = diffCaptainId;
              finalVcId = diffVcId;
              chalkDropped = chalkPlayer.name;
              replacementChosen = replacement.name;
              swapsApplied++;
              break;
            }
            if (!differentialTeam) {
              modeDowngraded = true;
              downgradeReason = downgradeReason || "no valid differential swap found";
            } else {
              finalTeam = differentialTeam;
            }
          }
          if (modeDowngraded) {
            finalCaptainId = safeCaptainId;
            finalVcId = safeVcId;
          }
        } else {
          finalCaptainId = safeCaptainId;
          finalVcId = safeVcId;
        }
        if (mode === "safe" || modeDowngraded) {
          let seededRandom2 = function(seed, index) {
            let hash = 0;
            const str = seed + index;
            for (let i = 0; i < str.length; i++) {
              hash = (hash << 5) - hash + str.charCodeAt(i);
              hash |= 0;
            }
            return Math.abs(hash) / 2147483647;
          };
          var seededRandom = seededRandom2;
          const clickSeed = userId + Date.now().toString();
          const pickedIds = new Set(finalTeam.map((p) => p.id));
          const swapCandidates = finalTeam.filter(
            (p) => p.careerAvg < 20 || (historicalCache.get(p.name)?.matches_played ?? 0) < 10
          );
          let safeSwaps = 0;
          for (let i = 0; i < swapCandidates.length; i++) {
            if (safeSwaps >= 3) break;
            if (seededRandom2(clickSeed, i) > 0.3) continue;
            const out = swapCandidates[i];
            const creditsWithout = finalTeam.reduce((s, p) => s + (p.id === out.id ? 0 : p.credits), 0);
            const twc = {};
            const rwc = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
            for (const p of finalTeam) {
              if (p.id === out.id) continue;
              twc[p.teamShort] = (twc[p.teamShort] || 0) + 1;
              rwc[p.role]++;
            }
            const alt = scored.find(
              (p) => !pickedIds.has(p.id) && p.role === out.role && (twc[p.teamShort] || 0) < MAX_FROM_ONE_TEAM && creditsWithout + p.credits <= CREDIT_CAP && rwc[p.role] < ROLE_LIMITS[p.role].max
            );
            if (alt) {
              const idx = finalTeam.findIndex((p) => p.id === out.id);
              finalTeam = [...finalTeam];
              finalTeam[idx] = alt;
              pickedIds.delete(out.id);
              pickedIds.add(alt.id);
              safeSwaps++;
            }
          }
        }
        const finalProjection = calcTeamProjection2(finalTeam, finalCaptainId, finalVcId);
        const highCount = scored.filter((p) => matchPlayerToHistorical(p.name, historicalCache, dbMappings, p.teamShort).confidence === "high").length;
        console.log(`[AI] matchId=${matchId} mode=${mode} downgraded=${modeDowngraded} reason="${downgradeReason}" chalk="${chalkDropped}" replacement="${replacementChosen}" swaps=${swapsApplied} safeProjection=${safeProjection.toFixed(1)} finalProjection=${finalProjection.toFixed(1)} guardrailRatio=${(finalProjection / safeProjection).toFixed(2)} ownership=${safeOwnership?.source ?? "n/a"} teamCount=${safeOwnership?.teamCount ?? 0} highConf=${highCount}`);
        return res.json({
          fallback: false,
          playerIds: finalTeam.map((p) => p.id),
          captainId: finalCaptainId,
          viceCaptainId: finalVcId,
          reason: `AI Pick: ${highCount} players matched${formMap.size > 0 ? " + 2026 form" : ""}${h2hMap.size > 0 ? " + H2H data" : ""}`
        });
      } catch (err) {
        console.error("AI team error:", err);
        return res.status(500).json({ message: "AI team pick failed" });
      }
    }
  );
  app2.get(
    "/api/matches/:id/smart-pick",
    isAuthenticated,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const matchPlayers = await storage.getPlayersForMatch(matchId);
        if (matchPlayers.length < 22) {
          return res.status(400).json({ message: "Not enough players" });
        }
        const tournamentTotals = /* @__PURE__ */ new Map();
        if (match.tournamentName) {
          const rows = await db.select({
            name: players.name,
            teamShort: players.teamShort,
            total: sql3`CAST(SUM(${players.points}) AS INTEGER)`
          }).from(players).innerJoin(matches, eq2(players.matchId, matches.id)).where(
            and2(
              eq2(matches.tournamentName, match.tournamentName),
              eq2(matches.status, "completed"),
              sql3`${players.points} > 0`
            )
          ).groupBy(players.name, players.teamShort);
          for (const row of rows) {
            tournamentTotals.set(`${row.name}|${row.teamShort}`, row.total);
          }
        }
        const h2hAverages = /* @__PURE__ */ new Map();
        const h2hMatches = await db.select({ id: matches.id }).from(matches).where(
          and2(
            eq2(matches.status, "completed"),
            sql3`(
                (${matches.team1Short} = ${match.team1Short} AND ${matches.team2Short} = ${match.team2Short})
                OR
                (${matches.team1Short} = ${match.team2Short} AND ${matches.team2Short} = ${match.team1Short})
              )`,
            sql3`${matches.id} != ${matchId}`
          )
        );
        if (h2hMatches.length > 0) {
          const h2hMatchIds = h2hMatches.map((m) => m.id);
          const h2hRows = await db.select({
            name: players.name,
            teamShort: players.teamShort,
            avg: sql3`CAST(AVG(${players.points}) AS FLOAT)`
          }).from(players).where(
            and2(
              sql3`${players.matchId} = ANY(ARRAY[${sql3.join(h2hMatchIds.map((id) => sql3`${id}`), sql3`, `)}]::text[])`,
              sql3`${players.points} > 0`
            )
          ).groupBy(players.name, players.teamShort);
          for (const row of h2hRows) {
            h2hAverages.set(`${row.name}|${row.teamShort}`, row.avg);
          }
        }
        const lastXIBonus = /* @__PURE__ */ new Map();
        for (const teamShort of [match.team1Short, match.team2Short]) {
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
              if (p.isPlayingXI && p.teamShort === teamShort) {
                lastXIBonus.set(`${p.name}|${p.teamShort}`, 20);
              }
            }
          }
        }
        const scored = matchPlayers.map((p) => {
          const key = `${p.name}|${p.teamShort}`;
          const tournPts = tournamentTotals.get(key) ?? 0;
          const h2hPts = h2hAverages.get(key) ?? 0;
          const xiBonus = lastXIBonus.get(key) ?? 0;
          const smartScore = 0.6 * tournPts + 0.4 * h2hPts + xiBonus;
          return { ...p, smartScore };
        }).sort((a, b) => b.smartScore - a.smartScore);
        const ROLE_LIMITS = {
          WK: { min: 1, max: 4 },
          BAT: { min: 1, max: 6 },
          AR: { min: 1, max: 6 },
          BOWL: { min: 1, max: 6 }
        };
        const MAX_FROM_ONE_TEAM = 6;
        const CREDIT_CAP = 100;
        const picked = [];
        const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
        const teamCounts = {};
        let credits = 0;
        for (const role of ["WK", "BAT", "AR", "BOWL"]) {
          const best = scored.find(
            (p) => p.role === role && !picked.find((x) => x.id === p.id) && (teamCounts[p.teamShort] || 0) < MAX_FROM_ONE_TEAM && credits + p.credits <= CREDIT_CAP
          );
          if (best) {
            picked.push(best);
            roleCounts[best.role]++;
            teamCounts[best.teamShort] = (teamCounts[best.teamShort] || 0) + 1;
            credits += best.credits;
          }
        }
        for (const p of scored) {
          if (picked.length >= 11) break;
          if (picked.find((x) => x.id === p.id)) continue;
          if (roleCounts[p.role] >= ROLE_LIMITS[p.role].max) continue;
          if ((teamCounts[p.teamShort] || 0) >= MAX_FROM_ONE_TEAM) continue;
          if (credits + p.credits > CREDIT_CAP) continue;
          picked.push(p);
          roleCounts[p.role]++;
          teamCounts[p.teamShort] = (teamCounts[p.teamShort] || 0) + 1;
          credits += p.credits;
        }
        if (picked.length !== 11) {
          return res.status(422).json({ message: "Could not build a valid smart team \u2014 falling back to random" });
        }
        const pickedIds = new Set(picked.map((p) => p.id));
        const nonCorePicks = picked.filter((p) => !lastXIBonus.has(`${p.name}|${p.teamShort}`));
        let swapsApplied = 0;
        for (const outPlayer of nonCorePicks) {
          if (swapsApplied >= 3) break;
          if (Math.random() < 0.3) continue;
          const creditsWithout = picked.reduce((s, p) => s + (p.id === outPlayer.id ? 0 : p.credits), 0);
          const teamCountsWithout = {};
          for (const p of picked) {
            if (p.id === outPlayer.id) continue;
            teamCountsWithout[p.teamShort] = (teamCountsWithout[p.teamShort] || 0) + 1;
          }
          const roleCountsWithout = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
          for (const p of picked) {
            if (p.id === outPlayer.id) continue;
            roleCountsWithout[p.role]++;
          }
          const ROLE_LIMITS_V = {
            WK: { min: 1, max: 4 },
            BAT: { min: 1, max: 6 },
            AR: { min: 1, max: 6 },
            BOWL: { min: 1, max: 6 }
          };
          const alternative = scored.find(
            (p) => !pickedIds.has(p.id) && p.role === outPlayer.role && (teamCountsWithout[p.teamShort] || 0) < 6 && creditsWithout + p.credits <= 100 && (roleCountsWithout[p.role] || 0) < ROLE_LIMITS_V[p.role].max && (roleCountsWithout[p.role] || 0) >= ROLE_LIMITS_V[p.role].min - 1
          );
          if (alternative) {
            const idx = picked.findIndex((p) => p.id === outPlayer.id);
            picked[idx] = alternative;
            pickedIds.delete(outPlayer.id);
            pickedIds.add(alternative.id);
            swapsApplied++;
          }
        }
        const hasTournamentData = tournamentTotals.size > 0;
        const matchup = `${match.team1Short} vs ${match.team2Short}`;
        return res.json({
          playerIds: picked.map((p) => p.id),
          reason: h2hMatches.length > 0 && hasTournamentData ? `Smart pick: IPL 2026 form + ${h2hMatches.length} previous ${matchup} match${h2hMatches.length > 1 ? "es" : ""}` : hasTournamentData ? `Smart pick: IPL 2026 form only (first time these teams meet this season)` : `Smart pick: based on player credits (first matches of the season \u2014 no form data yet)`
        });
      } catch (err) {
        console.error("Smart pick error:", err);
        return res.status(500).json({ message: "Smart pick failed" });
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
        const { matchId, name, playerIds, captainId, viceCaptainId, primaryImpactId, backupImpactId, captainType, vcType, invisibleMode, backupXiPlayer1Id, backupXiPlayer2Id } = req.body;
        console.log("Receiving Team:", JSON.stringify({ matchId, name, playerIds, captainId, viceCaptainId, primaryImpactId, backupImpactId, captainType, vcType }));
        console.log("Player IDs count:", playerIds?.length, "IDs:", playerIds);
        const match = await storage.getMatch(matchId);
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }
        const now = /* @__PURE__ */ new Date();
        if (match.status === "completed") {
          return res.status(400).json({ message: "Match has already started" });
        }
        if (!isEntryOpen(match, now.getTime())) {
          return res.status(400).json({ message: "Entry deadline has passed" });
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
        const reqCaptainType = captainType === "impact_slot" ? "impact_slot" : "player";
        const reqVcType = vcType === "impact_slot" ? "impact_slot" : "player";
        const matchImpactOn = match.impactFeaturesEnabled === true;
        const captainOnSlot = matchImpactOn && reqCaptainType === "impact_slot";
        const vcOnSlot = matchImpactOn && reqVcType === "impact_slot";
        if (captainOnSlot && vcOnSlot) {
          return res.status(400).json({ message: "Both Captain and Vice-Captain cannot be on the Impact Slot." });
        }
        if (!captainOnSlot && !captainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain required" });
        }
        if (!vcOnSlot && !viceCaptainId) {
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
        if (validCaptainType === "player" && captainId && !playerIds.includes(captainId)) {
          return res.status(400).json({ message: "Captain must be one of your selected 11 players." });
        }
        if (validVcType === "player" && viceCaptainId && !playerIds.includes(viceCaptainId)) {
          return res.status(400).json({ message: "Vice-Captain must be one of your selected 11 players." });
        }
        if (validCaptainType === "player" && validVcType === "player" && captainId && viceCaptainId && captainId === viceCaptainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain cannot be the same player." });
        }
        let validBackupXi1 = null;
        let validBackupXi2 = null;
        if (!match.playingXIManual) {
          const impactSet = new Set([validPrimaryImpactId, validBackupImpactId].filter(Boolean));
          for (const [slot, rawId] of [["Backup 1", backupXiPlayer1Id], ["Backup 2", backupXiPlayer2Id]]) {
            if (!rawId) continue;
            if (playerIds.includes(rawId)) {
              return res.status(400).json({ message: `${slot} cannot be one of your main XI players.` });
            }
            if (impactSet.has(rawId)) {
              return res.status(400).json({ message: `${slot} cannot overlap with your Impact picks.` });
            }
            if (!playerMap.get(rawId)) {
              return res.status(400).json({ message: `${slot} player not found in this match.` });
            }
          }
          if (backupXiPlayer1Id && backupXiPlayer2Id && backupXiPlayer1Id === backupXiPlayer2Id) {
            return res.status(400).json({ message: "Backup 1 and Backup 2 must be different players." });
          }
          validBackupXi1 = backupXiPlayer1Id || null;
          validBackupXi2 = backupXiPlayer2Id || null;
        }
        const playerIdSet = new Set(playerIds);
        if (validBackupXi1 && playerIdSet.has(validBackupXi1)) {
          validBackupXi1 = null;
        }
        if (validBackupXi2 && playerIdSet.has(validBackupXi2)) {
          validBackupXi2 = null;
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
          invisibleMode: useInvisible,
          backupXiPlayer1Id: validBackupXi1,
          backupXiPlayer2Id: validBackupXi2
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
        if (match.status === "completed") {
          return res.status(400).json({ message: "Match has already started" });
        }
        if (!isEntryOpen(match, now.getTime())) {
          return res.status(400).json({ message: "Entry deadline has passed" });
        }
        const { playerIds, captainId, viceCaptainId, primaryImpactId, backupImpactId, captainType, vcType, invisibleMode, backupXiPlayer1Id, backupXiPlayer2Id } = req.body;
        if (!playerIds || playerIds.length !== 11) {
          return res.status(400).json({ message: "Must select exactly 11 players" });
        }
        const reqCaptainTypeU = captainType === "impact_slot" ? "impact_slot" : "player";
        const reqVcTypeU = vcType === "impact_slot" ? "impact_slot" : "player";
        const matchImpactOnU = match.impactFeaturesEnabled === true;
        const captainOnSlotU = matchImpactOnU && reqCaptainTypeU === "impact_slot";
        const vcOnSlotU = matchImpactOnU && reqVcTypeU === "impact_slot";
        if (captainOnSlotU && vcOnSlotU) {
          return res.status(400).json({ message: "Both Captain and Vice-Captain cannot be on the Impact Slot." });
        }
        if (!captainOnSlotU && !captainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain required" });
        }
        if (!vcOnSlotU && !viceCaptainId) {
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
        if (validCaptainType === "player" && captainId && !playerIds.includes(captainId)) {
          return res.status(400).json({ message: "Captain must be one of your selected 11 players." });
        }
        if (validVcType === "player" && viceCaptainId && !playerIds.includes(viceCaptainId)) {
          return res.status(400).json({ message: "Vice-Captain must be one of your selected 11 players." });
        }
        if (validCaptainType === "player" && validVcType === "player" && captainId && viceCaptainId && captainId === viceCaptainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain cannot be the same player." });
        }
        let validBackupXi1Edit = team.backupXiPlayer1Id ?? null;
        let validBackupXi2Edit = team.backupXiPlayer2Id ?? null;
        if (!match.playingXIManual) {
          const impactSetE = new Set([validPrimaryImpactId, validBackupImpactId].filter(Boolean));
          const playerMapE = new Map((await storage.getPlayersForMatch(team.matchId)).map((p) => [p.id, p]));
          for (const [slot, rawId] of [["Backup 1", backupXiPlayer1Id], ["Backup 2", backupXiPlayer2Id]]) {
            if (rawId === void 0) continue;
            if (!rawId) {
              continue;
            }
            if (playerIds.includes(rawId)) return res.status(400).json({ message: `${slot} cannot be one of your main XI players.` });
            if (impactSetE.has(rawId)) return res.status(400).json({ message: `${slot} cannot overlap with your Impact picks.` });
            if (!playerMapE.get(rawId)) return res.status(400).json({ message: `${slot} player not found in this match.` });
          }
          if (backupXiPlayer1Id !== void 0) validBackupXi1Edit = backupXiPlayer1Id || null;
          if (backupXiPlayer2Id !== void 0) validBackupXi2Edit = backupXiPlayer2Id || null;
          if (validBackupXi1Edit && validBackupXi2Edit && validBackupXi1Edit === validBackupXi2Edit) {
            return res.status(400).json({ message: "Backup 1 and Backup 2 must be different players." });
          }
        }
        const playerIdSetE = new Set(playerIds);
        if (validBackupXi1Edit && playerIdSetE.has(validBackupXi1Edit)) {
          validBackupXi1Edit = null;
        }
        if (validBackupXi2Edit && playerIdSetE.has(validBackupXi2Edit)) {
          validBackupXi2Edit = null;
        }
        const finalImpactSetE = new Set(
          [validPrimaryImpactId, validBackupImpactId].filter(Boolean)
        );
        if (validBackupXi1Edit && finalImpactSetE.has(validBackupXi1Edit)) {
          return res.status(400).json({ message: "Backup 1 overlaps with your Impact picks. Please update or clear Backup 1 before saving." });
        }
        if (validBackupXi2Edit && finalImpactSetE.has(validBackupXi2Edit)) {
          return res.status(400).json({ message: "Backup 2 overlaps with your Impact picks. Please update or clear Backup 2 before saving." });
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
          invisibleMode: useInvisible,
          backupXiPlayer1Id: validBackupXi1Edit,
          backupXiPlayer2Id: validBackupXi2Edit
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
        if (match.status === "completed") {
          return res.status(400).json({ message: "Match has already started" });
        }
        if (!isEntryOpen(match, Date.now())) {
          return res.status(400).json({ message: "Entry deadline has passed" });
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
        const isRevealed = match.status === "live" || match.status === "completed" || match.status === "delayed";
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
          message: "Match sync triggered successfully"
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
        const isIPL = (name, league) => {
          const n = (name + " " + league).toLowerCase();
          return n.includes("indian premier league") || n.includes(" ipl") || n.includes("ipl ");
        };
        const [apiMatches, seriesList, existingMatches] = await Promise.all([
          fetchUpcomingMatches(),
          fetchSeriesList(),
          storage.getAllMatches()
        ]);
        const existingIds = new Set(existingMatches.map((m) => m.externalId).filter(Boolean));
        const now = Date.now();
        const ms30d = 30 * 24 * 60 * 60 * 1e3;
        const qualifyingSeries = seriesList.filter((s) => {
          if (!s.startDate) return false;
          if (isIPL(s.name, "")) return false;
          const t = new Date(s.startDate).getTime();
          return t >= now - ms30d && t <= now + ms30d;
        }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).slice(0, 10);
        console.log(`Browse API Matches: ${qualifyingSeries.length} qualifying non-IPL series to probe:`, qualifyingSeries.map((s) => s.name));
        const seriesFixtureSets = await Promise.all(
          qualifyingSeries.map((s) => fetchSeriesMatches(s.id, s.name))
        );
        const combined = /* @__PURE__ */ new Map();
        for (const m of apiMatches) {
          if (m.externalId) combined.set(m.externalId, m);
        }
        for (const fixtures of seriesFixtureSets) {
          for (const m of fixtures) {
            if (m.externalId && !combined.has(m.externalId)) {
              combined.set(m.externalId, m);
            }
          }
        }
        console.log(`Browse API Matches: ${apiMatches.length} match-level + ${[...combined.values()].length - apiMatches.filter((m) => m.externalId && combined.has(m.externalId)).length} series-only = ${combined.size} total before filters`);
        const ms7d = 7 * 24 * 60 * 60 * 1e3;
        const filtered = [...combined.values()].filter((m) => {
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
          return res.status(400).json({ message: `Cannot delete this match \u2014 ${teams.length} user team${teams.length === 1 ? "" : "s"} exist. Please use Void Match instead.` });
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
        const playersToUpsert = playerList.map((p) => ({
          matchId,
          externalId: p.externalId || void 0,
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
        await storage.upsertPlayersForMatch(matchId, playersToUpsert);
        const allAfter = await storage.getPlayersForMatch(matchId);
        const byTeam = {};
        for (const p of allAfter) {
          byTeam[p.teamShort] = (byTeam[p.teamShort] ?? 0) + 1;
        }
        return res.json({
          message: `Upserted ${playersToUpsert.length} players`,
          totalPlayers: allAfter.length,
          byTeam
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
        const allMatchPlayers = await storage.getPlayersForMatch(matchId);
        const playerIdSet = new Set(playerIds);
        const teamCounts = {};
        for (const p of allMatchPlayers) {
          if (playerIdSet.has(p.id) && p.teamShort) {
            teamCounts[p.teamShort] = (teamCounts[p.teamShort] || 0) + 1;
          }
        }
        const teams = Object.keys(teamCounts);
        for (const team of teams) {
          if (teamCounts[team] !== 11) {
            return res.status(400).json({
              message: `${team} must have exactly 11 XI players (got ${teamCounts[team]})`
            });
          }
        }
        if (teams.length !== 2) {
          return res.status(400).json({
            message: `XI must include players from exactly 2 teams (got ${teams.length})`
          });
        }
        const updated = await storage.markPlayingXIByIds(matchId, playerIds);
        await storage.updateMatch(matchId, { playingXIManual: true });
        const recalcAfterManualXI = globalThis.__recalculateTeamTotals;
        if (recalcAfterManualXI) await recalcAfterManualXI(matchId, `${match.team1Short} vs ${match.team2Short}`);
        try {
          const { notifyXIAndImpactUpdated: notifyXIAndImpactUpdated2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
          const notifyMatch = await storage.getMatch(req.params.id);
          if (notifyMatch) {
            await notifyXIAndImpactUpdated2(notifyMatch.team1Short, notifyMatch.team2Short);
          }
        } catch (notifyErr) {
          console.error("[FCM] XI notification failed silently:", notifyErr);
        }
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
        const impactPlayerRaw = prevPlayers.find((p) => p.isImpactPlayer && !p.isPlayingXI && p.teamShort === teamShort);
        const impactPlayerName = impactPlayerRaw?.name ?? null;
        return res.json({
          found: true,
          matchId: prevMatch.id,
          matchLabel: `${prevMatch.team1Short} vs ${prevMatch.team2Short}`,
          playerNames,
          count: playerNames.length,
          impactPlayerName
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
  app2.get(
    "/api/debug/cricbuzz-raw",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { default: cricbuzzFetchRaw } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports)).then((m) => ({
          default: async (path2) => {
            const url = `https://cricbuzz-cricket.p.rapidapi.com${path2}`;
            const resp = await fetch(url, {
              headers: {
                "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com",
                "x-rapidapi-key": process.env.RAPIDAPI_KEY || ""
              }
            });
            return resp.json();
          }
        }));
        const matchId = req.query.matchId || "149618";
        const [scard, leanback] = await Promise.all([
          cricbuzzFetchRaw(`/mcenter/v1/${matchId}/scard`),
          cricbuzzFetchRaw(`/mcenter/v1/${matchId}/leanback`)
        ]);
        const innings = (scard.scorecard || []).map((inn) => ({
          inningsId: inn.inningsId,
          batCount: (inn.batsman || []).length,
          bowlCount: (inn.bowling || []).length,
          firstBowler: (inn.bowling || [])[0] || null,
          firstBatter: (inn.batsman || [])[0] || null
        }));
        return res.json({ matchId, innings, leanbackKeys: Object.keys(leanback.miniscore || {}), rawScard: scard, rawLeanback: leanback });
      } catch (e) {
        return res.status(500).json({ error: e.message });
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
        const { matchId, tournamentName, stake, mode, penaltyUserIds } = req.body;
        if (!matchId || !tournamentName || !stake) {
          return res.status(400).json({ message: "matchId, tournamentName, and stake are required" });
        }
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (match.status !== "completed") {
          return res.status(400).json({ message: "Match must be COMPLETED before processing pot" });
        }
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        if (allTeams.length < 2) {
          return res.status(400).json({ message: `Not enough players. Found ${allTeams.length} team(s), need at least 2.` });
        }
        const entryStake = Number(stake) || 30;
        const potMode = mode === "entries_plus_penalty" ? "entries_plus_penalty" : "entries_only";
        const rawPenaltyIds = Array.isArray(penaltyUserIds) ? penaltyUserIds : [];
        const contestUserIds = new Set(allTeams.map((t) => t.userId));
        const validatedPenaltyIds = rawPenaltyIds.filter((uid) => !contestUserIds.has(uid));
        const penaltyCount = potMode === "entries_plus_penalty" ? validatedPenaltyIds.length : 0;
        const uniquePointTiers = [...new Set(allTeams.map((t) => t.totalPoints || 0))].sort((a, b) => b - a);
        const rank1Points = uniquePointTiers[0] ?? 0;
        const rank2Points = uniquePointTiers[1] ?? null;
        const winningTeams = allTeams.filter((t) => (t.totalPoints || 0) === rank1Points);
        const neutralTeams = rank2Points !== null ? allTeams.filter((t) => (t.totalPoints || 0) === rank2Points) : [];
        const losingTeams = allTeams.filter((t) => (t.totalPoints || 0) < (rank2Points ?? rank1Points));
        const losersContribution = losingTeams.length * entryStake;
        const penaltyContribution = penaltyCount * entryStake;
        const totalPot = losersContribution + penaltyContribution;
        const winnerPointsEach = totalPot > 0 && winningTeams.length > 0 ? Math.round(totalPot / winningTeams.length) : 0;
        if (match.potProcessed) {
          await storage.deleteLedgerEntriesForMatch(matchId);
        }
        const userMap = /* @__PURE__ */ new Map();
        for (const t of allTeams) {
          if (!userMap.has(t.userId)) {
            const u = await storage.getUser(t.userId);
            userMap.set(t.userId, u?.teamName || u?.username || "Unknown");
          }
        }
        for (const uid of validatedPenaltyIds) {
          if (!userMap.has(uid)) {
            const u = await storage.getUser(uid);
            userMap.set(uid, u?.teamName || u?.username || "Unknown");
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
        if (penaltyCount > 0) {
          for (const uid of validatedPenaltyIds) {
            await storage.createLedgerEntry({
              userId: uid,
              userName: userMap.get(uid) || "Unknown",
              matchId,
              tournamentName,
              pointsChange: -entryStake
            });
          }
        }
        if (winnerPointsEach > 0) {
          for (const t of winningTeams) {
            await storage.createLedgerEntry({
              userId: t.userId,
              userName: userMap.get(t.userId) || "Unknown",
              matchId,
              tournamentName,
              pointsChange: winnerPointsEach
            });
          }
        }
        await storage.updateMatch(matchId, {
          tournamentName,
          entryStake,
          potProcessed: true,
          potMode,
          potPenaltyUserIds: potMode === "entries_plus_penalty" ? validatedPenaltyIds : []
        });
        console.log(`[Tournament Pot] ${potMode} | ${match.team1Short} vs ${match.team2Short}: Rank1=${winningTeams.length} (+${winnerPointsEach}), Rank2=${neutralTeams.length} neutral, Rank3+=${losingTeams.length} (-${entryStake}), penalty=${penaltyCount} (-${entryStake} each), totalPot=${totalPot}`);
        return res.json({
          message: "Pot processed successfully",
          mode: potMode,
          winners: winningTeams.length,
          neutral: neutralTeams.length,
          losers: losingTeams.length,
          penaltyUsers: penaltyCount,
          winnerPoints: winnerPointsEach,
          loserPoints: losingTeams.length > 0 ? -entryStake : 0,
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
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1e3);
        const completed = allMatches.filter(
          (m) => m.status === "completed" && new Date(m.startTime) >= tenDaysAgo
        );
        const withParticipation = [];
        for (const m of completed) {
          const teams = await storage.getAllTeamsForMatch(m.id);
          if (teams.length > 0) {
            withParticipation.push({
              id: m.id,
              team1Short: m.team1Short,
              team2Short: m.team2Short,
              startTime: m.startTime,
              teamCount: teams.length,
              potProcessed: m.potProcessed,
              potMode: m.potMode || "entries_only",
              entrantUserIds: [...new Set(teams.map((t) => t.userId))]
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
    "/api/admin/users",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        const allUsers = await storage.getAllUsers();
        return res.json({
          users: allUsers.map((u) => ({
            id: u.id,
            username: u.username,
            teamName: u.teamName
          }))
        });
      } catch (err) {
        console.error("Admin users error:", err);
        return res.status(500).json({ message: "Failed to fetch users" });
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
  app2.get(
    "/api/admin/user-lookup",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const username = (req.query.username || "").toLowerCase().trim();
        if (!username) return res.status(400).json({ message: "Provide ?username=xxx" });
        const allUsers = await db.select({ id: users.id, username: users.username, teamName: users.teamName }).from(users).where(sql3`LOWER(${users.username}) = ${username} OR LOWER(${users.teamName}) = ${username}`);
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
          if (adminStatus) {
            for (const pid of playerIds) {
              await storage.updatePlayer(pid, {
                isPlayingXI: adminStatus === "playing_xi",
                isImpactPlayer: adminStatus === "impact_sub"
              });
            }
          }
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
        if (adminStatus === "impact_sub") {
          const allPlayers = await storage.getPlayersForMatch(matchId);
          const targetPlayer = allPlayers.find((p) => p.id === playerId);
          if (targetPlayer) {
            const allStatuses = await storage.getMatchPlayerStatuses(matchId);
            const teamPlayerIds = new Set(
              allPlayers.filter((p) => p.teamShort === targetPlayer.teamShort).map((p) => p.id)
            );
            const teamImpactCount = allStatuses.filter(
              (s) => s.adminStatus === "impact_sub" && teamPlayerIds.has(s.playerId) && s.playerId !== playerId
            ).length;
            if (teamImpactCount >= 5) {
              return res.status(400).json({
                message: `${targetPlayer.teamShort} already has 5 impact players. Remove one before adding another.`
              });
            }
          }
        }
        const data = { matchId, playerId, sourceType: "admin" };
        if (adminStatus) data.adminStatus = adminStatus;
        if (typeof officialImpactSubUsed === "boolean") data.officialImpactSubUsed = officialImpactSubUsed;
        const status = await storage.upsertMatchPlayerStatus(data);
        if (officialImpactSubUsed === true) {
          await storage.updatePlayer(playerId, { isImpactPlayer: true });
          try {
            const recalc = globalThis.__recalculateTeamTotals;
            if (recalc) await recalc(matchId, "impact sub activated");
          } catch (e) {
            console.error("[Impact] Recalc after toggle failed:", e);
          }
        }
        if (adminStatus) {
          await storage.updatePlayer(playerId, {
            isPlayingXI: adminStatus === "playing_xi",
            isImpactPlayer: adminStatus === "impact_sub"
          });
        }
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
        if (unlock === true && match.firstScorecardAt) {
          const cutoff = new Date(match.firstScorecardAt).getTime() + 6 * 6e4;
          if (Date.now() >= cutoff) {
            return res.status(403).json({
              message: "Cannot unlock: scoring has been live for more than 6 minutes. This window is permanently closed."
            });
          }
        }
        console.log(`[Admin] Match ${match.id} ${unlock ? "unlocked" : "locked"} by admin at ${(/* @__PURE__ */ new Date()).toISOString()}`);
        await storage.updateMatch(matchId, {
          adminUnlockOverride: unlock,
          unlockedAt: unlock ? /* @__PURE__ */ new Date() : null
        });
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
        if (winner) {
          await storage.updateMatch(matchId, { status: "completed" });
        } else if (match.status === "completed") {
          await storage.updateMatch(matchId, { status: "live" });
        }
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
    "/api/admin/matches/:id/apply-winning-bonus",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (!match.officialWinner) {
          return res.status(400).json({ message: "Set the official winner first before applying the winning bonus" });
        }
        const WINNING_BONUS = 4;
        const updated = await db.update(players).set({ points: sql3`${players.points} + ${WINNING_BONUS}` }).where(
          and2(
            eq2(players.matchId, matchId),
            eq2(players.teamShort, match.officialWinner),
            eq2(players.isPlayingXI, true)
          )
        ).returning({ id: players.id, name: players.name });
        const recalcFn = globalThis.__recalculateTeamTotals;
        if (recalcFn) {
          await recalcFn(matchId, `${match.team1Short} vs ${match.team2Short}`);
        }
        await storage.createAuditLog({
          adminUserId: req.session.userId,
          actionType: "apply_winning_bonus",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ winner: match.officialWinner, playersUpdated: updated.length, bonusPerPlayer: WINNING_BONUS })
        });
        return res.json({
          message: `+${WINNING_BONUS} winning bonus applied to ${updated.length} players (${match.officialWinner} Playing XI)`,
          playersUpdated: updated.length,
          players: updated.map((p) => p.name)
        });
      } catch (err) {
        console.error("Apply winning bonus error:", err);
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
  app2.get("/api/admin/match-health", isAdmin, async (req, res) => {
    try {
      const allMatches = await storage.getAllMatches();
      const now = Date.now();
      const liveAndRecent = allMatches.filter((m) => {
        const isIPL = (m.league || "").toLowerCase().includes("indian premier league") || (m.league || "").toLowerCase().includes("ipl");
        const isRelevant = m.status === "live" || m.status === "completed" || m.status === "delayed" || m.status === "upcoming";
        const withinWindow = new Date(m.startTime).getTime() >= now - 48 * 60 * 60 * 1e3;
        return isIPL && isRelevant && withinWindow;
      }).slice(0, 10);
      const health = await Promise.all(liveAndRecent.map(async (m) => {
        const players2 = await storage.getPlayersForMatch(m.id);
        const teams = await storage.getAllTeamsForMatch(m.id);
        const xiPlayers = players2.filter((p) => p.isPlayingXI === true);
        const impactPlayers = players2.filter((p) => p.isImpactPlayer === true);
        const playersWithPoints = players2.filter((p) => (p.points || 0) > 0);
        const playersWithFullPoints = players2.filter((p) => (p.points || 0) > 4);
        let activeImpactName = null;
        for (const p of impactPlayers) {
          const status = await storage.getMatchPlayerStatus(m.id, p.id);
          if (status?.officialImpactSubUsed) {
            activeImpactName = p.name;
            break;
          }
        }
        return {
          matchId: m.id,
          label: `${m.team1Short} vs ${m.team2Short}`,
          status: m.status,
          startTime: m.startTime,
          lastSyncAt: m.lastSyncAt || null,
          totalPlayers: players2.length,
          xiSet: xiPlayers.length,
          impactCandidates: impactPlayers.length,
          activeImpactSub: activeImpactName,
          playersWithPoints: playersWithPoints.length,
          playersWithFullPoints: playersWithFullPoints.length,
          totalTeams: teams.length,
          impactEnabled: m.impactFeaturesEnabled === true,
          scoreString: m.scoreString || null
        };
      }));
      return res.json({ health });
    } catch (err) {
      console.error("Match health error:", err);
      return res.status(500).json({ message: "Failed to fetch match health" });
    }
  });
  app2.post(
    "/api/admin/matches/:id/rescore",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const matchLabel = `${match.team1Short} vs ${match.team2Short}`;
        const updateLiveScoreFn = globalThis.__updateLiveScore;
        const updateFantasyPointsFn = globalThis.__updateFantasyPoints;
        const recalcFn = globalThis.__recalculateTeamTotals;
        if (!updateLiveScoreFn || !updateFantasyPointsFn || !recalcFn) {
          return res.status(500).json({ message: "Scoring engine not initialized" });
        }
        const { pointsMap, namePointsMap } = await updateLiveScoreFn(match);
        if (pointsMap.size === 0 && namePointsMap.size === 0) {
          return res.status(422).json({ message: "No scorecard data available for this match \u2014 cannot re-score" });
        }
        const updatedCount = await updateFantasyPointsFn(
          matchId,
          matchLabel,
          pointsMap,
          namePointsMap,
          true
          /* matchEnded=true, bypasses protection */
        );
        await recalcFn(matchId, matchLabel);
        await storage.createAuditLog({
          adminUserId: req.session.userId,
          actionType: "rescore",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({ playersUpdated: updatedCount })
        });
        return res.json({ message: `Re-scored ${updatedCount} players and recalculated all teams`, playersUpdated: updatedCount });
      } catch (err) {
        console.error("Re-score error:", err);
        return res.status(500).json({ message: "Re-score failed: " + err.message });
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
    "/api/admin/matches/:id/absorb-duplicate",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const original = await storage.getMatch(matchId);
        if (!original) return res.status(404).json({ message: "Match not found" });
        const allMatches = await storage.getAllMatches();
        const origDay = new Date(original.startTime).toISOString().split("T")[0];
        const duplicate = allMatches.find((m) => {
          if (m.id === matchId) return false;
          const mDay = new Date(m.startTime).toISOString().split("T")[0];
          if (mDay !== origDay) return false;
          return m.team1Short === original.team1Short && m.team2Short === original.team2Short || m.team1Short === original.team2Short && m.team2Short === original.team1Short;
        });
        if (!duplicate) {
          return res.status(404).json({ message: "No duplicate found for this match on the same day" });
        }
        const updates = {};
        if (duplicate.externalId) updates.externalId = duplicate.externalId;
        if (duplicate.status && duplicate.status !== original.status) {
          updates.status = duplicate.status;
        }
        if (duplicate.statusNote) updates.statusNote = duplicate.statusNote;
        await storage.updateMatch(matchId, updates);
        await storage.updateMatch(duplicate.id, { externalId: null });
        await storage.createAuditLog({
          adminUserId: req.session.userId,
          actionType: "absorb_duplicate",
          entityType: "match",
          entityId: matchId,
          matchId,
          metadata: JSON.stringify({
            duplicateMatchId: duplicate.id,
            absorbedExternalId: duplicate.externalId,
            absorbedStatus: duplicate.status
          })
        });
        return res.json({
          message: `Fixed: externalId + status copied from duplicate. Duplicate match ID: ${duplicate.id}`,
          duplicateMatchId: duplicate.id,
          absorbedExternalId: duplicate.externalId,
          absorbedStatus: duplicate.status
        });
      } catch (err) {
        console.error("Absorb duplicate error:", err);
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
  app2.get(
    "/api/admin/players/export",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      try {
        const allPlayers = await db.select({
          playerId: players.id,
          playerName: players.name,
          teamName: players.team,
          teamShort: players.teamShort,
          role: players.role,
          credits: players.credits,
          points: players.points,
          selectedBy: players.selectedBy,
          externalId: players.externalId,
          isImpactPlayer: players.isImpactPlayer,
          isPlayingXI: players.isPlayingXI
        }).from(players).orderBy(players.team, players.name);
        const playersByTeam = /* @__PURE__ */ new Map();
        for (const player of allPlayers) {
          if (!playersByTeam.has(player.teamName)) {
            playersByTeam.set(player.teamName, []);
          }
          playersByTeam.get(player.teamName).push(player);
        }
        const summary = {
          totalPlayers: allPlayers.length,
          totalTeams: playersByTeam.size,
          teamBreakdown: Array.from(playersByTeam.entries()).map(([team, players2]) => ({
            team,
            count: players2.length
          })),
          players: allPlayers
        };
        return res.json(summary);
      } catch (err) {
        console.error("Player export error:", err);
        return res.status(500).json({ message: "Failed to export players" });
      }
    }
  );
  const REPLACEMENT_PLAYERS = [
    { externalId: "9f2db0cf-2b7a-4722-9134-211f612102b9", name: "Dasun Shanaka", team: "Rajasthan Royals", teamShort: "RR", role: "AR", credits: 8.5 },
    { externalId: "fbde22e3-60f9-4f4c-b26a-fad73644cbee", name: "Saurabh Dubey", team: "Kolkata Knight Riders", teamShort: "KKR", role: "BOWL", credits: 8 },
    { externalId: "50e38c9d-bf39-44b8-b5e6-0c9f36b8cbdf", name: "Blessing Muzarabani", team: "Kolkata Knight Riders", teamShort: "KKR", role: "BOWL", credits: 8 },
    { externalId: "7cb23ef6-2cd5-4aeb-9047-a5054d220f98", name: "David Payne", team: "Sunrisers Hyderabad", teamShort: "SRH", role: "BOWL", credits: 8 },
    { externalId: "0284af4f-d4eb-4894-bacc-a468c1020951", name: "Spencer Johnson", team: "Chennai Super Kings", teamShort: "CSK", role: "BOWL", credits: 8 },
    { externalId: "80193c8f-687d-47c3-a7e9-b098a83c7812", name: "Navdeep Saini", team: "Kolkata Knight Riders", teamShort: "KKR", role: "BOWL", credits: 8 },
    { externalId: "3df5944d-dcc5-41fd-aec1-060b4c513536", name: "Kulwant Khejroliya", team: "Gujarat Titans", teamShort: "GT", role: "BOWL", credits: 8 }
  ];
  async function seedReplacementPlayers() {
    try {
      const allMatches = await storage.getAllMatches();
      const activeMatches = allMatches.filter(
        (m) => m.status === "upcoming" || m.status === "live"
      );
      for (const player of REPLACEMENT_PLAYERS) {
        const relevantMatches = activeMatches.filter(
          (m) => m.team1Short === player.teamShort || m.team2Short === player.teamShort
        );
        for (const match of relevantMatches) {
          await storage.upsertPlayersForMatch(match.id, [{
            matchId: match.id,
            externalId: player.externalId,
            name: player.name,
            team: player.team,
            teamShort: player.teamShort,
            role: player.role,
            credits: player.credits
          }]);
        }
      }
      console.log(`[ReplacementPlayers] Seeded ${REPLACEMENT_PLAYERS.length} players into ${activeMatches.length} active matches`);
    } catch (err) {
      console.error("[ReplacementPlayers] Seed error:", err);
    }
  }
  app2.post(
    "/api/admin/matches/:id/sync-squad",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      const matchId = req.params.id;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });
      if (!match.externalId) return res.status(400).json({ message: "Match has no externalId \u2014 cannot sync from API" });
      try {
        const { fetchMatchSquad: fetchMatchSquad2, fetchSeriesSquad: fetchSeriesSquad2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
        let squad = await fetchMatchSquad2(match.externalId);
        let squadSource = "match_squad";
        if (squad.length === 0 && match.seriesId) {
          const seriesPlayers = await fetchSeriesSquad2(match.seriesId);
          const t1 = match.team1.toLowerCase();
          const t2 = match.team2.toLowerCase();
          squad = seriesPlayers.filter((p) => {
            const pt = p.team.toLowerCase();
            return pt === t1 || pt === t2 || pt.includes(t1) || t1.includes(pt) || pt.includes(t2) || t2.includes(pt);
          });
          squadSource = "series_squad";
        }
        if (squad.length === 0) {
          return res.status(502).json({ message: `API returned 0 players for this match (tried ${squadSource})` });
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
        const updated = await storage.getPlayersForMatch(matchId);
        return res.json({ message: `Synced ${updated.length} players for ${match.team1} vs ${match.team2} via ${squadSource}` });
      } catch (err) {
        console.error("[sync-squad] error:", err);
        return res.status(500).json({ message: "Squad sync failed", error: err.message });
      }
    }
  );
  async function syncMissingSquads() {
    const SQUAD_MIN = 15;
    try {
      const allMatches = await storage.getAllMatches();
      const candidates = allMatches.filter(
        (m) => (m.status === "upcoming" || m.status === "live") && m.externalId
      );
      const { fetchMatchSquad: fetchMatchSquad2, fetchSeriesSquad: fetchSeriesSquad2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
      for (const match of candidates) {
        const existing = await storage.getPlayersForMatch(match.id);
        if (existing.length >= SQUAD_MIN) continue;
        try {
          let squad = await fetchMatchSquad2(match.externalId);
          let squadSource = "match_squad";
          if (squad.length === 0 && match.seriesId) {
            const seriesPlayers = await fetchSeriesSquad2(match.seriesId);
            const t1 = match.team1.toLowerCase();
            const t2 = match.team2.toLowerCase();
            squad = seriesPlayers.filter((p) => {
              const pt = p.team.toLowerCase();
              return pt === t1 || pt === t2 || pt.includes(t1) || t1.includes(pt) || pt.includes(t2) || t2.includes(pt);
            });
            squadSource = "series_squad";
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
            console.log(`[SquadSync] ${match.team1Short} vs ${match.team2Short}: upserted ${squad.length} players via ${squadSource}`);
          } else {
            console.log(`[SquadSync] ${match.team1Short} vs ${match.team2Short}: API returned 0 players \u2014 will retry later`);
          }
        } catch (err) {
          console.error(`[SquadSync] Error for ${match.team1Short} vs ${match.team2Short}:`, err);
        }
      }
    } catch (err) {
      console.error("[SquadSync] Startup sync error:", err);
    }
  }
  seedReplacementPlayers();
  app2.post(
    "/api/admin/seed-replacement-players",
    isAuthenticated,
    isAdmin,
    async (_req, res) => {
      await seedReplacementPlayers();
      return res.json({ message: "Replacement players seeded into all active matches" });
    }
  );
  app2.post(
    "/api/admin/matches/:id/award-base-points",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const players2 = await storage.getPlayersForMatch(matchId);
        const xiPlayers = players2.filter((p) => p.isPlayingXI);
        if (xiPlayers.length === 0) return res.status(400).json({ message: "No Playing XI set for this match. Set XI first." });
        let updated = 0;
        for (const p of xiPlayers) {
          if (!p.points || p.points < 4) {
            await storage.updatePlayer(p.id, { points: 4 });
            updated++;
          }
        }
        const matchLabel = `${match.team1Short} vs ${match.team2Short}`;
        const recalcFn = globalThis.__recalculateTeamTotals;
        if (recalcFn) await recalcFn(matchId, matchLabel);
        return res.json({ message: `Awarded +4 base points to ${updated} XI players`, xiCount: xiPlayers.length, updated });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  app2.post(
    "/api/admin/matches/:id/manual-points",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        const entries = req.body.entries || [];
        if (!entries.length) return res.status(400).json({ message: "No entries provided" });
        const players2 = await storage.getPlayersForMatch(matchId);
        const results = [];
        for (const entry of entries) {
          let player = entry.playerId ? players2.find((p) => p.id === entry.playerId) : null;
          if (!player && entry.name) {
            const nameLower = entry.name.toLowerCase().trim();
            player = players2.find((p) => p.name.toLowerCase().includes(nameLower) || nameLower.includes(p.name.toLowerCase().split(" ").pop()));
          }
          if (player) {
            await storage.updatePlayer(player.id, { points: entry.points, isPlayingXI: true });
            results.push({ name: player.name, points: entry.points, matched: true });
          } else {
            results.push({ name: entry.name || entry.playerId || "unknown", points: entry.points, matched: false });
          }
        }
        const matchLabel = `${match.team1Short} vs ${match.team2Short}`;
        const recalcFn = globalThis.__recalculateTeamTotals;
        if (recalcFn) await recalcFn(matchId, matchLabel);
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        return res.json({
          message: `Manual points applied. ${results.filter((r) => r.matched).length}/${entries.length} players matched.`,
          results,
          teamCount: allTeams.length
        });
      } catch (err) {
        return res.status(500).json({ message: err.message });
      }
    }
  );
  const httpServer = createServer(app2);
  return httpServer;
}
var ADMIN_PHONES, TOKEN_SECRET, LIVE_CACHE_TTL_MS, liveScorecardCache, liveScoreCache, squadFetchBackoff, SQUAD_BACKOFF_MS, historicalStatsCache, ownershipCache, CACHE_TTL_NORMAL, CACHE_TTL_LOCK, CACHE_MAX_STALENESS, userTapCounters, canonicalCacheIndex, dbMappingsCache, TEAM_SHORT_TO_CRICSHEET, PLAYER_ALIASES;
var init_routes = __esm({
  "server/routes.ts"() {
    "use strict";
    init_storage();
    init_db();
    init_schema();
    init_cricket_api();
    ADMIN_PHONES = ["9840872462", "9884334973", "7406020777"];
    TOKEN_SECRET = process.env.SESSION_SECRET || "cdo-session-secret-dev";
    LIVE_CACHE_TTL_MS = 45e3;
    liveScorecardCache = /* @__PURE__ */ new Map();
    liveScoreCache = /* @__PURE__ */ new Map();
    squadFetchBackoff = /* @__PURE__ */ new Map();
    SQUAD_BACKOFF_MS = 60 * 60 * 1e3;
    historicalStatsCache = null;
    ownershipCache = {};
    CACHE_TTL_NORMAL = 2 * 60 * 1e3;
    CACHE_TTL_LOCK = 60 * 1e3;
    CACHE_MAX_STALENESS = 5 * 60 * 1e3;
    userTapCounters = {};
    canonicalCacheIndex = null;
    dbMappingsCache = null;
    TEAM_SHORT_TO_CRICSHEET = {
      "RR": ["rajasthan royals"],
      "RCB": ["royal challengers bangalore", "royal challengers bengaluru", "royal challengers"],
      "MI": ["mumbai indians"],
      "CSK": ["chennai super kings"],
      "KKR": ["kolkata knight riders"],
      "SRH": ["sunrisers hyderabad", "deccan chargers"],
      "DC": ["delhi capitals", "delhi daredevils"],
      "PBKS": ["punjab kings", "kings xi punjab"],
      "GT": ["gujarat titans"],
      "LSG": ["lucknow super giants"]
    };
    PLAYER_ALIASES = {
      "vaibhav sooryavanshi": "Vaibhav Suryavanshi",
      "vaibhav suryavanshi": "Vaibhav Suryavanshi",
      "yashasvi jaiswal": "YBK Jaiswal",
      "y jaiswal": "YBK Jaiswal",
      "ravindra jadeja": "RA Jadeja",
      "r jadeja": "RA Jadeja",
      "riyan parag": "R Parag",
      "shimron hetmyer": "SO Hetmyer",
      "s hetmyer": "SO Hetmyer",
      "jofra archer": "JC Archer",
      "j archer": "JC Archer",
      "donovan ferreira": "D Ferreira",
      "nandre burger": "N Burger",
      "virat kohli": "V Kohli",
      "v kohli": "V Kohli",
      "rajat patidar": "RM Patidar",
      "devdutt padikkal": "D Padikkal",
      "tim david": "TH David",
      "krunal pandya": "KH Pandya",
      "bhuvneshwar kumar": "B Kumar",
      "josh hazlewood": "JR Hazlewood",
      "philip salt": "PD Salt",
      "romario shepherd": "R Shepherd",
      "rohit sharma": "RG Sharma",
      "hardik pandya": "HH Pandya",
      "ms dhoni": "MS Dhoni",
      "shubman gill": "Shubman Gill",
      "kl rahul": "KL Rahul",
      "suryakumar yadav": "SA Yadav",
      "sanju samson": "SV Samson",
      "rishabh pant": "R Pant",
      "pat cummins": "PJ Cummins",
      "travis head": "TM Head",
      "abhishek sharma": "Abhishek Sharma",
      "shardul thakur": "SN Thakur",
      "arshdeep singh": "Arshdeep Singh",
      "mohammed siraj": "Mohammed Siraj",
      "kuldeep yadav": "Kuldeep Yadav",
      "yuzvendra chahal": "YS Chahal",
      "washington sundar": "W Sundar",
      "deepak chahar": "DL Chahar",
      "faf du plessis": "F du Plessis",
      "quinton de kock": "Q de Kock",
      "glenn maxwell": "GJ Maxwell",
      "dinesh karthik": "KD Karthik",
      "shreyas iyer": "SS Iyer",
      "ishan kishan": "I Kishan",
      "venkatesh iyer": "Venkatesh Iyer",
      "rasikh salam dar": "Rasikh Dar",
      "rasikh dar": "Rasikh Dar",
      "vicky ostwal": "VG Ostwal",
      "jordan cox": "JM Cox",
      "yudhvir singh charak": "Yudhvir Charak",
      "lhuan-dre pretorius": "L Pretorius",
      "lhuan dre pretorius": "L Pretorius"
    };
  }
});

// server/index.ts
init_routes();
init_routes();
init_cricket_api();
init_storage();
init_db();
import express from "express";
import { sql as sql4 } from "drizzle-orm";
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
  await connectWithRetry(10, 3e3);
  markServerReady();
  startOwnershipWorker(async () => {
    const upcoming = await db.execute(sql4`
      SELECT id FROM matches
      WHERE status IN ('upcoming', 'live')
      AND start_time > NOW() - INTERVAL '3 hours'
    `);
    return upcoming.rows.map((r) => r.id);
  });
  server.listen(port, "0.0.0.0", () => {
    log(`express server listening on port ${port}`);
    log(`express server fully ready on port ${port}`);
  });
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
  mergeMatchDuplicates().catch((err) => {
    console.error("Initial duplicate merge failed:", err);
  });
  syncMatchesFromApi().catch((err) => {
    console.error("Initial match sync failed:", err);
  });
  const TWO_HOURS = 2 * 60 * 60 * 1e3;
  setInterval(() => {
    log("Periodic match sync (every 2 hours)...");
    mergeMatchDuplicates().catch((err) => {
      console.error("Periodic duplicate merge failed:", err);
    });
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
        const dbWords = normName.split(" ");
        const dbSigWords = dbWords.filter((w) => w.length >= 3);
        if (dbSigWords.length >= 2) {
          const subsetCandidates = [];
          for (const [scorecardKey, pts] of namePointsMap.entries()) {
            const scorecardWords = scorecardKey.split(" ");
            if (dbSigWords.every((w) => scorecardWords.includes(w))) {
              subsetCandidates.push([scorecardKey, pts]);
            }
          }
          if (subsetCandidates.length === 1) {
            return {
              fantasyPts: subsetCandidates[0][1],
              matchMethod: `wordSubset(${player.name}\u2192${subsetCandidates[0][0]})`
            };
          }
        }
        const dbLastName = dbWords[dbWords.length - 1] || "";
        const dbFirstInitial = dbWords[0]?.[0] || "";
        if (dbSigWords.length < 2 && dbLastName.length >= 5) {
          const lastNameCandidates = [];
          for (const [scorecardKey, pts] of namePointsMap.entries()) {
            const scorecardWords = scorecardKey.split(" ");
            const scorecardLast = scorecardWords[scorecardWords.length - 1] || "";
            if (scorecardLast === dbLastName) {
              lastNameCandidates.push([scorecardKey, pts]);
            }
          }
          if (lastNameCandidates.length === 1) {
            const [matchedKey, matchedPts] = lastNameCandidates[0];
            const matchedFirstInitial = matchedKey.split(" ")[0]?.[0] || "";
            if (!dbFirstInitial || !matchedFirstInitial || dbFirstInitial === matchedFirstInitial) {
              return {
                fantasyPts: matchedPts,
                matchMethod: `lastName(${player.name}\u2192${matchedKey})`
              };
            }
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
      battedOrBowledPlayers: /* @__PURE__ */ new Set(),
      scoreString: "",
      matchEnded: false,
      totalOvers: 0,
      source: ""
    };
    if (!match.externalId) return empty;
    try {
      const { fetchMatchScorecardWithScore: fetchMatchScorecardWithScore2, fetchMatchInfo: fetchMatchInfo2, fetchCricbuzzScorecard: fetchCricbuzzScorecard2, fetchCFLLScorecard: fetchCFLLScorecard2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
      const result = {
        pointsMap: /* @__PURE__ */ new Map(),
        namePointsMap: /* @__PURE__ */ new Map(),
        // Players who genuinely batted or bowled (own scorecard row). Empty for non-Crex sources.
        battedOrBowledPlayers: /* @__PURE__ */ new Set(),
        scoreString: "",
        matchEnded: false,
        totalOvers: 0
      };
      let source = "";
      if (match.team1Short && match.team2Short) {
        try {
          const cfllResult = await fetchCFLLScorecard2(match.team1Short, match.team2Short);
          if (cfllResult.namePointsMap.size > 0) {
            result.namePointsMap = cfllResult.namePointsMap;
            result.battedOrBowledPlayers = cfllResult.battedOrBowledPlayers;
            result.scoreString = cfllResult.scoreString || "";
            result.matchEnded = cfllResult.matchEnded;
            result.totalOvers = cfllResult.totalOvers;
            source = "CFLL";
            log(`[Heartbeat:Score] CFLL Scorecard SUCCESS: ${cfllResult.namePointsMap.size} players (${cfllResult.battedOrBowledPlayers.size} batted/bowled) for ${match.team1Short} vs ${match.team2Short}`);
          } else {
            log(`[Heartbeat:Score] CFLL Scorecard empty \u2014 falling back to Cricbuzz for ${match.team1Short} vs ${match.team2Short}`);
          }
        } catch (e) {
          log(`[Heartbeat:Score] CFLL Scorecard failed \u2014 falling back to Cricbuzz: ${e}`);
        }
      }
      if (!source && process.env.RAPIDAPI_KEY && match.team1Short && match.team2Short) {
        try {
          log(`[Heartbeat:Score] Cricbuzz for ${match.team1Short} vs ${match.team2Short}`);
          const cbResult = await fetchCricbuzzScorecard2(match.team1Short, match.team2Short);
          if (cbResult && (cbResult.namePointsMap.size > 0 || cbResult.scoreString)) {
            result.namePointsMap = cbResult.namePointsMap;
            result.battedOrBowledPlayers = cbResult.battedOrBowledPlayers;
            result.scoreString = cbResult.scoreString || "";
            result.matchEnded = cbResult.matchEnded;
            result.totalOvers = cbResult.totalOvers;
            source = "Cricbuzz";
            log(`[Heartbeat:Score] Cricbuzz SUCCESS: ${cbResult.namePointsMap.size} players, score="${cbResult.scoreString}", ended=${cbResult.matchEnded}`);
          } else {
            log(`[Heartbeat:Score] Cricbuzz empty \u2014 will try CricAPI for ${match.team1Short} vs ${match.team2Short}`);
          }
        } catch (cbErr) {
          log(`[Heartbeat:Score] Cricbuzz error for ${match.team1Short} vs ${match.team2Short}: ${cbErr}`);
        }
      }
      if (!source) {
        const cricResult = await fetchMatchScorecardWithScore2(match.externalId);
        log(`[Heartbeat:Score] CricAPI (secondary) ${match.team1Short} vs ${match.team2Short}: ${cricResult.pointsMap.size} players, score="${cricResult.scoreString.substring(0, 80)}"`);
        if (cricResult.pointsMap.size > 0 || cricResult.scoreString) {
          result.pointsMap = cricResult.pointsMap;
          result.namePointsMap = cricResult.namePointsMap;
          result.scoreString = cricResult.scoreString;
          result.matchEnded = cricResult.matchEnded;
          result.totalOvers = cricResult.totalOvers;
          source = "CricAPI";
        }
        try {
          const matchInfo = await fetchMatchInfo2(match.externalId);
          if (matchInfo && matchInfo.score && Array.isArray(matchInfo.score) && matchInfo.score.length > 0) {
            const infoScoreArr = matchInfo.score;
            const infoScoreString = infoScoreArr.map((s) => `${s?.inning ?? "?"}: ${s?.r ?? 0}/${s?.w ?? 0} (${s?.o ?? 0} ov)`).join(" | ");
            const infoTotalOvers = infoScoreArr.reduce((sum, s) => sum + (s?.o || 0), 0);
            const infoStatus = (matchInfo.name || matchInfo.status || "").toLowerCase();
            const infoEnded = infoStatus.includes("won") || infoStatus.includes("draw") || infoStatus.includes("tied") || infoStatus.includes("finished") || infoStatus.includes("beat") || infoStatus.includes("defeat") || infoStatus.includes("result") || infoStatus.includes("aban") || matchInfo.matchEnded === true;
            if (infoTotalOvers > result.totalOvers) {
              log(`[Heartbeat:LiveScore] CricAPI match_info has fresher score ${infoTotalOvers} ov vs ${result.totalOvers} ov`);
              const statusText = matchInfo.name || matchInfo.status || "";
              result.scoreString = statusText ? `${infoScoreString} \u2014 ${statusText}` : infoScoreString;
              result.totalOvers = infoTotalOvers;
            }
            if (infoEnded && !result.matchEnded) {
              log(`[Heartbeat:LiveScore] CricAPI match_info says match ended`);
              result.matchEnded = true;
            }
          }
        } catch (infoErr) {
          log(`[Heartbeat:LiveScore] CricAPI match_info failed for ${match.team1Short} vs ${match.team2Short}: ${infoErr}`);
        }
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
  async function updateFantasyPoints(matchId, matchLabel, pointsMap, namePointsMap, matchEnded = false) {
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
        const xiBase = player.isPlayingXI ? 4 : 0;
        let finalPts;
        if (appearedOnScorecard) {
          if (!player.isPlayingXI && !player.isImpactPlayer) {
            log(
              `[Heartbeat:Points] SKIP non-XI false positive: "${player.name}" (${matchMethod}) \u2014 not in Playing XI or official impact sub`
            );
            unmapped++;
            continue;
          }
          finalPts = fantasyPts + xiBase;
          mapped++;
          const DROP_PROTECTION_THRESHOLD = 20;
          if (!matchEnded && existingPts - finalPts > DROP_PROTECTION_THRESHOLD) {
            log(
              `[Heartbeat:Points] PROTECTED: "${player.name}" large stale-data drop ${existingPts} -> ${finalPts} (diff ${existingPts - finalPts}) \u2014 keeping existing (live match)`
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
    function resolveEffectiveXI(team) {
      const backup1Id = team.backupXiPlayer1Id;
      const backup2Id = team.backupXiPlayer2Id;
      const effectivePlayerIds = [...team.playerIds];
      let effectiveCaptainId = team.captainId ?? null;
      let effectiveVcId = team.viceCaptainId ?? null;
      const substitutions = [];
      const xiAnnounced = Array.from(playerById.values()).some((p) => p.isPlayingXI === true);
      if (!xiAnnounced || !backup1Id && !backup2Id) {
        return { effectivePlayerIds, effectiveCaptainId, effectiveVcId, substitutions };
      }
      const availableBackups = [backup1Id, backup2Id].filter((id) => !!id).map((id) => playerById.get(id) || playerByExtId.get(id)).filter((p) => !!p && p.isPlayingXI === true);
      if (availableBackups.length === 0) {
        return { effectivePlayerIds, effectiveCaptainId, effectiveVcId, substitutions };
      }
      let backupCursor = 0;
      for (let i = 0; i < effectivePlayerIds.length; i++) {
        if (backupCursor >= availableBackups.length) break;
        const pid = effectivePlayerIds[i];
        const p = playerById.get(pid) || playerByExtId.get(pid);
        if (p && p.isPlayingXI !== true) {
          let backup;
          while (backupCursor < availableBackups.length) {
            const candidate = availableBackups[backupCursor++];
            if (!effectivePlayerIds.includes(candidate.id)) {
              backup = candidate;
              break;
            }
            console.warn(`[resolveEffectiveXI] Skipping backup ${candidate.id} \u2014 already in XI`);
          }
          if (!backup) break;
          effectivePlayerIds[i] = backup.id;
          substitutions.push({ outId: pid, inId: backup.id });
          if (pid === effectiveCaptainId) effectiveCaptainId = backup.id;
          if (pid === effectiveVcId) effectiveVcId = backup.id;
        }
      }
      const seenIds = /* @__PURE__ */ new Set();
      for (const id of effectivePlayerIds) {
        if (seenIds.has(id)) {
          console.error(`[resolveEffectiveXI] DUPLICATE player ID in final XI for team ${team.id}: ${id} \u2014 this is a bug`);
        }
        seenIds.add(id);
      }
      return { effectivePlayerIds, effectiveCaptainId, effectiveVcId, substitutions };
    }
    for (const team of allTeams) {
      try {
        const { effectivePlayerIds, effectiveCaptainId, effectiveVcId, substitutions } = resolveEffectiveXI(team);
        if (substitutions.length > 0) {
          console.log(`[Heartbeat:Teams] XI Backups applied for team ${team.id}:`, substitutions.map((s) => `${s.outId} \u2192 ${s.inId}`).join(", "));
        }
        let totalPoints = 0;
        for (const pid of effectivePlayerIds) {
          try {
            const p = playerById.get(pid) || playerByExtId.get(pid);
            if (!p) continue;
            let basePts = p.points || 0;
            let multiplier = 1;
            if (pid === effectiveCaptainId && (!team.captainType || team.captainType === "player")) {
              multiplier = 2;
            } else if (pid === effectiveVcId && (!team.vcType || team.vcType === "player")) {
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
              const alreadyInXI = effectivePlayerIds.includes(resolved.activePlayerId);
              if (impactPlayer && impactPlayer.isPlayingXI !== true && !alreadyInXI) {
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
      try {
        const thirtyMinsMs = 30 * 60 * 1e3;
        const twentyFiveMinsMs = 25 * 60 * 1e3;
        for (const m of allMatches) {
          if (m.status !== "upcoming") continue;
          if (!m.team1Short || !m.team2Short) continue;
          const startMs = m.startTime ? new Date(m.startTime).getTime() : 0;
          if (startMs > now + twentyFiveMinsMs && startMs <= now + thirtyMinsMs) {
            const { notifyMatchStartingSoon: notifyMatchStartingSoon2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
            await notifyMatchStartingSoon2(m.team1Short, m.team2Short);
            log(`[FCM] 30-min notification sent for ${m.team1Short} vs ${m.team2Short}`);
          }
        }
      } catch (e) {
        console.error("[FCM] Starting soon notification failed:", e);
      }
      for (const m of allMatches) {
        if (m.adminUnlockOverride && m.unlockedAt) {
          const minutesSince = (now - new Date(m.unlockedAt).getTime()) / 6e4;
          if (minutesSince >= 15) {
            await storage.updateMatch(m.id, { adminUnlockOverride: false, unlockedAt: null });
            log(`[Heartbeat] Auto-cleared expired unlock for match ${m.id}`);
          }
        }
      }
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
            battedOrBowledPlayers,
            scoreString,
            matchEnded,
            totalOvers,
            source
          } = await updateLiveScore(match);
          const existingScoreStr = match.scoreString || "";
          const existingOvers = extractTotalOversFromScoreString(existingScoreStr);
          const existingInningsCount = (existingScoreStr.match(/\(\d+(?:\.\d+)?\s*ov\)/g) || []).length;
          const incomingInningsCount = scoreString ? (scoreString.match(/\(\d+(?:\.\d+)?\s*ov\)/g) || []).length : 0;
          const isStaleScore = !source.includes("Crex") && !source.includes("CFLL") && totalOvers > 0 && totalOvers < existingOvers && incomingInningsCount <= existingInningsCount;
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
              const { notifyMatchEnded: notifyMatchEnded2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
              await notifyMatchEnded2(match.team1Short, match.team2Short);
            } catch (e) {
              console.error("[FCM] Match ended notification failed:", e);
            }
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
          const hasAnyScorecard = pointsMap.size > 0 || namePointsMap.size > 0;
          const normName = (n) => n.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
          const inScorecard = (player) => player.externalId && pointsMap.has(player.externalId) || namePointsMap.size > 0 && normName(player.name) !== "" && namePointsMap.has(normName(player.name));
          if (hasAnyScorecard && !match.firstScorecardAt) {
            try {
              await storage.updateMatch(match.id, { firstScorecardAt: /* @__PURE__ */ new Date() });
              log(`[Heartbeat] firstScorecardAt recorded for ${matchLabel}`);
            } catch (fse) {
              console.error(`[Heartbeat] Failed to set firstScorecardAt for ${matchLabel}:`, fse);
            }
          } else if (hasAnyScorecard && match.firstScorecardAt) {
            try {
              const allMatchPlayers = await storage.getPlayersForMatch(match.id);
              const impactCandidates = allMatchPlayers.filter(
                (p) => p.isImpactPlayer === true && p.isPlayingXI !== true
              );
              for (const candidate of impactCandidates) {
                const existingStatus = await storage.getMatchPlayerStatus(match.id, candidate.id);
                if (existingStatus?.officialImpactSubUsed) continue;
                const normName2 = candidate.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
                const appearedStrict = battedOrBowledPlayers.size > 0 && battedOrBowledPlayers.has(normName2);
                if (appearedStrict) {
                  const via = appearedStrict ? "bat/bowl row" : "scorecard map";
                  log(`[Heartbeat:Impact] Candidate confirmed active: ${candidate.name} (${candidate.teamShort}) via ${via} for ${matchLabel}`);
                  await storage.upsertMatchPlayerStatus({
                    matchId: match.id,
                    playerId: candidate.id,
                    officialImpactSubUsed: true
                  });
                  await storage.updatePlayer(candidate.id, { isImpactPlayer: true });
                  log(`[Heartbeat:Impact] isImpactPlayer=true set on ${candidate.name} after auto-detection`);
                }
              }
            } catch (impactErr) {
              console.error(`[Heartbeat:Impact] Auto-detection failed for ${matchLabel}:`, impactErr);
            }
          }
          if (pointsMap.size > 0 || namePointsMap.size > 0) {
            const updatedCount = await updateFantasyPoints(
              match.id,
              matchLabel,
              pointsMap,
              namePointsMap,
              matchEnded
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
  globalThis.__updateFantasyPoints = updateFantasyPoints;
  globalThis.__updateLiveScore = updateLiveScore;
  setInterval(async () => {
    try {
      const { refreshStaleMatchStatuses: refreshStaleMatchStatuses2 } = await Promise.resolve().then(() => (init_cricket_api(), cricket_api_exports));
      await refreshStaleMatchStatuses2();
    } catch (e) {
      console.error("[StatusRefreshTimer] error:", e);
    }
  }, 60 * 1e3);
  setInterval(matchHeartbeat, HEARTBEAT_INTERVAL);
  log(
    "Match Heartbeat started (every 60s \u2014 score sync, points, lockout, stale-data rejection)"
  );
})();
