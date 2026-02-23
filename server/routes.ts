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

const ADMIN_PHONES = ["9840872462", "9884334973", "7406020777"];
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

      if (ADMIN_PHONES.includes(phone) && !user.isAdmin) {
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

  app.post(
    "/api/admin/promote-by-phone",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ message: "phone required" });
      const user = await storage.getUserByPhone(phone);
      if (!user) return res.status(404).json({ message: "User not found" });
      await storage.setUserAdmin(user.id, true);
      return res.json({ ok: true, username: user.username });
    }
  );

  // ---- MATCHES ----
  app.get("/api/matches", isAuthenticated, async (_req: Request, res: Response) => {
    try { await refreshStaleMatchStatuses(); } catch (e) { console.error("Status refresh error:", e); }
    const allMatches = await storage.getAllMatches();
    const nowMs = Date.now();
    const MS_48H = 48 * 60 * 60 * 1000;
    const MS_3H = 3 * 60 * 60 * 1000;

    console.log(`[MatchFeed] Server time: ${new Date(nowMs).toISOString()} | 48h window: now → ${new Date(nowMs + MS_48H).toISOString()}`);

    const matchesWithParticipants: { match: typeof allMatches[0]; participantCount: number }[] = [];

    for (const m of allMatches) {
      const startMs = new Date(m.startTime).getTime();
      const hoursUntilStart = (startMs - nowMs) / 3600000;

      const teams = await storage.getAllTeamsForMatch(m.id);
      const uniqueUsers = new Set(teams.map(t => t.userId));
      const participantCount = uniqueUsers.size;

      const isUpcomingOrDelayed = m.status === "upcoming" || m.status === "delayed";
      const startsWithin48h = startMs <= nowMs + MS_48H;
      const notTooOld = startMs >= nowMs - MS_3H;
      const isUpcoming = isUpcomingOrDelayed && startsWithin48h && notTooOld;

      const isLive = m.status === "live";
      const isDelayed = m.status === "delayed";
      const isRecentlyCompleted = m.status === "completed" && (nowMs - startMs) <= MS_3H;
      const hasParticipants = participantCount > 0;

      const included = hasParticipants || isUpcoming || isLive || isDelayed || isRecentlyCompleted;

      if (isUpcomingOrDelayed) {
        console.log(`[MatchFeed] ${m.team1Short} vs ${m.team2Short} | status=${m.status} | start=${m.startTime} | ${hoursUntilStart.toFixed(1)}h away | within48h=${startsWithin48h} | notTooOld=${notTooOld} | included=${included}`);
      }

      if (included) {
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
        const result = await fetchMatchScorecard(match.externalId);
        const pointsMap = result.pointsMap;
        const namePointsMap = result.namePointsMap;

        if (pointsMap.size === 0) {
          return res.json({ message: "No scorecard data available yet", updated: 0 });
        }

        const matchPlayers = await storage.getPlayersForMatch(matchId);
        let updated = 0;
        for (const player of matchPlayers) {
          let pts: number | undefined = undefined;
          if (player.externalId && pointsMap.has(player.externalId)) {
            pts = pointsMap.get(player.externalId)!;
          }
          if (pts === undefined && namePointsMap.size > 0 && player.name) {
            const normName = player.name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
            if (namePointsMap.has(normName)) {
              pts = namePointsMap.get(normName)!;
            } else {
              for (const [apiName, apiPts] of namePointsMap) {
                if (apiName.includes(normName) || normName.includes(apiName)) {
                  pts = apiPts;
                  break;
                }
                const p1 = apiName.split(" "), p2 = normName.split(" ");
                if (p1.length > 0 && p2.length > 0 && p1[0][0] === p2[0][0]) {
                  const l1 = p1[p1.length-1], l2 = p2[p2.length-1];
                  if (l1 === l2 || (l1.substring(0,3) === l2.substring(0,3) && p1[0].substring(0,3) === p2[0].substring(0,3))) {
                    pts = apiPts;
                    break;
                  }
                }
              }
            }
          }
          if (pts !== undefined) {
            if (player.isPlayingXI) pts += 4;
            await storage.updatePlayer(player.id, { points: pts });
            updated++;
          } else if (player.isPlayingXI) {
            await storage.updatePlayer(player.id, { points: 4 });
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

      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');

      try {
        let scorecard = null;
        let source = "none";

        if (match.externalId) {
          try {
            const { fetchLiveScorecard } = await import("./cricket-api");
            scorecard = await fetchLiveScorecard(match.externalId);
            if (scorecard) source = "CricAPI";
          } catch (apiErr: any) {
            console.error(`[LiveScorecard] Failed to fetch for ${match.externalId}:`, apiErr?.message || apiErr);
          }
        }

        if (!scorecard) {
          return res.json({ scorecard: null, message: "No scorecard data available yet" });
        }
        return res.json({ scorecard, source });
      } catch (err: any) {
        console.error("Live scorecard route error:", err?.message || err);
        return res.json({ scorecard: null, error: err?.message || "Failed to fetch scorecard" });
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

      try {
        let scoreData = null;

        if (match.externalId) {
          const info = await fetchMatchInfo(match.externalId);
          if (info) {
            scoreData = {
              score: info.score || [],
              status: info.status,
              matchStarted: info.matchStarted,
              matchEnded: info.matchEnded,
              source: "CricAPI",
            };
          }
        }

        if (!scoreData) return res.json({ score: null });
        return res.json(scoreData);
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
      const matchPlayers = await storage.getPlayersForMatch(req.params.id);

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
        return res.json({ teams: teamsWithInfo, visibility: "full", players: matchPlayers });
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
        console.log("Receiving Team:", JSON.stringify({ matchId, name, playerIds, captainId, viceCaptainId }));
        console.log("Player IDs count:", playerIds?.length, "IDs:", playerIds);

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

        const matchPlayers = await storage.getPlayersForMatch(matchId);
        const playerMap = new Map(matchPlayers.map(p => [p.id, p]));
        const roleCounts: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
        const teamPlayerCounts: Record<string, number> = {};
        for (const pid of playerIds) {
          const p = playerMap.get(pid);
          if (p) {
            roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
            const ts = p.teamShort || '';
            teamPlayerCounts[ts] = (teamPlayerCounts[ts] || 0) + 1;
          }
        }
        const ROLE_LIMITS: Record<string, { min: number; max: number }> = {
          WK: { min: 1, max: 4 }, BAT: { min: 1, max: 6 },
          AR: { min: 1, max: 6 }, BOWL: { min: 1, max: 6 },
        };
        for (const [role, limits] of Object.entries(ROLE_LIMITS)) {
          const count = roleCounts[role] || 0;
          if (count < limits.min || count > limits.max) {
            return res.status(400).json({ message: `You must select between ${limits.min}-${limits.max} ${role}s` });
          }
        }
        for (const [team, count] of Object.entries(teamPlayerCounts)) {
          if (count > 10) {
            return res.status(400).json({ message: "You can only select a maximum of 10 players from one team." });
          }
        }

        const sortedNewIds = [...playerIds].sort();
        for (const et of existingTeams) {
          const sortedExisting = [...(et.playerIds || [])].sort();
          const samePlayerIds = sortedNewIds.length === sortedExisting.length && sortedNewIds.every((id, i) => id === sortedExisting[i]);
          if (samePlayerIds && et.captainId === captainId && et.viceCaptainId === viceCaptainId) {
            return res.status(400).json({ message: "You have already created this exact team. Please change at least one player or the Captain/VC." });
          }
        }

        const existingPrediction = await storage.getUserPredictionForMatch(req.session.userId!, matchId);
        if (!existingPrediction) {
          return res.status(400).json({ message: "You must predict a match winner before submitting your team." });
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
        console.error("CRITICAL TEAM SAVE ERROR:", err);
        console.error("CRITICAL TEAM SAVE STACK:", err?.stack);
        return res.status(500).json({
          message: "Server Crash: " + (err?.message || "Unknown Error"),
          details: String(err?.stack || err),
        });
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

        const matchPlayers = await storage.getPlayersForMatch(team.matchId);
        const playerMap = new Map(matchPlayers.map(p => [p.id, p]));
        const roleCounts: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
        const teamPlayerCounts: Record<string, number> = {};
        for (const pid of playerIds) {
          const p = playerMap.get(pid);
          if (p) {
            roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
            const ts = p.teamShort || '';
            teamPlayerCounts[ts] = (teamPlayerCounts[ts] || 0) + 1;
          }
        }
        const ROLE_LIMITS: Record<string, { min: number; max: number }> = {
          WK: { min: 1, max: 4 }, BAT: { min: 1, max: 6 },
          AR: { min: 1, max: 6 }, BOWL: { min: 1, max: 6 },
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

        const existingTeams = await storage.getUserTeamsForMatch(req.session.userId!, team.matchId);
        const sortedNewIds = [...playerIds].sort();
        for (const et of existingTeams) {
          if (et.id === team.id) continue;
          const sortedExisting = [...(et.playerIds || [])].sort();
          const samePlayerIds = sortedNewIds.length === sortedExisting.length && sortedNewIds.every((id: string, i: number) => id === sortedExisting[i]);
          if (samePlayerIds && et.captainId === captainId && et.viceCaptainId === viceCaptainId) {
            return res.status(400).json({ message: "You have already created this exact team. Please change at least one player or the Captain/VC." });
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

  // ---- PREDICTIONS ----
  app.post(
    "/api/predictions",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { matchId, predictedWinner } = req.body;
        if (!matchId || !predictedWinner) {
          return res.status(400).json({ message: "matchId and predictedWinner are required" });
        }
        const match = await storage.getMatch(matchId);
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }
        const now = new Date();
        const matchStart = new Date(match.startTime);
        if (now.getTime() >= matchStart.getTime() - 1000) {
          return res.status(400).json({ message: "Prediction deadline has passed" });
        }
        if (match.status === "live" || match.status === "completed") {
          return res.status(400).json({ message: "Match has already started" });
        }
        if (predictedWinner !== match.team1Short && predictedWinner !== match.team2Short) {
          return res.status(400).json({ message: "Invalid team selection" });
        }
        const existing = await storage.getUserPredictionForMatch(req.session.userId!, matchId);
        let prediction;
        if (existing) {
          prediction = await storage.updatePrediction(req.session.userId!, matchId, predictedWinner);
        } else {
          prediction = await storage.createPrediction({
            userId: req.session.userId!,
            matchId,
            predictedWinner,
          });
        }
        return res.json({ prediction });
      } catch (err: any) {
        console.error("Prediction error:", err);
        return res.status(500).json({ message: "Failed to save prediction" });
      }
    }
  );

  app.get(
    "/api/predictions/:matchId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const match = await storage.getMatch(req.params.matchId);
        if (!match) {
          return res.status(404).json({ message: "Match not found" });
        }
        const isRevealed = match.status === "live" || match.status === "completed";
        const myPrediction = await storage.getUserPredictionForMatch(
          req.session.userId!,
          req.params.matchId
        );
        if (!isRevealed) {
          return res.json({
            isRevealed: false,
            myPrediction: myPrediction
              ? { id: myPrediction.id, predictedWinner: myPrediction.predictedWinner }
              : null,
            predictions: [],
          });
        }
        const allPredictions = await storage.getPredictionsForMatch(req.params.matchId);
        const userIds = [...new Set(allPredictions.map(p => p.userId))];
        const usersData: Record<string, { username: string; teamName: string }> = {};
        for (const uid of userIds) {
          const u = await storage.getUser(uid);
          if (u) usersData[uid] = { username: u.username, teamName: u.teamName || "" };
        }
        const predictions = allPredictions.map(p => ({
          id: p.id,
          userId: p.userId,
          username: usersData[p.userId]?.username || "Unknown",
          teamName: usersData[p.userId]?.teamName || "",
          predictedWinner: p.predictedWinner,
        }));
        return res.json({
          isRevealed: true,
          myPrediction: myPrediction
            ? { id: myPrediction.id, predictedWinner: myPrediction.predictedWinner }
            : null,
          predictions,
        });
      } catch (err: any) {
        console.error("Get predictions error:", err);
        return res.status(500).json({ message: "Failed to fetch predictions" });
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

  // ---- ADMIN: FETCH SQUAD FROM API ----
  app.post(
    "/api/admin/matches/:id/fetch-squad",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      const matchId = req.params.id;
      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      try {
        const { fetchMatchSquad, fetchSeriesSquad } = await import("./cricket-api");
        let squad = await fetchMatchSquad(match.externalId!);
        let source = "CricAPI (match_squad)";
        console.log(`[Fetch Squad] Tier 1 match_squad returned ${squad.length} players for ${match.team1Short} vs ${match.team2Short}`);

        if (squad.length === 0 && match.seriesId) {
          const seriesPlayers = await fetchSeriesSquad(match.seriesId);
          const team1 = match.team1.toLowerCase();
          const team2 = match.team2.toLowerCase();
          const t1Short = match.team1Short.toLowerCase();
          const t2Short = match.team2Short.toLowerCase();
          squad = seriesPlayers.filter((p) => {
            const pTeam = p.team.toLowerCase();
            const pShort = p.teamShort.toLowerCase();
            return pTeam === team1 || pTeam === team2 ||
              pTeam.includes(team1) || team1.includes(pTeam) ||
              pTeam.includes(team2) || team2.includes(pTeam) ||
              pShort === t1Short || pShort === t2Short;
          });
          source = "CricAPI (series_squad)";
          console.log(`[Fetch Squad] Tier 1 series_squad filtered ${squad.length} players`);
        }

        if (squad.length === 0) {
          return res.json({
            message: `No squad data found for ${match.team1Short} vs ${match.team2Short}. API may not have squads yet.`,
            totalPlayers: 0,
            source: "none",
          });
        }

        await storage.upsertPlayersForMatch(matchId, squad.map((p) => ({
          matchId,
          externalId: p.externalId,
          name: p.name,
          team: p.team,
          teamShort: p.teamShort,
          role: p.role,
          credits: p.credits,
        })));

        const matchPlayers = await storage.getPlayersForMatch(matchId);
        return res.json({
          message: `Squad imported successfully! ${matchPlayers.length} players loaded for ${match.team1Short} vs ${match.team2Short}`,
          totalPlayers: matchPlayers.length,
          source,
        });
      } catch (err) {
        console.error("[Fetch Squad] error:", err);
        return res.status(500).json({ message: "Failed to fetch squad from API" });
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
          apiName: p.apiName || null,
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

  // ---- ADMIN: DELETE INDIVIDUAL PLAYER ----
  app.delete(
    "/api/admin/players/:playerId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        await storage.deletePlayer(req.params.playerId);
        return res.json({ message: "Player deleted" });
      } catch (err: any) {
        console.error("Delete player error:", err);
        return res.status(500).json({ message: "Failed to delete player" });
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
          playingIds = await fetchPlayingXIFromMatchInfo(match.externalId);
          source = "match_info";
        }
        if (playingIds.length === 0) {
          return res.json({ message: "No Playing XI data available yet - match may not have started", count: 0 });
        }

        await storage.markPlayingXI(matchId, playingIds);

        const updatedPlayers = await storage.getPlayersForMatch(matchId);
        const playerById = new Map(updatedPlayers.map(p => [p.id, p]));
        const playerByExtId = new Map(updatedPlayers.filter(p => p.externalId).map(p => [p.externalId!, p]));
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

        return res.json({ message: `Playing XI updated: ${playingIds.length} players marked, team points recalculated`, count: playingIds.length, source });
      } catch (err: any) {
        console.error("Refresh Playing XI error:", err);
        return res.status(500).json({ message: "Failed to refresh Playing XI" });
      }
    }
  );

  // ---- ADMIN: MANUAL PLAYING XI ENTRY ----
  app.post(
    "/api/admin/matches/:id/set-playing-xi",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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

        const updatedPlayers = await storage.getPlayersForMatch(matchId);
        const playerById = new Map(updatedPlayers.map(p => [p.id, p]));
        const playerByExtId = new Map(updatedPlayers.filter(p => p.externalId).map(p => [p.externalId!, p]));
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

        return res.json({
          message: `Playing XI manually set: ${updated} players marked, team points recalculated`,
          count: updated,
          source: "admin_manual",
        });
      } catch (err: any) {
        console.error("Manual Playing XI error:", err);
        return res.status(500).json({ message: "Failed to set Playing XI" });
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

  // ---- ADMIN: PURGE MATCH POINTS ----
  app.post(
    "/api/admin/matches/:id/purge-points",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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
          teamsReset,
        });
      } catch (err: any) {
        console.error("Purge points error:", err);
        return res.status(500).json({ message: "Failed to purge points" });
      }
    }
  );

  // ---- ADMIN: GET LAST PLAYING XI FOR A TEAM ----
  app.get(
    "/api/admin/teams/:teamShort/last-playing-xi",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const teamShort = req.params.teamShort;
        const excludeMatchId = req.query.excludeMatch as string | undefined;
        const allMatches = await storage.getAllMatches();
        const relevantMatches = allMatches
          .filter(m => (m.team1Short === teamShort || m.team2Short === teamShort) &&
                       (m.status === 'completed' || m.status === 'live') &&
                       m.id !== excludeMatchId)
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

        if (relevantMatches.length === 0) {
          return res.json({ found: false, message: "No previous match found", playerNames: [] });
        }

        const prevMatch = relevantMatches[0];
        const prevPlayers = await storage.getPlayersForMatch(prevMatch.id);
        const xiPlayers = prevPlayers.filter(p => p.isPlayingXI && p.teamShort === teamShort);
        const playerNames = xiPlayers.map(p => p.name);

        return res.json({
          found: true,
          matchId: prevMatch.id,
          matchLabel: `${prevMatch.team1Short} vs ${prevMatch.team2Short}`,
          playerNames,
          count: playerNames.length,
        });
      } catch (err: any) {
        console.error("Last playing XI error:", err);
        return res.status(500).json({ message: "Failed to fetch last playing XI" });
      }
    }
  );

  // ---- ADMIN: MAP PLAYER MANUALLY ----
  app.post(
    "/api/admin/matches/:matchId/map-player",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { matchId } = req.params;
        const { dbPlayerId, newName, newExternalId, newApiName } = req.body;
        if (!dbPlayerId) return res.status(400).json({ message: "dbPlayerId required" });

        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const player = await storage.getPlayersForMatch(matchId);
        const target = player.find(p => p.id === dbPlayerId);
        if (!target) return res.status(404).json({ message: "Player not found in this match" });

        const updates: any = {};
        if (newName) updates.name = newName;
        if (newExternalId) updates.externalId = newExternalId;
        if (newApiName !== undefined) updates.apiName = newApiName || null;

        if (Object.keys(updates).length > 0) {
          await storage.updatePlayer(dbPlayerId, updates);
          console.log(`[Admin] Mapped player ${target.name} -> name=${newName || target.name}, extId=${newExternalId || target.externalId}`);
        }

        return res.json({
          message: `Player updated: ${target.name} -> ${newName || target.name}`,
          updated: updates,
        });
      } catch (err: any) {
        console.error("Map player error:", err);
        return res.status(500).json({ message: "Failed to map player" });
      }
    }
  );

  app.get(
    "/api/admin/matches/:matchId/player-mapping",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { matchId } = req.params;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        const dbPlayers = await storage.getPlayersForMatch(matchId);

        let scorecardNames: string[] = [];
        if (match.externalId) {
          try {
            const { fetchMatchScorecard } = await import("./cricket-api");
            const result = await fetchMatchScorecard(match.externalId);
            scorecardNames = Array.from(result.namePointsMap.keys());
          } catch (e) {}
        }

        return res.json({
          dbPlayers: dbPlayers.map(p => ({
            id: p.id,
            name: p.name,
            apiName: p.apiName,
            externalId: p.externalId,
            points: p.points,
            role: p.role,
            team: p.team,
            teamShort: p.teamShort,
            isPlayingXI: p.isPlayingXI,
          })),
          scorecardNames,
        });
      } catch (err: any) {
        console.error("Player mapping error:", err);
        return res.status(500).json({ message: "Failed to get player mapping" });
      }
    }
  );

  // ---- ADMIN: MARK MATCH AS COMPLETED ----
  app.post(
    "/api/admin/matches/:id/mark-completed",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const matchId = req.params.id;
        const match = await storage.getMatch(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (match.status === "completed") {
          return res.json({ message: "Match is already completed" });
        }
        await storage.updateMatch(matchId, { status: "completed" });
        console.log(`[Admin] Match ${(match as any).team1Short} vs ${(match as any).team2Short} manually marked as completed`);
        try {
          await distributeMatchReward(matchId);
        } catch (rewardErr) {
          console.error(`[Admin] Reward distribution failed for match ${matchId}:`, rewardErr);
        }
        return res.json({ message: `${(match as any).team1Short} vs ${(match as any).team2Short} marked as completed` });
      } catch (err: any) {
        console.error("Mark completed error:", err);
        return res.status(500).json({ message: "Failed to mark match as completed" });
      }
    }
  );

  // ---- DEBUG: FORCE SYNC (Admin only) ----
  app.post(
    "/api/debug/force-sync",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      const matchId = req.body?.matchId as string | undefined;
      try {
        console.log(`[Force Sync] Admin triggered manual sync${matchId ? ` for match ${matchId}` : ' for all live matches'}`);

        if (matchId) {
          const match = await storage.getMatch(matchId);
          if (!match) {
            return res.status(404).json({ message: "Match not found" });
          }

          if (match.status === "upcoming" || match.status === "delayed") {
            const { fetchMatchSquad, fetchSeriesSquad } = await import("./cricket-api");
            let squad = await fetchMatchSquad(match.externalId!);
            console.log(`[Force Sync] Match squad API returned ${squad.length} players for ${match.team1Short} vs ${match.team2Short}`);

            if (squad.length === 0 && match.seriesId) {
              console.log(`[Force Sync] Match squad empty, trying tournament/series squad for series ${match.seriesId}...`);
              const seriesPlayers = await fetchSeriesSquad(match.seriesId);
              const team1 = match.team1.toLowerCase();
              const team2 = match.team2.toLowerCase();
              const t1Short = match.team1Short.toLowerCase();
              const t2Short = match.team2Short.toLowerCase();
              squad = seriesPlayers.filter((p) => {
                const pTeam = p.team.toLowerCase();
                const pShort = p.teamShort.toLowerCase();
                return pTeam === team1 || pTeam === team2 ||
                  pTeam.includes(team1) || team1.includes(pTeam) ||
                  pTeam.includes(team2) || team2.includes(pTeam) ||
                  pShort === t1Short || pShort === t2Short;
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
                credits: p.credits,
              }));
              await storage.upsertPlayersForMatch(matchId, playersToCreate);
              const matchPlayers = await storage.getPlayersForMatch(matchId);
              return res.json({
                message: `Squad synced: ${matchPlayers.length} players loaded for ${match.team1Short} vs ${match.team2Short}`,
                match: {
                  id: match.id,
                  teams: `${match.team1Short} vs ${match.team2Short}`,
                  status: match.status,
                },
                totalPlayers: matchPlayers.length,
                teamsCount: 0,
              });
            } else {
              return res.json({
                message: `No squad data found for ${match.team1Short} vs ${match.team2Short}. The API may not have squads for this match yet.`,
                totalPlayers: 0,
              });
            }
          }
        }

        const heartbeat = (globalThis as any).__matchHeartbeat;
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
              scoreString: (match as any).scoreString || "",
              lastSyncAt: (match as any).lastSyncAt,
            } : null,
            playersWithPoints: matchPlayers.filter(p => p.points > 0).length,
            totalPlayers: matchPlayers.length,
            teamsCount: teams.length,
          });
        }
        
        return res.json({ message: "Force sync completed for all live matches" });
      } catch (err: any) {
        console.error("Force sync error:", err);
        return res.status(500).json({ message: "Force sync failed: " + err.message });
      }
    }
  );

  // ---- DEBUG: MATCH STATUS (Admin only) ----
  app.get(
    "/api/debug/match-status",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const allMatches = await storage.getAllMatches();
        const now = Date.now();
        const THIRTY_SIX_HOURS = 36 * 60 * 60 * 1000;
        const filteredMatches = allMatches.filter(m => {
          if (m.status !== 'completed') return true;
          const startMs = new Date(m.startTime).getTime();
          return (now - startMs) <= THIRTY_SIX_HOURS;
        });
        const matchStatuses = filteredMatches.map(m => {
          const startMs = new Date(m.startTime).getTime();
          return {
            id: m.id,
            teams: `${m.team1Short} vs ${m.team2Short}`,
            status: m.status,
            scoreString: (m as any).scoreString || "",
            lastSyncAt: (m as any).lastSyncAt,
            startTime: m.startTime,
            hasExternalId: !!m.externalId,
            isLocked: now >= startMs,
            minutesUntilStart: Math.round((startMs - now) / 60000),
          };
        });
        return res.json({ matches: matchStatuses, serverTime: new Date().toISOString() });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // ---- ADMIN: API CALL TRACKING ----
  app.get(
    "/api/admin/api-calls",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { getInMemoryApiCallCount } = await import("./cricket-api");
        const dbCount = await storage.getApiCallCount();
        const inMemory = getInMemoryApiCallCount();
        return res.json({
          today: dbCount.count || inMemory,
          date: dbCount.date,
          lastCalledAt: dbCount.lastCalledAt,
          dailyLimit: 2000,
          tier1Key: !!process.env.CRICKET_API_KEY,
          tier2Key: !!process.env.CRICAPI_KEY_TIER2,
        });
      } catch (err: any) {
        console.error("API call tracking error:", err);
        return res.status(500).json({ message: "Failed to get API call data" });
      }
    }
  );

  // ---- REWARDS: AUTO-DISTRIBUTE ON MATCH COMPLETION ----
  async function distributeMatchReward(matchId: string) {
    try {
      const match = await storage.getMatch(matchId);
      const matchLabel = match ? `${(match as any).team1Short} vs ${(match as any).team2Short}` : matchId;
      console.log(`[Rewards] Starting distribution for ${matchLabel}...`);

      const existingMatchReward = await storage.getRewardForMatch(matchId);
      if (existingMatchReward) {
        console.log(`[Rewards] ${matchLabel}: Reward already distributed for this match (to userId ${existingMatchReward.claimedByUserId}), skipping — idempotent`);
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
        console.log(`[Rewards] ⚠ Vault empty, no reward distributed for match ${matchLabel} — add coupons via Admin Panel`);
        return;
      }

      await storage.claimReward(reward.id, winner.userId, matchId);
      console.log(`[Rewards] ✓ ${matchLabel}: "${reward.title}" (${reward.brand}) → userId ${winner.userId}`);
    } catch (err) {
      console.error(`[Rewards] ✗ Distribution FAILED for match ${matchId}:`, err);
    }
  }

  (globalThis as any).__distributeMatchReward = distributeMatchReward;

  // ---- ONE-TIME: Retroactive coupon distribution (runs on startup, idempotent) ----
  (async () => {
    try {
      const assignments = [
        {
          matchId: "3cc4d1b3-2959-43c5-9d7c-09f2ed4d0997",
          label: "ENG vs SL",
          rewardId: "5bb13e61-6a04-4229-8ed5-5425f6b8e451",
          rewardBrand: "Zomato",
        },
        {
          matchId: "56467706-bbab-44ff-a4e9-6b369b2470c9",
          label: "IND vs RSA",
          rewardId: "1e89dd29-3c92-48dd-82a6-0df4167ef083",
          rewardBrand: "Domino's",
        },
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
        console.log(`[Retroactive] ✓ ${a.label}: ${a.rewardBrand} → userId ${winner.userId} (${winner.totalPoints} pts)`);
      }
    } catch (err) {
      console.error("[Retroactive] One-time distribution failed:", err);
    }
  })();

  // ---- ADMIN: REWARDS VAULT ----
  app.get(
    "/api/admin/rewards",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const allRewards = await storage.getAllRewards();
        const available = allRewards.filter(r => !r.isClaimed);
        const claimed = allRewards.filter(r => r.isClaimed);

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
      } catch (err: any) {
        console.error("Admin rewards error:", err);
        return res.status(500).json({ message: "Failed to fetch rewards" });
      }
    }
  );

  app.post(
    "/api/admin/rewards",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { brand, title, code, terms } = req.body;
        if (!brand || !title || !code) {
          return res.status(400).json({ message: "Brand, title, and code are required" });
        }
        const reward = await storage.createReward({ brand, title, code, terms: terms || "" });
        return res.json({ reward });
      } catch (err: any) {
        console.error("Create reward error:", err);
        return res.status(500).json({ message: "Failed to create reward" });
      }
    }
  );

  app.delete(
    "/api/admin/rewards/:id",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        await storage.deleteReward(req.params.id);
        return res.json({ message: "Reward deleted" });
      } catch (err: any) {
        console.error("Delete reward error:", err);
        return res.status(500).json({ message: "Failed to delete reward" });
      }
    }
  );

  // ---- USER: GET REWARD FOR A MATCH ----
  app.get(
    "/api/rewards/match/:matchId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.session.userId!;
        const reward = await storage.getRewardForUserMatch(userId, req.params.matchId);
        return res.json({ reward: reward || null });
      } catch (err: any) {
        console.error("Get match reward error:", err);
        return res.status(500).json({ message: "Failed to fetch reward" });
      }
    }
  );

  // ---- USER: GET ALL MY REWARDS ----
  app.get(
    "/api/rewards/my",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.session.userId!;
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
      } catch (err: any) {
        console.error("My rewards error:", err);
        return res.status(500).json({ message: "Failed to fetch your rewards" });
      }
    }
  );

  // ---- ADMIN: CENTRALIZED TOURNAMENT POT PROCESSING ----
  app.post(
    "/api/tournament/process",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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
        const maxPoints = Math.max(...allTeams.map(t => t.totalPoints));
        const winningTeams = allTeams.filter(t => t.totalPoints === maxPoints);
        const losingTeams = allTeams.filter(t => t.totalPoints < maxPoints);
        const totalPot = losingTeams.length * entryStake;
        const winnerPointsEach = losingTeams.length > 0
          ? Math.round(totalPot / winningTeams.length)
          : 0;
        const userMap = new Map<string, string>();
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
            pointsChange: -entryStake,
          });
        }
        for (const t of winningTeams) {
          await storage.createLedgerEntry({
            userId: t.userId,
            userName: userMap.get(t.userId) || "Unknown",
            matchId,
            tournamentName,
            pointsChange: winnerPointsEach,
          });
        }
        await storage.updateMatch(matchId, {
          tournamentName,
          entryStake,
          potProcessed: true,
        });
        console.log(`[Tournament Pot] Processed for ${match.team1Short} vs ${match.team2Short}: ${winningTeams.length} winner(s) (+${winnerPointsEach}), ${losingTeams.length} loser(s) (-${entryStake}), totalPot=${totalPot}`);
        return res.json({
          message: "Pot processed successfully",
          winners: winningTeams.length,
          losers: losingTeams.length,
          winnerPoints: winnerPointsEach,
          loserPoints: -entryStake,
          totalPot,
          totalTeams: allTeams.length,
        });
      } catch (err: any) {
        console.error("Process pot error:", err);
        return res.status(500).json({ message: "Failed to process tournament pot" });
      }
    }
  );

  // ---- ADMIN: GET COMPLETED UNPROCESSED MATCHES ----
  app.get(
    "/api/admin/matches/unprocessed",
    isAuthenticated,
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const allMatches = await storage.getAllMatches();
        const completed = allMatches.filter(m => m.status === "completed" && !m.potProcessed);
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
            });
          }
        }
        return res.json({ matches: withParticipation });
      } catch (err: any) {
        console.error("Unprocessed matches error:", err);
        return res.status(500).json({ message: "Failed to fetch unprocessed matches" });
      }
    }
  );

  // ---- PUBLIC: TOURNAMENT NAMES ----
  app.get(
    "/api/tournament/names",
    isAuthenticated,
    async (_req: Request, res: Response) => {
      try {
        const names = await storage.getDistinctTournamentNames();
        return res.json({ names });
      } catch (err: any) {
        console.error("Tournament names error:", err);
        return res.status(500).json({ message: "Failed to fetch tournament names" });
      }
    }
  );

  // ---- PUBLIC: TOURNAMENT STANDINGS ----
  app.get(
    "/api/tournament/standings",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const name = req.query.name as string;
        if (!name) return res.status(400).json({ message: "Tournament name required" });
        const standings = await storage.getTournamentStandings(name);
        return res.json({ standings });
      } catch (err: any) {
        console.error("Tournament standings error:", err);
        return res.status(500).json({ message: "Failed to fetch tournament standings" });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}
