import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  password: text("password").notNull(),
  teamName: text("team_name").notNull().default(""),
  isVerified: boolean("is_verified").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const referenceCodes = pgTable("reference_codes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 4 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const matches = pgTable("matches", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const players = pgTable("players", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  externalId: varchar("external_id"),
  name: text("name").notNull(),
  team: text("team").notNull(),
  teamShort: varchar("team_short", { length: 10 }).notNull(),
  role: varchar("role", { length: 10 }).notNull(),
  credits: real("credits").notNull().default(8),
  points: integer("points").notNull().default(0),
  selectedBy: integer("selected_by").notNull().default(0),
  recentForm: jsonb("recent_form").$type<number[]>().notNull().default([]),
  isImpactPlayer: boolean("is_impact_player").notNull().default(false),
  isPlayingXI: boolean("is_playing_xi").notNull().default(false),
  apiName: text("api_name"),
});

export const userTeams = pgTable("user_teams", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  matchId: varchar("match_id").notNull(),
  name: text("name").notNull(),
  playerIds: jsonb("player_ids").$type<string[]>().notNull().default([]),
  captainId: varchar("captain_id").notNull(),
  viceCaptainId: varchar("vice_captain_id").notNull(),
  totalPoints: integer("total_points").notNull().default(0),
  primaryImpactId: varchar("primary_impact_id"),
  backupImpactId: varchar("backup_impact_id"),
  captainType: varchar("captain_type", { length: 20 }).notNull().default("player"),
  vcType: varchar("vc_type", { length: 20 }).notNull().default("player"),
  invisibleMode: boolean("invisible_mode").notNull().default(false),
  predictionPoints: integer("prediction_points").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const codeVerifications = pgTable("code_verifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  codeId: varchar("code_id").notNull(),
  verifiedAt: timestamp("verified_at").notNull().defaultNow(),
});

export const matchPredictions = pgTable("match_predictions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  matchId: varchar("match_id").notNull(),
  predictedWinner: varchar("predicted_winner", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rewards = pgTable("rewards", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  brand: text("brand").notNull(),
  title: text("title").notNull(),
  code: text("code").notNull(),
  terms: text("terms").notNull().default(""),
  isClaimed: boolean("is_claimed").notNull().default(false),
  claimedByUserId: varchar("claimed_by_user_id"),
  claimedMatchId: varchar("claimed_match_id"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tournamentLedger = pgTable("tournament_ledger", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull().default(""),
  matchId: varchar("match_id").notNull(),
  tournamentName: text("tournament_name").notNull(),
  pointsChange: integer("points_change").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const apiCallLog = pgTable("api_call_log", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  dateKey: varchar("date_key", { length: 10 }).notNull(),
  callCount: integer("call_count").notNull().default(0),
  lastCalledAt: timestamp("last_called_at").notNull().defaultNow(),
});

export const matchPlayerStatus = pgTable("match_player_status", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  playerId: varchar("player_id").notNull(),
  adminStatus: varchar("admin_status", { length: 20 }).notNull().default("not_active"),
  actualParticipationStatus: varchar("actual_participation_status", { length: 30 }).notNull().default("unknown"),
  officialImpactSubUsed: boolean("official_impact_sub_used").notNull().default(false),
  sourceType: varchar("source_type", { length: 20 }).notNull().default("admin"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userWeeklyUsage = pgTable("user_weekly_usage", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  weekStartDate: varchar("week_start_date", { length: 10 }).notNull(),
  multiTeamUsageCount: integer("multi_team_usage_count").notNull().default(0),
  invisibleModeUsageCount: integer("invisible_mode_usage_count").notNull().default(0),
});

export const adminAuditLog = pgTable("admin_audit_log", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull(),
  actionType: text("action_type").notNull(),
  entityType: text("entity_type").notNull().default(""),
  entityId: varchar("entity_id"),
  matchId: varchar("match_id"),
  metadata: text("metadata").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  phone: true,
  password: true,
});

export const insertReferenceCodeSchema = createInsertSchema(referenceCodes).pick({
  code: true,
});

export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  createdAt: true,
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
});

export const insertUserTeamSchema = z.object({
  matchId: z.string(),
  name: z.string(),
  playerIds: z.array(z.string()),
  captainId: z.string(),
  viceCaptainId: z.string(),
  primaryImpactId: z.string().optional(),
  backupImpactId: z.string().optional(),
  captainType: z.enum(["player", "impact_slot"]).default("player"),
  vcType: z.enum(["player", "impact_slot"]).default("player"),
  invisibleMode: z.boolean().default(false),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ReferenceCode = typeof referenceCodes.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Player = typeof players.$inferSelect;
export type UserTeam = typeof userTeams.$inferSelect;
export type MatchPrediction = typeof matchPredictions.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type TournamentLedger = typeof tournamentLedger.$inferSelect;
export type MatchPlayerStatus = typeof matchPlayerStatus.$inferSelect;
export type UserWeeklyUsage = typeof userWeeklyUsage.$inferSelect;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
