import { eq, and } from "drizzle-orm";
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

  async deleteUserTeam(teamId: string, userId: string): Promise<void> {
    await db
      .delete(userTeams)
      .where(and(eq(userTeams.id, teamId), eq(userTeams.userId, userId)));
  }

  async updateUserTeamPoints(teamId: string, totalPoints: number): Promise<void> {
    await db.update(userTeams).set({ totalPoints }).where(eq(userTeams.id, teamId));
  }
}

export const storage = new DatabaseStorage();
