import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { db } from "./db";
import { userTeams } from "@shared/schema";
import { eq } from "drizzle-orm";
import { fetchUpcomingMatches, fetchSeriesMatches, refreshStaleMatchStatuses, fetchMatchScorecard, fetchMatchInfo } from "./cricket-api";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { randomUUID, createHmac } from "crypto";
import pg from "pg";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const ADMIN_PHONES = ["9840872462", "9884334973"];
const TOKEN_SECRET = process.env.SESSION_SECRET || "cdo-session-secret-dev";

function generateAuthToken(userId: string): string {
  const hmac = createHmac("sha256", TOKEN_SECRET);
  hmac.update(userId);
  const sig = hmac.digest("hex");
  return `${userId}.${sig}`;
}

function verifyAuthToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [userId, sig] = parts;
  const hmac = createHmac("sha256", TOKEN_SECRET);
  hmac.update(userId);
  const expected = hmac.digest("hex");
  if (sig !== expected) return null;
  return userId;
}

function isAuthenticated(req: Request, res: Response, next: Function) {
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
    console.log(`Auth failed: No session or bearer token for ${req.path}, auth header: ${authHeader || 'none'}`);
  }

  return res.status(401).json({ message: "Not authenticated" });
}

async function isAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  const PgStore = connectPgSimple(session);
  const sessionPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  app.use(
    session({
      store: new PgStore({
        pool: sessionPool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "cdo-session-secret-dev",
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        secure: "auto" as any,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  // ---- AUTH ----
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { username, email, phone, password } = req.body;
      if (!username || !phone || !password) {
        return res
          .status(400)
          .json({ message: "Username, phone number, and password are required" });
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
        password,
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
          isAdmin: user.isAdmin,
        },
        token: generateAuthToken(user.id),
      });
    } catch (err: any) {
      console.error("Signup error:", err);
      return res.status(500).json({ message: "Signup failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res
          .status(400)
          .json({ message: "Phone number and password are required" });
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
          isAdmin: user.isAdmin,
        },
        token: generateAuthToken(user.id),
      });
    } catch (err: any) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {});
    return res.json({ ok: true });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    let userId = req.session.userId;

    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        userId = verifyAuthToken(authHeader.slice(7)) || undefined;
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
        isAdmin: user.isAdmin,
      },
    });
  });

  app.put(
    "/api/auth/team-name",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { teamName } = req.body;
        if (!teamName || typeof teamName !== "string" || teamName.trim().length === 0) {
          return res.status(400).json({ message: "Team name is required" });
        }
        if (teamName.trim().length > 30) {
          return res.status(400).json({ message: "Team name must be 30 characters or less" });
        }
        await storage.updateUserTeamName(req.session.userId!, teamName.trim());
        return res.json({ teamName: teamName.trim() });
      } catch (err: any) {
        console.error("Update team name error:", err);
        return res.status(500).json({ message: "Failed to update team name" });
      }
    }
  );

  // ---- REFERENCE CODES ----
  app.post(
    "/api/auth/verify-code",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { code } = req.body;
        if (!code || code.length !== 4) {
          return res.status(400).json({ message: "Invalid code format" });
        }

        const codeRecord = await storage.getActiveCode(code);
        if (!codeRecord) {
          return res.status(400).json({ message: "Invalid or inactive code" });
        }

        await storage.updateUserVerified(req.session.userId!, true);
        await storage.logCodeVerification(req.session.userId!, codeRecord.id);

        return res.json({ verified: true });
      } catch (err: any) {
        console.error("Code verification error:", err);
        return res.status(500).json({ message: "Verification failed" });
      }
    }
  );

  // ---- ADMIN: CODES ----
  app.get(
    "/api/admin/codes",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      const codes = await storage.getAllCodes();
      return res.json({ codes });
    }
  );

  app.post(
    "/api/admin/codes",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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
      } catch (err: any) {
        console.error("Create code error:", err);
        return res.status(500).json({ message: "Failed to create code" });
      }
    }
  );

  app.delete(
    "/api/admin/codes/:id",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      await storage.deleteCode(req.params.id);
      return res.json({ ok: true });
    }
  );

  // ---- ADMIN: MAKE ADMIN ----
  app.post(
    "/api/admin/make-admin",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId required" });
      await storage.setUserAdmin(userId, true);
      return res.json({ ok: true });
    }
  );

  // ---- MATCHES ----
  app.get("/api/matches", isAuthenticated, async (_req: Request, res: Response) => {
    try { await refreshStaleMatchStatuses(); } catch (e) { console.error("Status refresh error:", e); }
    const allMatches = await storage.getAllMatches();
    const now = new Date();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const THREE_HOURS = 3 * 60 * 60 * 1000;

    const matchesWithParticipants: { match: typeof allMatches[0]; participantCount: number }[] = [];

    for (const m of allMatches) {
      const start = new Date(m.startTime).getTime();
      const diff = start - now.getTime();
      const elapsed = now.getTime() - start;

      const effectiveStatus = m.status;

      const teams = await storage.getAllTeamsForMatch(m.id);
      const uniqueUsers = new Set(teams.map(t => t.userId));
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
      const order: Record<string, number> = { upcoming: 0, delayed: 0, live: 1, completed: 2 };
      const oa = order[a.match.status] ?? 1;
      const ob = order[b.match.status] ?? 1;
      if (oa !== ob) return oa - ob;
      return new Date(a.match.startTime).getTime() - new Date(b.match.startTime).getTime();
    });

    const result = matchesWithParticipants.map((mp) => ({
      ...mp.match,
      participantCount: mp.participantCount,
    }));

    return res.json({ matches: result });
  });

  app.get(
    "/api/matches/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });
      const allTeams = await storage.getAllTeamsForMatch(req.params.id);
      const uniqueUsers = new Set(allTeams.map(t => t.userId));
      return res.json({ match: { ...match, spotsFilled: uniqueUsers.size, participantCount: uniqueUsers.size } });
    }
  );

  app.get(
    "/api/matches/:id/players",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const matchId = req.params.id;
      let matchPlayers = await storage.getPlayersForMatch(matchId);

      if (matchPlayers.length === 0) {
        const match = await storage.getMatch(matchId);
        if (match?.externalId) {
          try {
            const { fetchMatchSquad, fetchSeriesSquad } = await import("./cricket-api");
            let squad = await fetchMatchSquad(match.externalId);

            if (squad.length === 0 && match.seriesId) {
              console.log(`Match squad empty, trying series squad for series ${match.seriesId}...`);
              const seriesPlayers = await fetchSeriesSquad(match.seriesId);
              const team1 = match.team1.toLowerCase();
              const team2 = match.team2.toLowerCase();
              squad = seriesPlayers.filter((p) => {
                const pTeam = p.team.toLowerCase();
                return pTeam === team1 || pTeam === team2 ||
                  pTeam.includes(team1) || team1.includes(pTeam) ||
                  pTeam.includes(team2) || team2.includes(pTeam);
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
                credits: p.credits,
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

      const match = matchPlayers.length > 0
        ? await storage.getMatch(matchId)
        : null;
      if (match && (match.status === "live" || match.status === "delayed") && match.externalId) {
        const xiCount = await storage.getPlayingXICount(matchId);
        if (xiCount < 22) {
          try {
            const { fetchPlayingXIFromScorecard, fetchPlayingXIFromMatchInfo } = await import("./cricket-api");
            let playingIds = await fetchPlayingXIFromScorecard(match.externalId);
            if (playingIds.length === 0) {
              try {
                const { markPlayingXIFromApiCricket } = await import("./api-cricket");
                const matchDateStr = match.startTime ? new Date(match.startTime).toISOString().split("T")[0] : undefined;
                const result = await markPlayingXIFromApiCricket(matchId, match.team1Short, match.team2Short, matchDateStr);
                if (result.matched > 0) {
                  console.log(`api-cricket.com (2nd tier): matched ${result.matched} Playing XI players`);
                }
              } catch (e) {
                console.error("api-cricket.com Playing XI error:", e);
              }
            }
            if (playingIds.length === 0) {
              playingIds = await fetchPlayingXIFromMatchInfo(match.externalId);
            }
            if (playingIds.length >= 2) {
              await storage.markPlayingXI(matchId, playingIds);
            }
            matchPlayers = await storage.getPlayersForMatch(matchId);
          } catch (err) {
            console.error("Playing XI auto-refresh error:", err);
          }
        }
      }

      return res.json({ players: matchPlayers });
    }
  );

  app.post(
    "/api/matches/:id/sync-scorecard",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const matchId = req.params.id;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });
      if (!match.externalId) return res.status(400).json({ message: "No external match ID" });

      try {
        const { fetchMatchScorecard } = await import("./cricket-api");
        const pointsMap = await fetchMatchScorecard(match.externalId);

        if (pointsMap.size === 0) {
          return res.json({ message: "No scorecard data available yet", updated: 0 });
        }

        const matchPlayers = await storage.getPlayersForMatch(matchId);
        let updated = 0;
        for (const player of matchPlayers) {
          if (player.externalId && pointsMap.has(player.externalId)) {
            const pts = pointsMap.get(player.externalId)!;
            await storage.updatePlayer(player.id, { points: pts });
            updated++;
          }
        }

        const updatedMatchPlayers = await storage.getPlayersForMatch(matchId);
        const playerById = new Map(updatedMatchPlayers.map(p => [p.id, p]));
        const playerByExtId = new Map(updatedMatchPlayers.filter(p => p.externalId).map(p => [p.externalId!, p]));
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        for (const team of allTeams) {
          const teamPlayerIds = team.playerIds as string[];
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
          await storage.updateUserTeamPoints(team.id, totalPoints);
        }

        return res.json({ message: `Updated ${updated} player scores`, updated });
      } catch (err: any) {
        console.error("Scorecard sync error:", err);
        return res.status(500).json({ message: "Failed to sync scorecard" });
      }
    }
  );

  // ---- LIVE SCORECARD ----
  app.get(
    "/api/matches/:id/live-scorecard",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });
      if (!match.externalId) return res.status(400).json({ message: "No external match ID" });

      try {
        const { fetchLiveScorecard } = await import("./cricket-api");
        const scorecard = await fetchLiveScorecard(match.externalId);
        if (!scorecard) {
          return res.json({ scorecard: null, message: "No scorecard data available yet" });
        }
        return res.json({ scorecard });
      } catch (err: any) {
        console.error("Live scorecard error:", err);
        return res.status(500).json({ message: "Failed to fetch scorecard" });
      }
    }
  );

  // ---- LIVE SCORE (lightweight - match_info) ----
  app.get(
    "/api/matches/:id/live-score",
    isAuthenticated,
    async (req: Request, res: Response) => {
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
          matchEnded: info.matchEnded,
        });
      } catch (err: any) {
        console.error("Live score error:", err);
        return res.status(500).json({ message: "Failed to fetch live score" });
      }
    }
  );

  // ---- LOCKOUT PROTOCOL: TEAMS ----
  app.get(
    "/api/matches/:id/teams",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const now = new Date();
      const matchStart = new Date(match.startTime);
      const isLive = now.getTime() >= matchStart.getTime();

      const allTeams = await storage.getAllTeamsForMatch(req.params.id);

      const allUsers: Record<string, { username: string; teamName: string }> = {};
      for (const t of allTeams) {
        if (!allUsers[t.userId]) {
          const u = await storage.getUser(t.userId);
          allUsers[t.userId] = {
            username: u?.username || "Unknown",
            teamName: u?.teamName || "",
          };
        }
      }

      if (isLive) {
        const teamsWithInfo = allTeams.map((t) => ({
          ...t,
          username: allUsers[t.userId]?.username || "Unknown",
          userTeamName: allUsers[t.userId]?.teamName || "",
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
          createdAt: t.createdAt,
        }));
        return res.json({ teams: hiddenTeams, visibility: "hidden" });
      }
    }
  );

  app.get(
    "/api/matches/:id/standings",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const matchId = req.params.id as string;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const now = new Date();
      const matchStart = new Date(match.startTime);
      const isLive = now.getTime() >= matchStart.getTime();

      if (!isLive) {
        return res.json({ standings: [], isLive: false, message: "Match has not started yet" });
      }

      try {
        if (match.externalId && (match.status === "live" || match.status === "delayed")) {
          const { fetchMatchScorecard } = await import("./cricket-api");
          const pointsMap = await fetchMatchScorecard(match.externalId);

          if (pointsMap.size > 0) {
            const matchPlayers = await storage.getPlayersForMatch(matchId);
            for (const player of matchPlayers) {
              if (player.externalId && pointsMap.has(player.externalId)) {
                const pts = pointsMap.get(player.externalId)!;
                if (pts !== player.points) {
                  await storage.updatePlayer(player.id, { points: pts });
                }
              }
            }
          }
        }

        {
          const allTeamsForCalc = await storage.getAllTeamsForMatch(matchId);
          const updatedPlayers = await storage.getPlayersForMatch(matchId);
          const playerById = new Map(updatedPlayers.map(p => [p.id, p]));
          const playerByExtId = new Map(updatedPlayers.filter(p => p.externalId).map(p => [p.externalId!, p]));
          for (const team of allTeamsForCalc) {
            const teamPlayerIds = team.playerIds as string[];
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
            if (totalPoints !== (team.totalPoints || 0)) {
              await storage.updateUserTeamPoints(team.id, totalPoints);
            }
          }
        }

        const allTeams = await storage.getAllTeamsForMatch(matchId);
        const allUsers: Record<string, { username: string; teamName: string }> = {};
        for (const t of allTeams) {
          if (!allUsers[t.userId]) {
            const u = await storage.getUser(t.userId);
            allUsers[t.userId] = {
              username: u?.username || "Unknown",
              teamName: u?.teamName || "",
            };
          }
        }

        const standings = allTeams
          .map((t) => ({
            teamId: t.id,
            teamName: t.name,
            userId: t.userId,
            username: allUsers[t.userId]?.username || "Unknown",
            userTeamName: allUsers[t.userId]?.teamName || "",
            totalPoints: t.totalPoints || 0,
            playerIds: t.playerIds,
            captainId: t.captainId,
            viceCaptainId: t.viceCaptainId,
          }))
          .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

        let rank = 1;
        const rankedStandings = standings.map((s, i) => {
          if (i > 0 && s.totalPoints < standings[i - 1].totalPoints) {
            rank = i + 1;
          }
          return { ...s, rank };
        });

        const matchPlayersForResponse = await storage.getPlayersForMatch(matchId);
        return res.json({ standings: rankedStandings, isLive: true, players: matchPlayersForResponse });
      } catch (err: any) {
        console.error("Standings error:", err);
        return res.status(500).json({ message: "Failed to load standings" });
      }
    }
  );

  app.get(
    "/api/my-teams",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const teams = await storage.getUserTeams(req.session.userId!);
      return res.json({ teams });
    }
  );

  app.get(
    "/api/my-teams/:matchId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const teams = await storage.getUserTeamsForMatch(
        req.session.userId!,
        req.params.matchId
      );
      return res.json({ teams });
    }
  );

  app.post(
    "/api/teams",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { matchId, name, playerIds, captainId, viceCaptainId } = req.body;

        const match = await storage.getMatch(matchId);
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }

        const now = new Date();
        const matchStart = new Date(match.startTime);
        if (now.getTime() >= matchStart.getTime() - 1000) {
          return res
            .status(400)
            .json({ message: "Entry deadline has passed" });
        }
        if (match.status === "live" || match.status === "completed") {
          return res
            .status(400)
            .json({ message: "Match has already started" });
        }

        const existingTeams = await storage.getUserTeamsForMatch(
          req.session.userId!,
          matchId
        );
        if (existingTeams.length >= 3) {
          return res
            .status(400)
            .json({ message: "Maximum 3 teams per match" });
        }

        if (!playerIds || playerIds.length !== 11) {
          return res
            .status(400)
            .json({ message: "Must select exactly 11 players" });
        }

        if (!captainId || !viceCaptainId) {
          return res
            .status(400)
            .json({ message: "Captain and Vice-Captain required" });
        }

        const sortedNewIds = [...playerIds].sort();
        for (const et of existingTeams) {
          const sortedExisting = [...(et.playerIds || [])].sort();
          if (sortedNewIds.length === sortedExisting.length && sortedNewIds.every((id, i) => id === sortedExisting[i])) {
            return res.status(400).json({ message: "You already have a team with the same players" });
          }
        }

        const team = await storage.createUserTeam({
          userId: req.session.userId!,
          matchId,
          name: name || `Team ${existingTeams.length + 1}`,
          playerIds,
          captainId,
          viceCaptainId,
        });

        return res.json({ team });
      } catch (err: any) {
        console.error("Create team error:", err);
        return res.status(500).json({ message: "Failed to create team" });
      }
    }
  );

  app.put(
    "/api/teams/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
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
        const now = new Date();
        const matchStart = new Date(match.startTime);
        if (now.getTime() >= matchStart.getTime() - 1000) {
          return res.status(400).json({ message: "Entry deadline has passed" });
        }
        if (match.status === "live" || match.status === "completed") {
          return res.status(400).json({ message: "Match has already started" });
        }

        const { playerIds, captainId, viceCaptainId } = req.body;
        if (!playerIds || playerIds.length !== 11) {
          return res.status(400).json({ message: "Must select exactly 11 players" });
        }
        if (!captainId || !viceCaptainId) {
          return res.status(400).json({ message: "Captain and Vice-Captain required" });
        }

        const existingTeams = await storage.getUserTeamsForMatch(req.session.userId!, team.matchId);
        const sortedNewIds = [...playerIds].sort();
        for (const et of existingTeams) {
          if (et.id === team.id) continue;
          const sortedExisting = [...(et.playerIds || [])].sort();
          if (sortedNewIds.length === sortedExisting.length && sortedNewIds.every((id: string, i: number) => id === sortedExisting[i])) {
            return res.status(400).json({ message: "You already have a team with the same players" });
          }
        }

        const updated = await storage.updateUserTeam(req.params.id, req.session.userId!, {
          playerIds,
          captainId,
          viceCaptainId,
        });
        return res.json({ team: updated });
      } catch (err: any) {
        console.error("Update team error:", err);
        return res.status(500).json({ message: "Failed to update team" });
      }
    }
  );

  app.delete(
    "/api/teams/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
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
          const now = new Date();
          const matchStart = new Date(match.startTime);
          const isDelayed = match.status === "delayed";
          if (match.status === "live" || match.status === "completed") {
            return res.status(400).json({ message: "Cannot delete team after match has started" });
          }
          if (!isDelayed && now.getTime() >= matchStart.getTime() - 1000) {
            return res.status(400).json({ message: "Cannot delete team after deadline has passed" });
          }
        }
        await storage.deleteUserTeam(req.params.id, req.session.userId!);
        return res.json({ ok: true });
      } catch (err: any) {
        console.error("Delete team error:", err);
        return res.status(500).json({ message: "Failed to delete team" });
      }
    }
  );

  // ---- LEADERBOARD ----
  app.get("/api/leaderboard", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      return res.json(leaderboard);
    } catch (e: any) {
      return res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // ---- SERVER TIME ----
  app.get("/api/server-time", (_req: Request, res: Response) => {
    return res.json({ serverTime: new Date().toISOString() });
  });

  // ---- CRICKET API: SYNC ----
  app.post(
    "/api/admin/sync-matches",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
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
              spotsFilled: 0,
            });
            created++;
          } else {
            const updates: Record<string, any> = {};
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
          message: `Synced ${created} new, updated ${updated} existing matches from Cricket API`,
        });
      } catch (err: any) {
        console.error("Sync error:", err);
        return res.status(500).json({ message: "Sync failed" });
      }
    }
  );

  // ---- ADMIN: CREATE MATCH MANUALLY ----
  app.post(
    "/api/admin/matches",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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
          league,
        } = req.body;

        if (!team1 || !team2 || !startTime) {
          return res
            .status(400)
            .json({ message: "team1, team2, and startTime are required" });
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
          spotsFilled: 0,
        });

        return res.json({ match });
      } catch (err: any) {
        console.error("Create match error:", err);
        return res.status(500).json({ message: "Failed to create match" });
      }
    }
  );

  // ---- ADMIN: ADD PLAYERS TO MATCH ----
  app.post(
    "/api/admin/matches/:id/players",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { players: playerList } = req.body;
        if (!playerList || !Array.isArray(playerList)) {
          return res.status(400).json({ message: "players array required" });
        }

        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const playersToCreate = playerList.map((p: any) => ({
          matchId,
          name: p.name,
          team: p.team,
          teamShort: p.teamShort || p.team.substring(0, 3).toUpperCase(),
          role: p.role || "BAT",
          credits: p.credits || 8,
          points: p.points || 0,
          selectedBy: p.selectedBy || 0,
          recentForm: p.recentForm || [],
          isImpactPlayer: p.isImpactPlayer || false,
        }));

        await storage.bulkCreatePlayers(playersToCreate);

        return res.json({
          message: `Added ${playersToCreate.length} players`,
        });
      } catch (err: any) {
        console.error("Add players error:", err);
        return res.status(500).json({ message: "Failed to add players" });
      }
    }
  );

  // ---- ADMIN: REFRESH PLAYING XI ----
  app.post(
    "/api/admin/matches/:id/refresh-playing-xi",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (!match.externalId) return res.status(400).json({ message: "No external match ID" });

        const { fetchPlayingXIFromScorecard, fetchPlayingXIFromMatchInfo } = await import("./cricket-api");
        let playingIds = await fetchPlayingXIFromScorecard(match.externalId);
        let source = "scorecard";
        if (playingIds.length === 0) {
          try {
            const { markPlayingXIFromApiCricket } = await import("./api-cricket");
            const matchDateStr = match.startTime ? new Date(match.startTime).toISOString().split("T")[0] : undefined;
            const result = await markPlayingXIFromApiCricket(matchId, match.team1Short, match.team2Short, matchDateStr);
            if (result.matched > 0) {
              source = "api-cricket.com";
              return res.json({ message: `Playing XI updated via api-cricket.com: ${result.matched} players matched`, count: result.matched, source });
            }
          } catch (e) {
            console.error("api-cricket.com Playing XI error:", e);
          }
        }
        if (playingIds.length === 0) {
          playingIds = await fetchPlayingXIFromMatchInfo(match.externalId);
          source = "match_info";
        }
        if (playingIds.length === 0) {
          return res.json({ message: "No Playing XI data available yet - match may not have started", count: 0 });
        }

        await storage.markPlayingXI(matchId, playingIds);
        return res.json({ message: `Playing XI updated: ${playingIds.length} players marked`, count: playingIds.length, source });
      } catch (err: any) {
        console.error("Refresh Playing XI error:", err);
        return res.status(500).json({ message: "Failed to refresh Playing XI" });
      }
    }
  );

  // ---- ADMIN: VERIFY & SYNC MATCH VIA CRICBUZZ ----
  app.post(
    "/api/admin/matches/:id/verify-cricbuzz",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const syncScorecard = req.body?.syncScorecard === true;

        const { verifyAndSyncMatch } = await import("./cricbuzz-api");
        const result = await verifyAndSyncMatch(
          matchId,
          match.team1Short,
          match.team2Short,
          match.startTime?.toISOString(),
          syncScorecard
        );

        return res.json({
          match: {
            id: match.id,
            team1: match.team1,
            team1Short: match.team1Short,
            team2: match.team2,
            team2Short: match.team2Short,
            venue: match.venue,
            startTime: match.startTime,
            status: match.status,
          },
          verification: result,
        });
      } catch (err: any) {
        console.error("Cricbuzz verify error:", err);
        return res.status(500).json({ message: "Failed to verify via Cricbuzz" });
      }
    }
  );

  // ---- ADMIN: SYNC SCORECARD FROM CRICBUZZ ----
  app.post(
    "/api/admin/matches/:id/sync-cricbuzz-scorecard",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const { findCricbuzzMatch, fetchCricbuzzLiveScorecard } = await import("./cricbuzz-api");
        const cbMatch = await findCricbuzzMatch(
          match.team1Short,
          match.team2Short,
          match.startTime?.toISOString()
        );

        if (!cbMatch) {
          return res.status(404).json({ message: "Match not found on Cricbuzz" });
        }

        const scorecard = await fetchCricbuzzLiveScorecard(cbMatch.matchId);
        if (!scorecard) {
          return res.json({ message: "No scorecard data available from Cricbuzz yet", scorecard: null });
        }

        return res.json({
          message: "Scorecard fetched from Cricbuzz",
          scorecard,
          cricbuzzMatchId: cbMatch.matchId,
        });
      } catch (err: any) {
        console.error("Cricbuzz scorecard sync error:", err);
        return res.status(500).json({ message: "Failed to sync Cricbuzz scorecard" });
      }
    }
  );

  // ---- CRICBUZZ LIVE SCORECARD FALLBACK ----
  app.get(
    "/api/matches/:id/cricbuzz-scorecard",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const match = await storage.getMatch(req.params.id);
      if (!match) return res.status(404).json({ message: "Match not found" });

      try {
        const { findCricbuzzMatch, fetchCricbuzzLiveScorecard } = await import("./cricbuzz-api");
        const cbMatch = await findCricbuzzMatch(
          match.team1Short,
          match.team2Short,
          match.startTime?.toISOString()
        );

        if (!cbMatch) {
          return res.json({ scorecard: null, message: "Match not found on Cricbuzz" });
        }

        const scorecard = await fetchCricbuzzLiveScorecard(cbMatch.matchId);
        if (!scorecard) {
          return res.json({ scorecard: null, message: "No scorecard data from Cricbuzz yet" });
        }

        return res.json({ scorecard, source: "cricbuzz" });
      } catch (err: any) {
        console.error("Cricbuzz scorecard fallback error:", err);
        return res.status(500).json({ message: "Failed to fetch Cricbuzz scorecard" });
      }
    }
  );

  app.post(
    "/api/admin/matches/:id/repair-teams",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const matchPlayers = await storage.getPlayersForMatch(matchId);
        if (matchPlayers.length === 0) {
          return res.json({ message: "No players found for this match", repaired: 0 });
        }

        const playerById = new Map(matchPlayers.map(p => [p.id, p]));
        const playerByExtId = new Map(matchPlayers.filter(p => p.externalId).map(p => [p.externalId!, p]));

        const allTeams = await storage.getAllTeamsForMatch(matchId);
        let repaired = 0;

        for (const team of allTeams) {
          const teamPlayerIds = team.playerIds as string[];
          let hasOrphans = false;
          for (const pid of teamPlayerIds) {
            if (!playerById.has(pid)) {
              hasOrphans = true;
              break;
            }
          }
          if (!hasOrphans) continue;

          const newPlayerIds: string[] = [];
          let newCaptainId = team.captainId;
          let newViceCaptainId = team.viceCaptainId;
          const usedPlayerIds = new Set<string>();

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
            await db.update(userTeams)
              .set({
                playerIds: newPlayerIds,
                captainId: newCaptainId,
                viceCaptainId: newViceCaptainId,
              })
              .where(eq(userTeams.id, team.id));
            repaired++;
          }
        }

        return res.json({
          message: `Repaired ${repaired} teams out of ${allTeams.length}`,
          repaired,
          total: allTeams.length,
        });
      } catch (err: any) {
        console.error("Repair teams error:", err);
        return res.status(500).json({ message: "Failed to repair teams" });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}
