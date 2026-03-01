import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { syncMatchesFromApi } from "./cricket-api";
import { storage } from "./storage";
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

  // ✅ Expo manifest routing + IMPORTANT: never let SPA fallback hijack file requests
  app.use((req: Request, res: Response, next: NextFunction) => {
    // API should behave normally
    if (req.path.startsWith("/api")) return next();

    // Expo native clients (ios/android) hit "/" or "/manifest" with expo-platform header
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      if (req.path === "/" || req.path === "/manifest") {
        return serveExpoManifest(platform, res);
      }
    }

    // If the request looks like a file (has an extension), DO NOT serve index.html.
    // Let express.static try first; if nothing matches, return a real 404 (not HTML).
    if (path.extname(req.path)) {
      res.status(404).type("text/plain").send("Not Found");
      return;
    }

    return next();
  });

  // 1) Serve the web build folder (index.html, bundles, etc.)
  if (hasWebBuild) {
    // Serve /assets from the web build FIRST (this is where Expo puts fonts/bundles)
    const webAssetsPath = path.join(webDistPath, "assets");
    if (fs.existsSync(webAssetsPath)) {
      app.use(
        "/assets",
        express.static(webAssetsPath, {
          setHeaders: (res, filePath) => {
            // Long cache for hashed assets (fonts/js/images)
            res.setHeader(
              "Cache-Control",
              "public, max-age=31536000, immutable",
            );
            // Help fonts load cross-origin if needed
            if (/\.(ttf|otf|woff|woff2)$/i.test(filePath)) {
              res.setHeader("Access-Control-Allow-Origin", "*");
            }
          },
        }),
      );
    }

    // Serve the rest of the web build (but DO NOT remap /assets here again)
    app.use(
      express.static(webDistPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) {
            res.setHeader(
              "Cache-Control",
              "no-cache, no-store, must-revalidate",
            );
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
          } else {
            res.setHeader(
              "Cache-Control",
              "public, max-age=31536000, immutable",
            );
          }
        },
      }),
    );
  }

  // 2) Serve your project-level assets (only if you actually use /assets for custom images)
  // Put this AFTER web build assets so it doesn't hide Expo build assets.
  // IMPORTANT:
  // Expo web build may request fonts like:
  // /assets/node_modules/@expo-google-fonts/.../*.ttf
  // Those files live in the project root (node_modules), not in ./assets.
  // So we serve /assets from the project root.
  // 3) Serve static-build (if used)
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.method === "GET" && req.accepts("html")) {
      if (hasWebBuild) {
        const indexHtml = fs.readFileSync(
          path.join(webDistPath, "index.html"),
          "utf-8",
        );
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

  const port = Number(process.env.PORT) || 3000;

  server.listen(port, "0.0.0.0", () => {
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
          const xiBase = player.isPlayingXI ? 4 : 0;

          let finalPts: number;

          if (fantasyPts !== undefined && fantasyPts !== null) {
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
      const updatedPlayers = await storage.getPlayersForMatch(matchId);
      const playerById = new Map(updatedPlayers.map((p) => [p.id, p]));
      const playerByExtId = new Map(
        updatedPlayers
          .filter((p) => p.externalId)
          .map((p) => [p.externalId!, p]),
      );
      const allTeams = await storage.getAllTeamsForMatch(matchId);

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

              if (pid === team.captainId) {
                multiplier = 2;
              } else if (pid === team.viceCaptainId) {
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

        for (const match of allMatches) {
          if (forcedMatchId && match.id !== forcedMatchId) continue;

          const startMs = match.startTime
            ? new Date(match.startTime).getTime()
            : 0;
          const isStarted =
            startMs > 0 && now > startMs && match.status !== "completed";
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
      } catch (err) {
        console.error("[Heartbeat] scheduler error:", err);
      } finally {
        heartbeatSyncing = false;
      }
    }

    (globalThis as any).__matchHeartbeat = matchHeartbeat;

    setInterval(matchHeartbeat, HEARTBEAT_INTERVAL);
    log(
      "Match Heartbeat started (every 60s — score sync, points, lockout, stale-data rejection)",
    );
  });
})();
