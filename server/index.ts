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
      const cricbuzzVerified = new Map<string, number>();
      const FIVE_MINUTES = 5 * 60 * 1000;
      const TEN_MINUTES = 10 * 60 * 1000;
      const TWENTY_MINUTES = 20 * 60 * 1000;

      async function refreshPlayingXI() {
        try {
          const allMatches = await storage.getAllMatches();
          const now = Date.now();

          for (const match of allMatches) {
            if (!match.externalId) continue;
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
                log(`Playing XI upserted: ${squad.length} players for ${match.team1} vs ${match.team2}`);
              }

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
                  log(`Playing XI from api-cricket.com: ${apiCricketResult.matched} players for ${match.team1} vs ${match.team2}`);
                } else {
                  if (apiCricketResult.matched > 0) {
                    log(`Playing XI partial from api-cricket.com: ${apiCricketResult.matched} players for ${match.team1} vs ${match.team2}, trying CricAPI...`);
                  }

                  if (match.externalId) {
                    let playingXIIds = await fetchPlayingXIFromScorecard(match.externalId);
                    if (playingXIIds.length > 0) {
                      await storage.markPlayingXI(match.id, playingXIIds);
                      log(`Playing XI from CricAPI scorecard: ${playingXIIds.length} players for ${match.team1} vs ${match.team2}`);
                    } else {
                      playingXIIds = await fetchPlayingXIFromMatchInfo(match.externalId);
                      if (playingXIIds.length > 0) {
                        await storage.markPlayingXI(match.id, playingXIIds);
                        log(`Playing XI from CricAPI match_info: ${playingXIIds.length} players for ${match.team1} vs ${match.team2}`);
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

      async function cricbuzzAutoVerifyPlayingXI() {
        try {
          const allMatches = await storage.getAllMatches();
          const now = Date.now();

          for (const match of allMatches) {
            if (match.status === "completed") continue;

            const startMs = new Date(match.startTime).getTime();
            const timeUntilStart = startMs - now;

            const isNearStart = timeUntilStart <= TEN_MINUTES && timeUntilStart > -TWO_HOURS;
            const isLive = match.status === "live" || match.status === "delayed";

            if (!isNearStart && !isLive) continue;

            const lastVerify = cricbuzzVerified.get(match.id) || 0;
            if (now - lastVerify < TEN_MINUTES) continue;

            log(`Cricbuzz auto-verify: ${match.team1Short} vs ${match.team2Short} (starts in ${Math.round(timeUntilStart / 60000)}m)`);

            try {
              const { autoVerifyPlayingXI } = await import("./cricbuzz-api");
              const result = await autoVerifyPlayingXI(
                match.id,
                match.team1Short,
                match.team2Short,
                match.startTime?.toISOString()
              );

              if (result && result.matched > 0) {
                log(`Cricbuzz Playing XI verified: ${result.matched} players matched for ${match.team1Short} vs ${match.team2Short}`);
              }

              cricbuzzVerified.set(match.id, now);
            } catch (err) {
              console.error(`Cricbuzz auto-verify failed for ${match.id}:`, err);
            }
          }
        } catch (err) {
          console.error("Cricbuzz auto-verify scheduler error:", err);
        }
      }

      const TWO_MINUTES = 2 * 60 * 1000;
      const scorecardLastSync = new Map<string, number>();

      async function autoSyncScorecard() {
        try {
          const allMatches = await storage.getAllMatches();
          const now = Date.now();

          for (const match of allMatches) {
            if (!match.externalId) continue;

            const isLive = match.status === "live" || match.status === "delayed";
            if (!isLive) continue;

            const lastSync = scorecardLastSync.get(match.id) || 0;
            if (now - lastSync < TWO_MINUTES) continue;

            try {
              const { fetchMatchScorecard } = await import("./cricket-api");
              let pointsMap = await fetchMatchScorecard(match.externalId);

              if (pointsMap.size === 0 && match.team1Short && match.team2Short) {
                const { calculatePointsFromApiCricket } = await import("./api-cricket");
                const matchDateStr = match.startTime ? new Date(match.startTime).toISOString().split("T")[0] : undefined;
                pointsMap = await calculatePointsFromApiCricket(match.id, match.team1Short, match.team2Short, matchDateStr);
                if (pointsMap.size > 0) {
                  log(`Scorecard fallback: api-cricket.com returned points for ${pointsMap.size} players (${match.team1Short} vs ${match.team2Short})`);
                }
              }

              if (pointsMap.size > 0) {
                const matchPlayers = await storage.getPlayersForMatch(match.id);
                let updated = 0;
                for (const player of matchPlayers) {
                  if (player.externalId && pointsMap.has(player.externalId)) {
                    const pts = pointsMap.get(player.externalId)!;
                    if (pts !== player.points) {
                      await storage.updatePlayer(player.id, { points: pts });
                      updated++;
                    }
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
                  log(`Scorecard auto-sync: updated ${updated} player scores, recalculated team points for ${match.team1Short} vs ${match.team2Short}`);
                }
              }

              scorecardLastSync.set(match.id, now);
            } catch (err) {
              console.error(`Scorecard auto-sync failed for ${match.id}:`, err);
            }
          }
        } catch (err) {
          console.error("Scorecard auto-sync scheduler error:", err);
        }
      }

      setInterval(refreshPlayingXI, FIVE_MINUTES);
      setInterval(cricbuzzAutoVerifyPlayingXI, FIVE_MINUTES);
      setInterval(autoSyncScorecard, TWO_MINUTES);
      log("Playing XI auto-refresh scheduler started (every 5min, 20min before match)");
      log("Cricbuzz auto-verify scheduler started (every 5min, 10min before match)");
      log("Scorecard auto-sync scheduler started (every 2min for live matches)");
    },
  );
})();
