import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { syncMatchesFromApi, fetchMatchSquad, fetchSeriesSquad, fetchPlayingXIFromMatchInfo, fetchPlayingXIFromScorecard } from "./cricket-api";
import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";

const app = express();
app.set("trust proxy", 1);
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
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

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
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
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  const webDistCandidates = [
    path.resolve(process.cwd(), "web-app"),
    path.resolve(process.cwd(), "dist", "web"),
    path.resolve(process.cwd(), "static-build", "web"),
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
    log(`Web build found at ${webDistPath} — serving web app to browsers`);
  } else {
    log("No web build found, will serve landing page to browsers");
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
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
    app.use(express.static(webDistPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
  }
  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  app.use((req: Request, res: Response, next: NextFunction) => {
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
        appName,
      });
    }
    next();
  });

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

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

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);

      seedReferenceCodes().catch((err) => {
        console.error("Reference code seeding failed:", err);
      });

      syncMatchesFromApi().catch((err) => {
        console.error("Initial match sync failed:", err);
      });

      const TWO_HOURS = 2 * 60 * 60 * 1000;
      setInterval(() => {
        log("Periodic match sync (every 2 hours)...");
        syncMatchesFromApi().catch((err) => {
          console.error("Periodic match sync failed:", err);
        });
      }, TWO_HOURS);

      const recentlyRefreshed = new Map<string, number>();

      const FIVE_MINUTES = 5 * 60 * 1000;
      const TWENTY_MINUTES = 20 * 60 * 1000;

      async function refreshPlayingXI() {
        try {
          const allMatches = await storage.getAllMatches();
          const now = Date.now();

          for (const match of allMatches) {
            if (match.status === "completed") continue;

            const startMs = new Date(match.startTime).getTime();
            const timeUntilStart = startMs - now;

            const isInWindow = timeUntilStart <= TWENTY_MINUTES && timeUntilStart > -TWO_HOURS;
            const isLive = match.status === "live" || match.status === "delayed";

            if (!isInWindow && !isLive) continue;

            const lastRefresh = recentlyRefreshed.get(match.id) || 0;
            if (now - lastRefresh < FIVE_MINUTES) continue;

            log(`Playing XI refresh: ${match.team1} vs ${match.team2} (starts in ${Math.round(timeUntilStart / 60000)}m, status: ${match.status})`);

            try {
              if (match.externalId) {
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
                  await storage.upsertPlayersForMatch(
                    match.id,
                    squad.map((p) => ({
                      matchId: match.id,
                      externalId: p.externalId,
                      name: p.name,
                      team: p.team,
                      teamShort: p.teamShort,
                      role: p.role,
                      credits: p.credits,
                    }))
                  );
                  log(`Tier 1 (CricAPI): upserted ${squad.length} players for ${match.team1} vs ${match.team2}`);
                }
              }

              if ((match as any).playingXIManual) {
                log(`Playing XI skipped (admin manual): ${match.team1} vs ${match.team2}`);
              } else {
                const playingXICount = await storage.getPlayingXICount(match.id);
                if (playingXICount === 0) {
                  const { markPlayingXIFromApiCricket } = await import("./api-cricket");
                  const matchDate = match.startTime ? new Date(match.startTime).toISOString().split("T")[0] : undefined;
                  const apiCricketResult = await markPlayingXIFromApiCricket(
                    match.id,
                    match.team1Short,
                    match.team2Short,
                    matchDate
                  );

                  if (apiCricketResult.matched >= 11) {
                    log(`Tier 2 (api-cricket.com): Playing XI ${apiCricketResult.matched} players for ${match.team1} vs ${match.team2}`);
                  } else if (apiCricketResult.matched > 0) {
                    log(`Tier 2 (api-cricket.com): partial Playing XI ${apiCricketResult.matched} players for ${match.team1} vs ${match.team2}`);
                  }

                  if (apiCricketResult.matched < 11 && match.externalId) {
                    let playingXIIds = await fetchPlayingXIFromScorecard(match.externalId);
                    if (playingXIIds.length > 0) {
                      await storage.markPlayingXI(match.id, playingXIIds);
                      log(`Tier 1 (CricAPI scorecard): Playing XI ${playingXIIds.length} players for ${match.team1} vs ${match.team2}`);
                    } else {
                      playingXIIds = await fetchPlayingXIFromMatchInfo(match.externalId);
                      if (playingXIIds.length > 0) {
                        await storage.markPlayingXI(match.id, playingXIIds);
                        log(`Tier 1 (CricAPI match_info): Playing XI ${playingXIIds.length} players for ${match.team1} vs ${match.team2}`);
                      }
                    }
                  }
                }
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

      const HEARTBEAT_INTERVAL = 60 * 1000;

      function fuzzyNameMatch(name1: string, name2: string): boolean {
        if (name1 === name2) return true;
        if (name1.includes(name2) || name2.includes(name1)) return true;
        const p1 = name1.split(" ");
        const p2 = name2.split(" ");
        if (p1.length > 0 && p2.length > 0) {
          const last1 = p1[p1.length - 1], last2 = p2[p2.length - 1];
          if (last1 === last2 && last1.length > 2 && p1[0][0] === p2[0][0]) return true;
          if (last1.length >= 4 && last2.length >= 4) {
            let dist = 0;
            const a = last1, b = last2;
            const m = a.length, n = b.length;
            const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
            for (let i = 0; i <= m; i++) dp[i][0] = i;
            for (let j = 0; j <= n; j++) dp[0][j] = j;
            for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
            dist = dp[m][n];
            if (dist <= 2 && p1[0][0] === p2[0][0]) return true;
          }
          if (p1[0].substring(0,3) === p2[0].substring(0,3) && p1[0].length >= 3) {
            if (last1.substring(0,3) === last2.substring(0,3)) return true;
          }
        }
        if (name1.length >= 5 && name2.length >= 5) {
          const a = name1, b = name2, m = a.length, n = b.length;
          const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
          for (let i = 0; i <= m; i++) dp[i][0] = i;
          for (let j = 0; j <= n; j++) dp[0][j] = j;
          for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
          if (dp[m][n] <= 2 && Math.max(m, n) >= 8) return true;
        }
        return false;
      }

      async function matchHeartbeat(forcedMatchId?: string) {
        try {
          const allMatches = await storage.getAllMatches();
          const now = Date.now();

          for (const match of allMatches) {
            if (forcedMatchId && match.id !== forcedMatchId) continue;

            const startMs = match.startTime ? new Date(match.startTime).getTime() : 0;
            const isStarted = startMs > 0 && now > startMs && match.status !== "completed";
            const isLive = match.status === "live" || match.status === "delayed";

            if (isStarted && !isLive) {
              log(`[Heartbeat] LOCKOUT: ${match.team1Short} vs ${match.team2Short} -> status=live (was ${match.status}, started ${Math.round((now - startMs) / 60000)}m ago)`);
              await storage.updateMatch(match.id, { status: "live" });
            }

            if (!isLive && !isStarted && !forcedMatchId) continue;

            try {
              let pointsMap = new Map<string, number>();
              let namePointsMap = new Map<string, number>();
              let scoreString = "";
              let source = "";
              let matchEnded = false;

              if (match.externalId) {
                try {
                  const { fetchLiveScorecard } = await import("./cricket-api");
                  const liveData = await fetchLiveScorecard(match.externalId);
                  if (liveData && liveData.score && liveData.score.length > 0) {
                    source = "CricAPI";
                    scoreString = liveData.score.map(s => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join(" | ");
                    const lcStatus = (liveData.status || "").toLowerCase();
                    matchEnded = lcStatus.includes("won") || lcStatus.includes("draw") ||
                                 lcStatus.includes("tied") || lcStatus.includes("finished") ||
                                 lcStatus.includes("ended") || lcStatus.includes("result") ||
                                 lcStatus.includes("aban") || lcStatus.includes("no result") ||
                                 lcStatus.includes("d/l") || lcStatus.includes("dls");
                    if (liveData.status && !matchEnded) {
                      scoreString += ` — ${liveData.status}`;
                    } else if (liveData.status && matchEnded) {
                      scoreString += ` — ${liveData.status}`;
                    }
                  }
                } catch (e) {}

                if (!source) {
                  const { fetchMatchScorecard } = await import("./cricket-api");
                  const result = await fetchMatchScorecard(match.externalId);
                  pointsMap = result.pointsMap;
                  namePointsMap = result.namePointsMap;
                  if (pointsMap.size > 0) source = "CricAPI";
                }
              }

              if (!source && match.team1Short && match.team2Short) {
                const { fetchApiCricketScorecard, calculatePointsFromApiCricket } = await import("./api-cricket");
                const matchDateStr = match.startTime ? new Date(match.startTime).toISOString().split("T")[0] : undefined;

                const scData = await fetchApiCricketScorecard(match.team1Short, match.team2Short, matchDateStr);
                if (scData && scData.score && scData.score.length > 0) {
                  source = "api-cricket.com";
                  scoreString = scData.score.map((s: any) => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join(" | ");
                  const lcStatus2 = (scData.status || "").toLowerCase();
                  matchEnded = lcStatus2.includes("won") || lcStatus2.includes("draw") ||
                               lcStatus2.includes("tied") || lcStatus2.includes("finished") ||
                               lcStatus2.includes("ended") || lcStatus2.includes("result") ||
                               lcStatus2.includes("aban") || lcStatus2.includes("no result") ||
                               lcStatus2.includes("d/l") || lcStatus2.includes("dls");
                  if (scData.status && !matchEnded) {
                    scoreString += ` — ${scData.status}`;
                  } else if (scData.status && matchEnded) {
                    scoreString += ` — ${scData.status}`;
                  }
                }

                if (pointsMap.size === 0) {
                  pointsMap = await calculatePointsFromApiCricket(match.id, match.team1Short, match.team2Short, matchDateStr);
                }
              }

              if (scoreString && scoreString !== (match as any).scoreString) {
                await storage.updateMatch(match.id, { scoreString, lastSyncAt: new Date() } as any);
              }

              if (matchEnded && match.status !== "completed") {
                log(`[Heartbeat] COMPLETED: ${match.team1Short} vs ${match.team2Short}`);
                await storage.updateMatch(match.id, { status: "completed" });
              }

              if (pointsMap.size > 0) {
                const matchPlayers = await storage.getPlayersForMatch(match.id);
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
                        if (fuzzyNameMatch(apiName, normName)) {
                          pts = apiPts;
                          log(`[Heartbeat] Fuzzy matched "${player.name}" -> "${apiName}" (${apiPts} pts)`);
                          break;
                        }
                      }
                    }
                  }
                  if (pts !== undefined) {
                    if (player.isPlayingXI) pts += 4;
                    if (pts !== player.points) {
                      await storage.updatePlayer(player.id, { points: pts });
                      updated++;
                    }
                  } else if (player.isPlayingXI) {
                    if (player.points !== 4) {
                      await storage.updatePlayer(player.id, { points: 4 });
                      updated++;
                    }
                  } else if (player.points !== 0) {
                    await storage.updatePlayer(player.id, { points: 0 });
                    updated++;
                  }
                }

                if (updated > 0) {
                  const updatedPlayers = await storage.getPlayersForMatch(match.id);
                  const playerById = new Map(updatedPlayers.map(p => [p.id, p]));
                  const playerByExtId = new Map(updatedPlayers.filter(p => p.externalId).map(p => [p.externalId!, p]));
                  const allTeams = await storage.getAllTeamsForMatch(match.id);
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
                    if (totalPoints !== (team.totalPoints || 0)) {
                      await storage.updateUserTeamPoints(team.id, totalPoints);
                    }
                  }
                  log(`[Heartbeat] ${source}: updated ${updated} player scores, recalculated teams for ${match.team1Short} vs ${match.team2Short}`);
                }
              }

              if (source) {
                log(`[Heartbeat] ${match.team1Short} vs ${match.team2Short} synced via ${source}${scoreString ? ` — ${scoreString.substring(0, 60)}` : ''}`);
              }
            } catch (err) {
              console.error(`[Heartbeat] sync failed for ${match.team1Short} vs ${match.team2Short}:`, err);
            }
          }
        } catch (err) {
          console.error("[Heartbeat] scheduler error:", err);
        }
      }

      (globalThis as any).__matchHeartbeat = matchHeartbeat;

      setInterval(refreshPlayingXI, FIVE_MINUTES);
      setInterval(matchHeartbeat, HEARTBEAT_INTERVAL);
      log("Playing XI auto-refresh scheduler started (every 5min, 20min before match)");
      log("Match Heartbeat started (every 60s — score sync, points, lockout, delay detection)");
    },
  );
})();
