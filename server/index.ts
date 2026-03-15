import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { syncMatchesFromApi } from "./cricket-api";
import { storage } from "./storage";
import { connectWithRetry, markServerReady } from "./db";
import * as fs from "fs";
import * as path from "path";

const app = express();
console.log(
  "DEPLOY_CHECK",
  process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "no-sha",
);
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
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
    const isRailway = !!railwayDomain && origin === `https://${railwayDomain}`;

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost || isRailway)) {
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

  // 0) Expo manifest routing for native apps (ios/android)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) return next();

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      if (req.path === "/" || req.path === "/manifest") {
        return serveExpoManifest(platform, res);
      }
    }

    return next();
  });

  // 1) Static web build routes
  if (hasWebBuild) {
    // Serve Expo web runtime files
    const expoPath = path.join(webDistPath, "_expo");
    if (fs.existsSync(expoPath)) {
      app.use(
        "/_expo",
        express.static(expoPath, {
          setHeaders: (res, filePath) => {
            // hashed bundles — cache forever
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            if (/\.(ttf|otf|woff|woff2)$/i.test(filePath)) {
              res.setHeader("Access-Control-Allow-Origin", "*");
            }
          },
        }),
      );
    }

    // Serve Expo web assets (fonts/images/etc)
    const assetsPath = path.join(webDistPath, "assets");
    if (fs.existsSync(assetsPath)) {
      app.use(
        "/assets",
        express.static(assetsPath, {
          setHeaders: (res, filePath) => {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            if (/\.(ttf|otf|woff|woff2)$/i.test(filePath)) {
              res.setHeader("Access-Control-Allow-Origin", "*");
            }
          },
        }),
      );
    }

    // favicon for the web build
    const faviconPath = path.join(webDistPath, "favicon.ico");
    if (fs.existsSync(faviconPath)) {
      app.get("/favicon.ico", (_req, res) => res.sendFile(faviconPath));
    }

    // Serve the rest of the web build (JS chunks, etc)
    app.use(
      express.static(webDistPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
          } else {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      }),
    );
  }

  // 2) Other static folders (keep if you use them)
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  // 3) IMPORTANT: Real 404 for missing files (so SPA doesn’t hijack fonts)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) return next();

    // If it looks like a file request and it wasn’t served above, return real 404
    if (path.extname(req.path)) {
      return res.status(404).type("text/plain").send("Not Found");
    }

    // SPA / landing fallback only for real browser navigation
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
        appName,
      });
    }

    return next();
  });

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

const DB_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ECONNRESET",
  "57P01",  // admin_shutdown
  "57014",  // query_canceled (statement_timeout fired)
  "08006",  // connection_failure
  "08001",  // sqlclient_unable_to_establish_sqlconnection
]);

function setupRequestTimeout(app: express.Application) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api")) return next();

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`[TIMEOUT] ${req.method} ${req.path} exceeded 6000ms`);
        res.status(504).json({ error: "Request timed out. Please try again." });
      }
    }, 6000);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));
    next();
  });
}

