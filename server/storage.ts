import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  referenceCodes,
  matches,
  players,
  userTeams,
  codeVerifications,
  apiCallLog,
  matchPredictions,
  rewards,
  tournamentLedger,
  matchPlayerStatus,
  userWeeklyUsage,
  adminAuditLog,
  type InsertUser,
  type User,
  type ReferenceCode,
  type Match,
  type Player,
  type UserTeam,
  type MatchPrediction,
  type Reward,
  type TournamentLedger,
  type MatchPlayerStatus,
  type UserWeeklyUsage,
  type AdminAuditLog,
} from "@shared/schema";

export class DatabaseStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async updateUserVerified(userId: string, verified: boolean): Promise<void> {
    await db
      .update(users)
      .set({ isVerified: verified })
      .where(eq(users.id, userId));
  }

  async setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
    await db
      .update(users)
      .set({ isAdmin })
      .where(eq(users.id, userId));
  }

  async updateUserTeamName(userId: string, teamName: string): Promise<void> {
    await db
      .update(users)
      .set({ teamName })
      .where(eq(users.id, userId));
  }

  async getUserTeam(teamId: string): Promise<UserTeam | undefined> {
    const [team] = await db.select().from(userTeams).where(eq(userTeams.id, teamId));
    return team;
  }

  // Reference Codes
  async getActiveCode(code: string): Promise<ReferenceCode | undefined> {
    const [found] = await db
      .select()
      .from(referenceCodes)
      .where(and(eq(referenceCodes.code, code), eq(referenceCodes.isActive, true)));
    return found;
  }

  async getAllCodes(): Promise<ReferenceCode[]> {
    return db.select().from(referenceCodes);
  }

  async createCode(code: string, createdBy?: string): Promise<ReferenceCode> {
    const [created] = await db
      .insert(referenceCodes)
      .values({ code, createdBy, isActive: true })
      .returning();
    return created;
  }

  async deactivateCode(codeId: string): Promise<void> {
    await db
      .update(referenceCodes)
      .set({ isActive: false })
      .where(eq(referenceCodes.id, codeId));
  }

  async deleteCode(codeId: string): Promise<void> {
    await db.delete(referenceCodes).where(eq(referenceCodes.id, codeId));
  }

  async logCodeVerification(userId: string, codeId: string): Promise<void> {
    await db.insert(codeVerifications).values({ userId, codeId });
  }

  // Matches
  async getMatch(id: string): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match;
  }

  async getAllMatches(): Promise<Match[]> {
    return db.select().from(matches);
  }

  async createMatch(data: Partial<Match> & { team1: string; team1Short: string; team2: string; team2Short: string; startTime: Date }): Promise<Match> {
    const [match] = await db.insert(matches).values(data as any).returning();
    return match;
  }

  async updateMatch(id: string, data: Partial<Match>): Promise<void> {
    await db.update(matches).set(data as any).where(eq(matches.id, id));
  }

  async deleteMatch(id: string): Promise<void> {
    await db.delete(matches).where(eq(matches.id, id));
  }

  // Players
  async getPlayersForMatch(matchId: string): Promise<Player[]> {
    return db.select().from(players).where(eq(players.matchId, matchId));
  }

  async createPlayer(data: Partial<Player> & { matchId: string; name: string; team: string; teamShort: string; role: string }): Promise<Player> {
    const [player] = await db.insert(players).values(data as any).returning();
    return player;
  }

  async bulkCreatePlayers(data: Array<Partial<Player> & { matchId: string; name: string; team: string; teamShort: string; role: string }>): Promise<void> {
    if (data.length === 0) return;
    await db.insert(players).values(data as any);
  }

  async upsertPlayersForMatch(matchId: string, data: Array<Partial<Player> & { matchId: string; name: string; team: string; teamShort: string; role: string; externalId?: string }>): Promise<void> {
    if (data.length === 0) return;
    const existing = await this.getPlayersForMatch(matchId);
    const existingByExtId = new Map(existing.filter(p => p.externalId).map(p => [p.externalId!, p]));
    const existingByName = new Map(existing.map(p => [`${p.name.toLowerCase()}__${p.teamShort.toLowerCase()}`, p]));

    const toInsert: typeof data = [];
    for (const p of data) {
      const found = (p.externalId && existingByExtId.get(p.externalId)) ||
        existingByName.get(`${p.name.toLowerCase()}__${p.teamShort.toLowerCase()}`);
      if (found) {
        const updates: Record<string, any> = {};
        if (p.externalId && !found.externalId) updates.externalId = p.externalId;
        if (p.role && p.role !== found.role) updates.role = p.role;
        if (p.credits !== undefined && p.credits !== found.credits) updates.credits = p.credits;
        if (p.team && p.team !== found.team) updates.team = p.team;
        if (Object.keys(updates).length > 0) {
          await this.updatePlayer(found.id, updates);
        }
      } else {
        toInsert.push(p);
      }
    }
    if (toInsert.length > 0) {
      await db.insert(players).values(toInsert as any);
    }
  }

  async deletePlayersForMatch(matchId: string): Promise<void> {
    await db.delete(players).where(eq(players.matchId, matchId));
  }

  async deletePlayer(playerId: string): Promise<void> {
    await db.delete(players).where(eq(players.id, playerId));
  }

  async updatePlayer(id: string, data: Partial<Player>): Promise<void> {
    await db.update(players).set(data as any).where(eq(players.id, id));
  }

  // User Teams
  async getUserTeamsForMatch(userId: string, matchId: string): Promise<UserTeam[]> {
    return db
      .select()
      .from(userTeams)
      .where(and(eq(userTeams.userId, userId), eq(userTeams.matchId, matchId)));
  }

  async getAllTeamsForMatch(matchId: string): Promise<UserTeam[]> {
    return db.select().from(userTeams).where(eq(userTeams.matchId, matchId));
  }

  async getUserTeams(userId: string): Promise<UserTeam[]> {
    return db.select().from(userTeams).where(eq(userTeams.userId, userId));
  }

  async createUserTeam(data: {
    userId: string;
    matchId: string;
    name: string;
    playerIds: string[];
    captainId: string;
    viceCaptainId: string;
    primaryImpactId?: string;
    backupImpactId?: string;
    captainType?: string;
    vcType?: string;
    invisibleMode?: boolean;
  }): Promise<UserTeam> {
    const [team] = await db.insert(userTeams).values(data).returning();
    return team;
  }

  async updateUserTeam(teamId: string, userId: string, data: {
    playerIds: string[];
    captainId: string;
    viceCaptainId: string;
    name?: string;
    primaryImpactId?: string;
    backupImpactId?: string;
    captainType?: string;
    vcType?: string;
    invisibleMode?: boolean;
  }): Promise<UserTeam> {
    const updateData: Record<string, any> = {
      playerIds: data.playerIds,
      captainId: data.captainId,
      viceCaptainId: data.viceCaptainId,
    };
    if (data.name) updateData.name = data.name;
    if (data.primaryImpactId !== undefined) updateData.primaryImpactId = data.primaryImpactId;
    if (data.backupImpactId !== undefined) updateData.backupImpactId = data.backupImpactId;
    if (data.captainType !== undefined) updateData.captainType = data.captainType;
    if (data.vcType !== undefined) updateData.vcType = data.vcType;
    if (data.invisibleMode !== undefined) updateData.invisibleMode = data.invisibleMode;
    const [updated] = await db.update(userTeams)
      .set(updateData)
      .where(and(eq(userTeams.id, teamId), eq(userTeams.userId, userId)))
      .returning();
    return updated;
  }

  async deleteUserTeam(teamId: string, userId: string): Promise<void> {
    await db
      .delete(userTeams)
      .where(and(eq(userTeams.id, teamId), eq(userTeams.userId, userId)));
  }

  async updateUserTeamPoints(teamId: string, totalPoints: number): Promise<void> {
    await db.update(userTeams).set({ totalPoints }).where(eq(userTeams.id, teamId));
  }

  async markPlayingXI(matchId: string, externalPlayerIds: string[]): Promise<number> {
    if (externalPlayerIds.length === 0) return 0;
    
    await db
      .update(players)
      .set({ isPlayingXI: false, points: 0 })
      .where(eq(players.matchId, matchId));

    let updated = 0;
    for (const extId of externalPlayerIds) {
      const result = await db
        .update(players)
        .set({ isPlayingXI: true, points: 4 })
        .where(and(eq(players.matchId, matchId), eq(players.externalId, extId)));
      updated++;
    }
    return updated;
  }

  async markPlayingXIByIds(matchId: string, playerIds: string[]): Promise<number> {
    if (playerIds.length === 0) return 0;

    await db
      .update(players)
      .set({ isPlayingXI: false, points: 0 })
      .where(eq(players.matchId, matchId));

    let updated = 0;
    for (const pid of playerIds) {
      await db
        .update(players)
        .set({ isPlayingXI: true, points: 4 })
        .where(and(eq(players.matchId, matchId), eq(players.id, pid)));
      updated++;
    }
    return updated;
  }

  async getPlayingXICount(matchId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(players)
      .where(and(eq(players.matchId, matchId), eq(players.isPlayingXI, true)));
    return Number(result[0]?.count || 0);
  }

  async incrementApiCallCount(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const [existing] = await db.select().from(apiCallLog).where(eq(apiCallLog.dateKey, today));
    if (existing) {
      const newCount = existing.callCount + 1;
      await db.update(apiCallLog).set({ callCount: newCount, lastCalledAt: new Date() }).where(eq(apiCallLog.id, existing.id));
      return newCount;
    } else {
      await db.insert(apiCallLog).values({ dateKey: today, callCount: 1 });
      return 1;
    }
  }

  async getApiCallCount(dateKey?: string): Promise<{ count: number; date: string; lastCalledAt: Date | null }> {
    const key = dateKey || new Date().toISOString().slice(0, 10);
    const [row] = await db.select().from(apiCallLog).where(eq(apiCallLog.dateKey, key));
    return { count: row?.callCount || 0, date: key, lastCalledAt: row?.lastCalledAt || null };
  }

  async getLeaderboard(): Promise<{
    rank: number;
    userId: string;
    username: string;
    teamName: string | null;
    totalPoints: number;
    matchesPlayed: number;
    teamsCreated: number;
  }[]> {
    const result = await db
      .select({
        userId: users.id,
        username: users.username,
        teamName: users.teamName,
        totalPoints: sql<number>`COALESCE(SUM(${userTeams.totalPoints}), 0)`.as('total_points_sum'),
        matchesPlayed: sql<number>`COUNT(DISTINCT ${userTeams.matchId})`.as('matches_played'),
        teamsCreated: sql<number>`COUNT(${userTeams.id})`.as('teams_created'),
      })
      .from(users)
      .leftJoin(userTeams, eq(users.id, userTeams.userId))
      .where(eq(users.isVerified, true))
      .groupBy(users.id, users.username, users.teamName)
      .orderBy(desc(sql`total_points_sum`));

    return result.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      username: row.username,
      teamName: row.teamName,
      totalPoints: Number(row.totalPoints),
      matchesPlayed: Number(row.matchesPlayed),
      teamsCreated: Number(row.teamsCreated),
    }));
  }
  async getUserPredictionForMatch(userId: string, matchId: string): Promise<MatchPrediction | undefined> {
    const [pred] = await db.select().from(matchPredictions)
      .where(and(eq(matchPredictions.userId, userId), eq(matchPredictions.matchId, matchId)));
    return pred;
  }

  async getPredictionsForMatch(matchId: string): Promise<MatchPrediction[]> {
    return db.select().from(matchPredictions)
      .where(eq(matchPredictions.matchId, matchId));
  }

  async createPrediction(data: { userId: string; matchId: string; predictedWinner: string }): Promise<MatchPrediction> {
    const [pred] = await db.insert(matchPredictions).values(data).returning();
    return pred;
  }

  async updatePrediction(userId: string, matchId: string, predictedWinner: string): Promise<MatchPrediction> {
    const [pred] = await db.update(matchPredictions)
      .set({ predictedWinner })
      .where(and(eq(matchPredictions.userId, userId), eq(matchPredictions.matchId, matchId)))
      .returning();
    return pred;
  }
  async createReward(data: { brand: string; title: string; code: string; terms: string }): Promise<Reward> {
    const [reward] = await db.insert(rewards).values(data).returning();
    return reward;
  }

  async getAllRewards(): Promise<Reward[]> {
    return db.select().from(rewards).orderBy(desc(rewards.createdAt));
  }

  async getAvailableRewards(): Promise<Reward[]> {
    return db.select().from(rewards).where(eq(rewards.isClaimed, false));
  }

  async getClaimedRewards(): Promise<Reward[]> {
    return db.select().from(rewards).where(eq(rewards.isClaimed, true)).orderBy(desc(rewards.claimedAt));
  }

  async claimReward(rewardId: string, userId: string, matchId: string): Promise<Reward> {
    const [reward] = await db.update(rewards)
      .set({ isClaimed: true, claimedByUserId: userId, claimedMatchId: matchId, claimedAt: new Date() })
      .where(eq(rewards.id, rewardId))
      .returning();
    return reward;
  }

  async getRandomAvailableReward(): Promise<Reward | undefined> {
    const available = await this.getAvailableRewards();
    if (available.length === 0) return undefined;
    return available[Math.floor(Math.random() * available.length)];
  }

  async getRewardForUserMatch(userId: string, matchId: string): Promise<Reward | undefined> {
    const [reward] = await db.select().from(rewards)
      .where(and(eq(rewards.claimedByUserId, userId), eq(rewards.claimedMatchId, matchId)));
    return reward;
  }

  async getRewardForMatch(matchId: string): Promise<Reward | undefined> {
    const [reward] = await db.select().from(rewards)
      .where(eq(rewards.claimedMatchId, matchId));
    return reward;
  }

  async getUserRewards(userId: string): Promise<Reward[]> {
    return db.select().from(rewards)
      .where(eq(rewards.claimedByUserId, userId))
      .orderBy(desc(rewards.claimedAt));
  }

  async deleteReward(rewardId: string): Promise<void> {
    await db.delete(rewards).where(eq(rewards.id, rewardId));
  }

  async getLedgerForMatch(matchId: string): Promise<TournamentLedger[]> {
    return db.select().from(tournamentLedger).where(eq(tournamentLedger.matchId, matchId));
  }

  async createLedgerEntry(data: { userId: string; userName: string; matchId: string; tournamentName: string; pointsChange: number }): Promise<TournamentLedger> {
    const [entry] = await db.insert(tournamentLedger).values(data).returning();
    return entry;
  }

  async getDistinctTournamentNames(): Promise<string[]> {
    const result = await db.selectDistinct({ name: tournamentLedger.tournamentName }).from(tournamentLedger);
    return result.map(r => r.name);
  }

  async getTournamentStandings(tName: string): Promise<{ userId: string; userName: string; totalPoints: number; matchCount: number }[]> {
    const result = await db
      .select({
        userId: tournamentLedger.userId,
        userName: tournamentLedger.userName,
        totalPoints: sql<number>`SUM(${tournamentLedger.pointsChange})`.as('total_points'),
        matchCount: sql<number>`COUNT(DISTINCT ${tournamentLedger.matchId})`.as('match_count'),
      })
      .from(tournamentLedger)
      .where(eq(tournamentLedger.tournamentName, tName))
      .groupBy(tournamentLedger.userId, tournamentLedger.userName)
      .orderBy(desc(sql`total_points`));
    return result.map(r => ({
      userId: r.userId,
      userName: r.userName,
      totalPoints: Number(r.totalPoints),
      matchCount: Number(r.matchCount),
    }));
  }
  // ====== IST Week Helpers ======
  getISTWeekStart(date?: Date): string {
    const d = date || new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffset);
    const day = istDate.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(istDate);
    monday.setUTCDate(istDate.getUTCDate() - diff);
    return monday.toISOString().slice(0, 10);
  }

  getISTWeekEnd(weekStartDate: string): string {
    const d = new Date(weekStartDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  }

  // ====== Match Player Status ======
  async getMatchPlayerStatuses(matchId: string): Promise<MatchPlayerStatus[]> {
    return db.select().from(matchPlayerStatus).where(eq(matchPlayerStatus.matchId, matchId));
  }

  async getMatchPlayerStatus(matchId: string, playerId: string): Promise<MatchPlayerStatus | undefined> {
    const [status] = await db.select().from(matchPlayerStatus)
      .where(and(eq(matchPlayerStatus.matchId, matchId), eq(matchPlayerStatus.playerId, playerId)));
    return status;
  }

  async upsertMatchPlayerStatus(data: {
    matchId: string;
    playerId: string;
    adminStatus?: string;
    actualParticipationStatus?: string;
    officialImpactSubUsed?: boolean;
    sourceType?: string;
  }): Promise<MatchPlayerStatus> {
    const existing = await this.getMatchPlayerStatus(data.matchId, data.playerId);
    if (existing) {
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (data.adminStatus !== undefined) updateData.adminStatus = data.adminStatus;
      if (data.actualParticipationStatus !== undefined) updateData.actualParticipationStatus = data.actualParticipationStatus;
      if (data.officialImpactSubUsed !== undefined) updateData.officialImpactSubUsed = data.officialImpactSubUsed;
      if (data.sourceType !== undefined) updateData.sourceType = data.sourceType;
      const [updated] = await db.update(matchPlayerStatus)
        .set(updateData)
        .where(eq(matchPlayerStatus.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(matchPlayerStatus).values({
        matchId: data.matchId,
        playerId: data.playerId,
        adminStatus: data.adminStatus || "not_active",
        actualParticipationStatus: data.actualParticipationStatus || "unknown",
        officialImpactSubUsed: data.officialImpactSubUsed || false,
        sourceType: data.sourceType || "admin",
      }).returning();
      return created;
    }
  }

  async bulkSetAdminStatus(matchId: string, playerIds: string[], adminStatus: string): Promise<void> {
    for (const playerId of playerIds) {
      await this.upsertMatchPlayerStatus({ matchId, playerId, adminStatus, sourceType: "admin" });
    }
  }

  async getImpactSubPlayers(matchId: string): Promise<MatchPlayerStatus[]> {
    return db.select().from(matchPlayerStatus)
      .where(and(
        eq(matchPlayerStatus.matchId, matchId),
        eq(matchPlayerStatus.officialImpactSubUsed, true)
      ));
  }

  // ====== User Weekly Usage ======
  async getUserWeeklyUsage(userId: string, weekStartDate?: string): Promise<UserWeeklyUsage | undefined> {
    const week = weekStartDate || this.getISTWeekStart();
    const [usage] = await db.select().from(userWeeklyUsage)
      .where(and(eq(userWeeklyUsage.userId, userId), eq(userWeeklyUsage.weekStartDate, week)));
    return usage;
  }

  async getOrCreateWeeklyUsage(userId: string, weekStartDate?: string): Promise<UserWeeklyUsage> {
    const week = weekStartDate || this.getISTWeekStart();
    const existing = await this.getUserWeeklyUsage(userId, week);
    if (existing) return existing;
    const [created] = await db.insert(userWeeklyUsage).values({
      userId,
      weekStartDate: week,
      multiTeamUsageCount: 0,
      invisibleModeUsageCount: 0,
    }).returning();
    return created;
  }

  async incrementMultiTeamUsage(userId: string): Promise<UserWeeklyUsage> {
    const usage = await this.getOrCreateWeeklyUsage(userId);
    const [updated] = await db.update(userWeeklyUsage)
      .set({ multiTeamUsageCount: usage.multiTeamUsageCount + 1 })
      .where(eq(userWeeklyUsage.id, usage.id))
      .returning();
    return updated;
  }

  async incrementInvisibleUsage(userId: string): Promise<UserWeeklyUsage> {
    const usage = await this.getOrCreateWeeklyUsage(userId);
    const [updated] = await db.update(userWeeklyUsage)
      .set({ invisibleModeUsageCount: usage.invisibleModeUsageCount + 1 })
      .where(eq(userWeeklyUsage.id, usage.id))
      .returning();
    return updated;
  }

  async decrementInvisibleUsage(userId: string): Promise<void> {
    const usage = await this.getOrCreateWeeklyUsage(userId);
    if (usage.invisibleModeUsageCount > 0) {
      await db.update(userWeeklyUsage)
        .set({ invisibleModeUsageCount: usage.invisibleModeUsageCount - 1 })
        .where(eq(userWeeklyUsage.id, usage.id));
    }
  }

  canUseMultiTeam(usage: UserWeeklyUsage): boolean {
    return usage.multiTeamUsageCount < 3;
  }

  canUseInvisibleMode(usage: UserWeeklyUsage): boolean {
    return usage.invisibleModeUsageCount < 1;
  }

  // ====== Admin Audit Log ======
  async createAuditLog(data: {
    adminUserId: string;
    actionType: string;
    entityType: string;
    entityId?: string;
    matchId?: string;
    metadata?: string;
  }): Promise<AdminAuditLog> {
    const [log] = await db.insert(adminAuditLog).values({
      adminUserId: data.adminUserId,
      actionType: data.actionType,
      entityType: data.entityType,
      entityId: data.entityId,
      matchId: data.matchId,
      metadata: data.metadata || "",
    }).returning();
    return log;
  }

  async getAuditLogsForMatch(matchId: string): Promise<AdminAuditLog[]> {
    return db.select().from(adminAuditLog)
      .where(eq(adminAuditLog.matchId, matchId))
      .orderBy(desc(adminAuditLog.createdAt));
  }

  async getAllAuditLogs(limit: number = 50): Promise<AdminAuditLog[]> {
    return db.select().from(adminAuditLog)
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(limit);
  }

  // ====== Impact Slot Resolution ======
  async resolveImpactSlot(matchId: string, primaryImpactId: string | null, backupImpactId: string | null): Promise<{
    activePlayerId: string | null;
    activatedBy: "primary" | "backup" | null;
  }> {
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
  async setImpactFeaturesEnabled(matchId: string, enabled: boolean): Promise<void> {
    await db.update(matches)
      .set({ impactFeaturesEnabled: enabled })
      .where(eq(matches.id, matchId));
  }

  async setMatchVoid(matchId: string, isVoid: boolean): Promise<void> {
    await db.update(matches)
      .set({ isVoid })
      .where(eq(matches.id, matchId));
  }

  async setOfficialWinner(matchId: string, winner: string | null): Promise<void> {
    await db.update(matches)
      .set({ officialWinner: winner })
      .where(eq(matches.id, matchId));
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }
}

export const storage = new DatabaseStorage();
