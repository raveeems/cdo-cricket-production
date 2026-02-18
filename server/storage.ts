import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  referenceCodes,
  matches,
  players,
  userTeams,
  codeVerifications,
  type InsertUser,
  type User,
  type ReferenceCode,
  type Match,
  type Player,
  type UserTeam,
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
  }): Promise<UserTeam> {
    const [team] = await db.insert(userTeams).values(data).returning();
    return team;
  }

  async updateUserTeam(teamId: string, userId: string, data: {
    playerIds: string[];
    captainId: string;
    viceCaptainId: string;
    name?: string;
  }): Promise<UserTeam> {
    const [updated] = await db.update(userTeams)
      .set({
        playerIds: data.playerIds,
        captainId: data.captainId,
        viceCaptainId: data.viceCaptainId,
        ...(data.name ? { name: data.name } : {}),
      })
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
      .set({ isPlayingXI: false })
      .where(eq(players.matchId, matchId));

    let updated = 0;
    for (const extId of externalPlayerIds) {
      const result = await db
        .update(players)
        .set({ isPlayingXI: true })
        .where(and(eq(players.matchId, matchId), eq(players.externalId, extId)));
      updated++;
    }
    return updated;
  }

  async markPlayingXIByIds(matchId: string, playerIds: string[]): Promise<number> {
    if (playerIds.length === 0) return 0;

    await db
      .update(players)
      .set({ isPlayingXI: false })
      .where(eq(players.matchId, matchId));

    let updated = 0;
    for (const pid of playerIds) {
      await db
        .update(players)
        .set({ isPlayingXI: true })
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
}

export const storage = new DatabaseStorage();