function isDbError(err: unknown): boolean {
  const e = err as any;
  if (!e) return false;
  if (e.code && DB_ERROR_CODES.has(e.code)) return true;
  const msg: string = e.message || "";
  return (
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("connection") ||
    msg.includes("database")
  );
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
      code?: string;
    };

    if (isDbError(err)) {
      console.error("[DB] Runtime DB error on request:", (err as any).message);
      if (res.headersSent) return next(err);
      return res
        .status(503)
        .json({ error: "Database temporarily unavailable. Please try again." });
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

  await connectWithRetry(10, 3000);

  const port = Number(process.env.PORT) || 3000;

  server.listen(port, "0.0.0.0", () => {
    markServerReady();
    log(`express server serving on port ${port}`);

    const ADMIN_PHONES = ["9840872462", "9884334973", "7406020777"];
    (async () => {
      for (const phone of ADMIN_PHONES) {
        try {
          const u = await storage.getUserByPhone(phone);
          if (u && !u.isAdmin) {
            await storage.setUserAdmin(u.id, true);
            log(`Auto-promoted ${u.username} (${phone}) to admin`);
          }
        } catch (e) {}
      }
    })();

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

    const HEARTBEAT_INTERVAL = 60 * 1000;
    let heartbeatSyncing = false;
    let heartbeatLockTime = 0;

    // Squad fetch timing: track last attempt per matchId so we respect intervals
    const lastSquadFetchAttempt = new Map<string, number>();
    const SQUAD_POLL_FAR   = 20 * 60 * 1000; // every 20 min when 48h > time_to_start > 60 min
    const SQUAD_POLL_CLOSE =  5 * 60 * 1000; // every 5 min in final 60 min before start
    const SQUAD_MIN_PLAYERS = 22;             // stop fetching once we have a full squad

    function fuzzyNameMatch(name1: string, name2: string): boolean {
      if (name1 === name2) return true;
      if (name1.includes(name2) || name2.includes(name1)) return true;
      const p1 = name1.split(" ");
      const p2 = name2.split(" ");
      if (p1.length > 0 && p2.length > 0) {
        const last1 = p1[p1.length - 1],
          last2 = p2[p2.length - 1];
        if (last1 === last2 && last1.length > 2 && p1[0][0] === p2[0][0])
          return true;
        if (last1.length >= 4 && last2.length >= 4) {
          const a = last1,
            b = last2,
            m = a.length,
            n = b.length;
          const dp: number[][] = Array.from({ length: m + 1 }, () =>
            Array(n + 1).fill(0),
          );
          for (let i = 0; i <= m; i++) dp[i][0] = i;
          for (let j = 0; j <= n; j++) dp[0][j] = j;
          for (let i = 1; i <= m; i++)
            for (let j = 1; j <= n; j++)
              dp[i][j] =
                a[i - 1] === b[j - 1]
                  ? dp[i - 1][j - 1]
                  : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
          if (dp[m][n] <= 2 && p1[0][0] === p2[0][0]) return true;
        }
        if (
          p1[0].substring(0, 3) === p2[0].substring(0, 3) &&
          p1[0].length >= 3
        ) {
          if (last1.substring(0, 3) === last2.substring(0, 3)) return true;
        }
      }
      if (name1.length >= 5 && name2.length >= 5) {
        const a = name1,
          b = name2,
          m = a.length,
          n = b.length;
        const dp: number[][] = Array.from({ length: m + 1 }, () =>
          Array(n + 1).fill(0),
        );
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++)
          for (let j = 1; j <= n; j++)
            dp[i][j] =
              a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        if (dp[m][n] <= 2 && Math.max(m, n) >= 8) return true;
      }
      return false;
    }

    function resolvePlayerPoints(
      player: {
        externalId: string | null;
        name: string;
        isPlayingXI: boolean | null;
        apiName?: string | null;
      },
      pointsMap: Map<string, number>,
      namePointsMap: Map<string, number>,
    ): { fantasyPts: number | undefined; matchMethod: string } {
      if (player.externalId && pointsMap.has(player.externalId)) {
        return {
          fantasyPts: pointsMap.get(player.externalId)!,
          matchMethod: "externalId",
        };
      }

      if (namePointsMap.size > 0) {
        if (player.apiName) {
          const normApiName = player.apiName
            .toLowerCase()
            .replace(/[^a-z\s]/g, "")
            .replace(/\s+/g, " ")
            .trim();
          if (namePointsMap.has(normApiName)) {
            return {
              fantasyPts: namePointsMap.get(normApiName)!,
              matchMethod: `apiName(${player.apiName})`,
            };
          }
        }

        if (player.name) {
          const normName = player.name
            .toLowerCase()
            .replace(/[^a-z\s]/g, "")
            .replace(/\s+/g, " ")
            .trim();

          if (namePointsMap.has(normName)) {
            return {
              fantasyPts: namePointsMap.get(normName)!,
              matchMethod: "exactName",
            };
          }

          for (const [apiName, apiPts] of namePointsMap) {
            if (fuzzyNameMatch(apiName, normName)) {
              return { fantasyPts: apiPts, matchMethod: `fuzzy(${apiName})` };
            }
          }
        }
      }

      return { fantasyPts: undefined, matchMethod: "none" };
    }

    async function updateLiveScore(match: any): Promise<{
      pointsMap: Map<string, number>;
      namePointsMap: Map<string, number>;
      scoreString: string;
      matchEnded: boolean;
      totalOvers: number;
      source: string;
    }> {
      const empty = {
        pointsMap: new Map<string, number>(),
        namePointsMap: new Map<string, number>(),
        scoreString: "",
        matchEnded: false,
        totalOvers: 0,
        source: "",
      };

      if (!match.externalId) return empty;

      try {
        const { fetchMatchScorecardWithScore, fetchMatchInfo } = await import(
          "./cricket-api"
        );
        const result = await fetchMatchScorecardWithScore(match.externalId);
        const source =
          result.pointsMap.size > 0 || result.scoreString ? "CricAPI" : "";
        log(
          `[Heartbeat:Score] ${match.team1Short} vs ${match.team2Short}: ${result.pointsMap.size} players in scorecard, score="${result.scoreString.substring(0, 80)}", ended=${result.matchEnded}, overs=${result.totalOvers}`,
        );

        try {
          const matchInfo = await fetchMatchInfo(match.externalId);
          if (
            matchInfo &&
            matchInfo.score &&
            Array.isArray(matchInfo.score) &&
            matchInfo.score.length > 0
          ) {
            const infoScoreArr = matchInfo.score;
            const infoScoreString = infoScoreArr
              .map(
                (s: any) =>
                  `${s?.inning ?? "?"}: ${s?.r ?? 0}/${s?.w ?? 0} (${s?.o ?? 0} ov)`,
              )
              .join(" | ");
            const infoTotalOvers = infoScoreArr.reduce(
              (sum: number, s: any) => sum + (s?.o || 0),
              0,
            );
            const infoStatus = (
              matchInfo.name ||
              matchInfo.status ||
              ""
            ).toLowerCase();
            const infoEnded =
              infoStatus.includes("won") ||
              infoStatus.includes("draw") ||
              infoStatus.includes("tied") ||
              infoStatus.includes("finished") ||
              infoStatus.includes("beat") ||
              infoStatus.includes("defeat") ||
              infoStatus.includes("result") ||
              infoStatus.includes("aban") ||
              (matchInfo as any).matchEnded === true;

            if (infoTotalOvers > result.totalOvers) {
              log(
                `[Heartbeat:LiveScore] ${match.team1Short} vs ${match.team2Short}: match_info has fresher score ${infoTotalOvers} ov vs scorecard ${result.totalOvers} ov`,
              );
              const statusText = matchInfo.name || matchInfo.status || "";
              result.scoreString = statusText
                ? `${infoScoreString} — ${statusText}`
                : infoScoreString;
              result.totalOvers = infoTotalOvers;
            }
            if (infoEnded && !result.matchEnded) {
              log(
                `[Heartbeat:LiveScore] ${match.team1Short} vs ${match.team2Short}: match_info says ended`,
              );
              result.matchEnded = true;
            }
          }
        } catch (infoErr) {
          log(
            `[Heartbeat:LiveScore] match_info fallback failed for ${match.team1Short} vs ${match.team2Short}: ${infoErr}`,
          );
        }

        return { ...result, source };
      } catch (err) {
        console.error(
          `[Heartbeat:Score] FAILED for ${match.team1Short} vs ${match.team2Short}:`,
          err,
        );
        return empty;
      }
    }

    async function updateFantasyPoints(
      matchId: string,
      matchLabel: string,
      pointsMap: Map<string, number>,
      namePointsMap: Map<string, number>,
    ): Promise<number> {
      const matchPlayers = await storage.getPlayersForMatch(matchId);
      const playerUpdates: Array<{
        id: string;
        name: string;
        oldPoints: number;
        newPoints: number;
        method: string;
      }> = [];
      let mapped = 0;
      let unmapped = 0;
      let skippedProtected = 0;

      for (const player of matchPlayers) {
        try {
          let resolveResult: {
            fantasyPts: number | undefined;
            matchMethod: string;
          };
          try {
            resolveResult = resolvePlayerPoints(
              player,
              pointsMap,
              namePointsMap,
            );
          } catch (resolveErr) {
            console.error(
              `[Heartbeat:Points] resolvePlayerPoints THREW for "${player.name}" (${player.id}):`,
              resolveErr,
            );
            continue;
          }

          const { fantasyPts, matchMethod } = resolveResult;
          const existingPts = player.points || 0;
          const appearedOnScorecard = fantasyPts !== undefined && fantasyPts !== null;
          const xiBase = (player.isPlayingXI || appearedOnScorecard) ? 4 : 0;

          let finalPts: number;

          if (appearedOnScorecard) {
            finalPts = fantasyPts + xiBase;
            mapped++;
            if (finalPts < existingPts) {
              log(
                `[Heartbeat:Points] PROTECTED: "${player.name}" scorecard would DROP ${existingPts} -> ${finalPts} — keeping existing`,
              );
              skippedProtected++;
              continue;
            }
            if (
              matchMethod.startsWith("fuzzy") ||
              matchMethod.startsWith("apiName")
            ) {
              log(
                `[Heartbeat:Points] Match: "${player.name}" -> ${matchMethod} = ${fantasyPts} scorecard + ${xiBase} XI base = ${finalPts}`,
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
              method: matchMethod,
            });
          }
        } catch (err) {
          console.error(
            `[Heartbeat:Points] OUTER CATCH for player "${player.name}" (${player.id}):`,
            err,
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
              dbErr,
            );
          }
        }
        log(
          `[Heartbeat:Points] ${matchLabel}: ${playerUpdates.length} players updated (${mapped} mapped, ${unmapped} unmapped/XI-only, ${skippedProtected} protected from crash)`,
        );
        if (playerUpdates.length <= 10) {
          for (const u of playerUpdates) {
            log(
              `  -> ${u.name}: ${u.oldPoints} -> ${u.newPoints} (${u.method})`,
            );
          }
        }
      }

      return playerUpdates.length;
    }

    async function recalculateTeamTotals(
      matchId: string,
      matchLabel: string,
    ): Promise<void> {
      const match = await storage.getMatch(matchId);
      if (!match) return;

      if (match.isVoid) {
        const allTeams = await storage.getAllTeamsForMatch(matchId);
        for (const team of allTeams) {
          if ((team.totalPoints || 0) !== 0) {
            await storage.updateUserTeamPoints(team.id, 0);
          }
        }
        log(`[Heartbeat:Teams] ${matchLabel}: Match is VOID — all points zeroed`);
        return;
      }

      const updatedPlayers = await storage.getPlayersForMatch(matchId);
      const playerById = new Map(updatedPlayers.map((p) => [p.id, p]));
      const playerByExtId = new Map(
        updatedPlayers
          .filter((p) => p.externalId)
          .map((p) => [p.externalId!, p]),
      );
      const allTeams = await storage.getAllTeamsForMatch(matchId);
      const impactEnabled = match.impactFeaturesEnabled === true;

      const teamUpdates: Array<{
        teamId: string;
        teamName: string;
        oldTotal: number;
        newTotal: number;
      }> = [];

      for (const team of allTeams) {
        try {
          const teamPlayerIds = team.playerIds as string[];
          let totalPoints = 0;

          for (const pid of teamPlayerIds) {
            try {
              const p = playerById.get(pid) || playerByExtId.get(pid);
              if (!p) continue;

              let basePts = p.points || 0;
              let multiplier = 1;

              if (pid === team.captainId && (!team.captainType || team.captainType === "player")) {
                multiplier = 2;
              } else if (pid === team.viceCaptainId && (!team.vcType || team.vcType === "player")) {
                multiplier = 1.5;
              }

              const finalPts = Math.round(basePts * multiplier);
              totalPoints += finalPts;
            } catch (playerErr) {
              console.error(
                `[Heartbeat:Teams] FAILED resolving player ${pid} in team ${team.id}:`,
                playerErr,
              );
              continue;
            }
          }

          if (impactEnabled) {
            try {
              const resolved = await storage.resolveImpactSlot(matchId, team.primaryImpactId, team.backupImpactId);
              if (resolved.activePlayerId) {
                const impactPlayer = playerById.get(resolved.activePlayerId) || playerByExtId.get(resolved.activePlayerId);
                if (impactPlayer) {
                  let impactPts = (impactPlayer.points || 0) + 4; // +4 bonus for activated impact sub
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
              newTotal: totalPoints,
            });
          }
        } catch (err) {
          console.error(
            `[Heartbeat:Teams] OUTER CATCH for team ${team.id}:`,
            err,
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
              dbErr,
            );
          }
        }
        log(
          `[Heartbeat:Teams] ${matchLabel}: ${teamUpdates.length} teams recalculated — ${teamUpdates.map((t) => `${t.teamName}: ${t.oldTotal}->${t.newTotal}`).join(", ")}`,
        );
      }
    }

    function extractTotalOversFromScoreString(scoreStr: string): number {
      if (!scoreStr) return 0;
      const matches = scoreStr.match(/\((\d+(?:\.\d+)?)\s*ov\)/g);
      if (!matches) return 0;
      return matches.reduce((sum, m) => {
        const num = parseFloat(m.replace(/[^0-9.]/g, ""));
        return sum + (isNaN(num) ? 0 : num);
      }, 0);
    }

    async function matchHeartbeat(forcedMatchId?: string) {
      if (heartbeatSyncing && !forcedMatchId) {
        const lockAge = Date.now() - heartbeatLockTime;
        if (lockAge < 60000) {
          log("[Heartbeat] SKIPPED: previous sync still in progress");
          return;
        }
        log(
          `[Heartbeat] FORCE UNLOCK: lock held for ${Math.round(lockAge / 1000)}s — resetting stale lock`,
        );
        heartbeatSyncing = false;
      }
      heartbeatSyncing = true;
      heartbeatLockTime = Date.now();
      try {
        const allMatches = await storage.getAllMatches();
        const now = Date.now();

        const liveMatches = allMatches.filter(
          (m) => m.status === "live" || m.status === "delayed" ||
            (m.startTime && new Date(m.startTime).getTime() < now && m.status !== "completed")
        );
        log(`[Heartbeat] polling ${liveMatches.length} active matches (${allMatches.length} total in DB)`);

        for (const match of allMatches) {
          if (forcedMatchId && match.id !== forcedMatchId) continue;

          const startMs = match.startTime
            ? new Date(match.startTime).getTime()
            : 0;
          const revisedMs = (match as any).revisedStartTime
            ? new Date((match as any).revisedStartTime).getTime()
            : 0;
          const effectiveStartMs = revisedMs > 0 ? revisedMs : startMs;
          const isStarted =
            effectiveStartMs > 0 && now > effectiveStartMs && match.status !== "completed";
          const isLive = match.status === "live" || match.status === "delayed";

          if (isStarted && !isLive) {
            log(
              `[Heartbeat] LOCKOUT: ${match.team1Short} vs ${match.team2Short} -> status=live (was ${match.status}, started ${Math.round((now - startMs) / 60000)}m ago)`,
            );
            await storage.updateMatch(match.id, { status: "live" });

            try {
              const matchPlayers = await storage.getPlayersForMatch(match.id);
              const xiPlayers = matchPlayers.filter(
                (p) => p.isPlayingXI && (!p.points || p.points < 4),
              );
              if (xiPlayers.length > 0) {
                for (const p of xiPlayers) {
                  await storage.updatePlayer(p.id, { points: 4 });
                }
                log(
                  `[Heartbeat] LIVE BASE POINTS: Awarded +4 base to ${xiPlayers.length} Playing XI players for ${match.team1Short} vs ${match.team2Short}`,
                );
                await recalculateTeamTotals(
                  match.id,
                  `${match.team1Short} vs ${match.team2Short}`,
                );
              }
            } catch (baseErr) {
              console.error(
                `[Heartbeat] Failed to award base XI points on live transition:`,
                baseErr,
              );
            }
          }

          if (!isLive && !isStarted && !forcedMatchId) continue;

          const matchLabel = `${match.team1Short} vs ${match.team2Short}`;

          // Skip live-score API calls if no users have joined this match
          // (forcedMatchId = admin-triggered run — always poll regardless)
          if (!forcedMatchId) {
            const joinedTeams = await storage.getAllTeamsForMatch(match.id);
            if (joinedTeams.length === 0) {
              log(`[Heartbeat] SKIP ${matchLabel} — 0 users joined, no API calls needed`);
              continue;
            }
          }

          try {
            const {
              pointsMap,
              namePointsMap,
              scoreString,
              matchEnded,
              totalOvers,
              source,
            } = await updateLiveScore(match);

            const existingScoreStr = (match as any).scoreString || "";
            const existingOvers =
              extractTotalOversFromScoreString(existingScoreStr);
            const existingInningsCount = (
              existingScoreStr.match(/\(\d+(?:\.\d+)?\s*ov\)/g) || []
            ).length;
            const incomingInningsCount = scoreString
              ? (scoreString.match(/\(\d+(?:\.\d+)?\s*ov\)/g) || []).length
              : 0;
            const isStaleScore =
              totalOvers > 0 &&
              totalOvers < existingOvers &&
              incomingInningsCount <= existingInningsCount;
            if (isStaleScore) {
              log(
                `[Heartbeat] STALE SCORE skipped for ${matchLabel}: incoming ${totalOvers} ov < existing ${existingOvers} ov — points still processed`,
              );
            }

            if (
              !isStaleScore &&
              scoreString &&
              scoreString !== (match as any).scoreString
            ) {
              await storage.updateMatch(match.id, {
                scoreString,
                lastSyncAt: new Date(),
              } as any);
            }

            if (matchEnded && match.status !== "completed") {
              log(`[Heartbeat] COMPLETED: ${matchLabel}`);
              await storage.updateMatch(match.id, { status: "completed" });
              try {
                const distribute = (globalThis as any).__distributeMatchReward;
                if (distribute) await distribute(match.id);
              } catch (rewardErr) {
                console.error(
                  `[Heartbeat] Reward distribution failed for ${matchLabel}:`,
                  rewardErr,
                );
              }
            }

            if (pointsMap.size > 0 && !(match as any).firstScorecardAt) {
              try {
                await storage.updateMatch(match.id, { firstScorecardAt: new Date() } as any);
                log(`[Heartbeat] firstScorecardAt recorded for ${matchLabel}`);
              } catch (fse) {
                console.error(`[Heartbeat] Failed to set firstScorecardAt for ${matchLabel}:`, fse);
              }
            }

            if (pointsMap.size > 0) {
              const updatedCount = await updateFantasyPoints(
                match.id,
                matchLabel,
                pointsMap,
                namePointsMap,
              );
              if (updatedCount > 0) {
                await recalculateTeamTotals(match.id, matchLabel);
              }
            } else {
              const matchPlayers = await storage.getPlayersForMatch(match.id);
              const xiPlayersWithZero = matchPlayers.filter(
                (p) => p.isPlayingXI && (p.points === 0 || p.points === null),
              );
              if (xiPlayersWithZero.length > 0) {
                log(
                  `[Heartbeat:Points] ${matchLabel}: No scorecard data yet, applying +4 XI base to ${xiPlayersWithZero.length} players`,
                );
                for (const p of xiPlayersWithZero) {
                  await storage.updatePlayer(p.id, { points: 4 });
                }
                await recalculateTeamTotals(match.id, matchLabel);
              }
            }

            if (source) {
              log(
                `[Heartbeat] ${matchLabel} synced via ${source}${scoreString ? ` — ${scoreString.substring(0, 80)}` : ""}`,
              );
            }
          } catch (err) {
            console.error(`[Heartbeat] sync FAILED for ${matchLabel}:`, err);
          }
        }

        // Time-based squad fetching for upcoming matches
        // Stages: >48h → skip | 48h–60min → every 20min | <60min → every 5min
        // Permanently stop once players >= SQUAD_MIN_PLAYERS or match is live
        try {
          const { fetchMatchSquad, fetchSeriesSquad } = await import("./cricket-api");
          const squadCandidates = allMatches.filter(
            (m) => m.externalId && m.status === "upcoming" && m.startTime
          );

          for (const match of squadCandidates) {
            const startMs = new Date(match.startTime!).getTime();
            const minsToStart = (startMs - now) / 60_000;

            // >48h away: too early, don't poll
            if (minsToStart > 48 * 60) continue;

            // Already have a full squad: done permanently
            const existingPlayers = await storage.getPlayersForMatch(match.id);
            if (existingPlayers.length >= SQUAD_MIN_PLAYERS) continue;

            // Determine the polling interval for this window
            const pollInterval = minsToStart > 60 ? SQUAD_POLL_FAR : SQUAD_POLL_CLOSE;
            const lastAttempt = lastSquadFetchAttempt.get(match.id) ?? 0;
            if (now - lastAttempt < pollInterval) continue; // not due yet

            lastSquadFetchAttempt.set(match.id, now);
            const label = `${match.team1Short} vs ${match.team2Short}`;
            const windowTag = minsToStart > 60 ? "48h–60min window" : "final 60min window";
            log(`[Heartbeat:Squad] Fetching squad for ${label} (${Math.round(minsToStart)}min to start, ${windowTag})`);

            try {
              let squad = await fetchMatchSquad(match.externalId!);
              let squadSource = "match_squad";

              if (squad.length === 0 && match.seriesId) {
                const seriesPlayers = await fetchSeriesSquad(match.seriesId);
                const t1 = match.team1.toLowerCase();
                const t2 = match.team2.toLowerCase();
                const t1s = (match.team1Short || "").toLowerCase();
                const t2s = (match.team2Short || "").toLowerCase();
                squad = seriesPlayers.filter((p) => {
                  const pTeam = p.team.toLowerCase();
                  const pShort = p.teamShort.toLowerCase();
                  return (
                    pTeam === t1 || pTeam === t2 ||
                    pTeam.includes(t1) || t1.includes(pTeam) ||
                    pTeam.includes(t2) || t2.includes(pTeam) ||
                    pShort === t1s || pShort === t2s
                  );
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
                    credits: p.credits,
                  }))
                );
                log(`[Heartbeat:Squad] Loaded ${squad.length} players for ${label} via ${squadSource}`);
              } else {
                log(`[Heartbeat:Squad] No squad yet for ${label} — will retry in ${minsToStart > 60 ? "20min" : "5min"}`);
              }
            } catch (squadErr) {
              // Silent fail — will retry at next interval
            }
          }
        } catch (squadErr) {
          // Silent fail for auto-squad logic
        }
      } catch (err) {
        console.error("[Heartbeat] scheduler error:", err);
      } finally {
        heartbeatSyncing = false;
      }
    }

    (globalThis as any).__matchHeartbeat = matchHeartbeat;
    (globalThis as any).__recalculateTeamTotals = recalculateTeamTotals;

    setInterval(matchHeartbeat, HEARTBEAT_INTERVAL);
    log(
      "Match Heartbeat started (every 60s — score sync, points, lockout, stale-data rejection)",
    );
  });
})();
