import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { fetchUpcomingMatches } from "./cricket-api";
import session from "express-session";
import { randomUUID } from "crypto";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const ADMIN_EMAILS = ["admin@cdo.com"];

function isAuthenticated(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
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
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "cdo-session-secret-dev",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
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
      if (!username || !email || !password) {
        return res
          .status(400)
          .json({ message: "Username, email, and password are required" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const isAdminUser = ADMIN_EMAILS.includes(email);
      const user = await storage.createUser({
        username,
        email,
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
          isVerified: user.isVerified,
          isAdmin: user.isAdmin,
        },
      });
    } catch (err: any) {
      console.error("Signup error:", err);
      return res.status(500).json({ message: "Signup failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
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
          isVerified: user.isVerified,
          isAdmin: user.isAdmin,
        },
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
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
      },
    });
  });

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
    const allMatches = await storage.getAllMatches();
    const now = new Date();
    const ONE_HOUR = 60 * 60 * 1000;
    const THREE_HOURS = 3 * ONE_HOUR;

    const matchesWithParticipants: { match: typeof allMatches[0]; participantCount: number }[] = [];

    for (const m of allMatches) {
      const start = new Date(m.startTime).getTime();
      const diff = start - now.getTime();
      const elapsed = now.getTime() - start;

      const teams = await storage.getAllTeamsForMatch(m.id);
      const participantCount = teams.length;

      const isUpcomingSoon = m.status !== "completed" && m.status !== "live" && diff > 0 && diff <= ONE_HOUR;
      const isRecentlyLive = m.status === "live" && elapsed <= THREE_HOURS;
      const hasParticipants = participantCount > 0;

      if (hasParticipants || isUpcomingSoon || isRecentlyLive) {
        matchesWithParticipants.push({ match: m, participantCount });
      }
    }

    matchesWithParticipants.sort((a, b) => {
      if (a.participantCount > 0 && b.participantCount === 0) return -1;
      if (a.participantCount === 0 && b.participantCount > 0) return 1;
      const order: Record<string, number> = { upcoming: 0, live: 1, completed: 2 };
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
      return res.json({ match });
    }
  );

  app.get(
    "/api/matches/:id/players",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const matchPlayers = await storage.getPlayersForMatch(req.params.id);
      return res.json({ players: matchPlayers });
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

      const allUsers: Record<string, string> = {};
      for (const t of allTeams) {
        if (!allUsers[t.userId]) {
          const u = await storage.getUser(t.userId);
          allUsers[t.userId] = u?.username || "Unknown";
        }
      }

      if (isLive) {
        const teamsWithInfo = allTeams.map((t) => ({
          ...t,
          username: allUsers[t.userId] || "Unknown",
        }));
        return res.json({ teams: teamsWithInfo, visibility: "full" });
      } else {
        const hiddenTeams = allTeams.map((t) => ({
          id: t.id,
          userId: t.userId,
          matchId: t.matchId,
          name: t.name,
          username: allUsers[t.userId] || "Unknown",
          playerIds: t.userId === req.session.userId ? t.playerIds : "HIDDEN",
          captainId: t.userId === req.session.userId ? t.captainId : "HIDDEN",
          viceCaptainId:
            t.userId === req.session.userId ? t.viceCaptainId : "HIDDEN",
          totalPoints: t.totalPoints,
          createdAt: t.createdAt,
        }));
        return res.json({ teams: hiddenTeams, visibility: "hidden" });
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

  app.delete(
    "/api/teams/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      await storage.deleteUserTeam(req.params.id, req.session.userId!);
      return res.json({ ok: true });
    }
  );

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

        for (const m of apiMatches) {
          const existing = await storage.getAllMatches();
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
          }
        }

        return res.json({
          synced: created,
          total: apiMatches.length,
          message: `Synced ${created} new matches from Cricket API`,
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

  const httpServer = createServer(app);
  return httpServer;
}
