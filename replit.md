# CDO Cricket - Fantasy Cricket Platform

## Overview

CDO Cricket is a private, invite-only Fantasy Cricket platform built for a closed group of friends, inspired by Dream11. Users sign up and wait for admin approval before they can log in and access the app. The app features a premium dark/light theme with a 4-tier color palette: Deep Blue & Gold (dominant brand), Purple/Magenta (featured accent for hero/spotlight), Orange (live/urgency indicators). All screens use desktop max-width containers (700px screens, 800px admin), web hover states with cursor:pointer, and consistent card depth/hierarchy.

The project uses an **Expo React Native** frontend (targeting web, iOS, and Android) with an **Express.js** backend and **PostgreSQL** database via **Drizzle ORM**. It follows a monorepo structure where the frontend and backend share schema definitions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo/React Native)
- **Framework**: Expo SDK 54 with React Native 0.81, using expo-router for file-based routing
- **State Management**: React Context API for auth (`AuthContext`), theme (`ThemeContext`), and teams (`TeamContext`); TanStack React Query for server state/data fetching
- **Navigation**: File-based routing via expo-router with a bottom tab layout (Home, My Matches, Leaderboard, Profile) and stack screens for match details, team creation, admin, and auth flows
- **Styling**: React Native StyleSheet with a custom theme system (dark mode default, light mode toggle). Colors defined in `constants/colors.ts`. Uses Inter font family via `@expo-google-fonts/inter`
- **Key UI Libraries**: expo-linear-gradient, expo-blur, expo-haptics, expo-image, react-native-reanimated, react-native-gesture-handler

### Backend (Express.js)
- **Location**: `server/` directory — `index.ts` (entry), `routes.ts` (API routes), `storage.ts` (database access layer), `cricket-api.ts` (external cricket data), `db.ts` (database connection)
- **Authentication**: Session-based auth using `express-session` with cookies + Bearer token fallback. Sessions stored in PostgreSQL via `connect-pg-simple` (persistent across deploys). Token auth uses HMAC-SHA256 signed tokens
- **Authorization**: Middleware functions `isAuthenticated` and `isAdmin` protect routes. Admin determined by email whitelist (`admin@cdo.com`) and `isAdmin` flag in database
- **API Pattern**: RESTful JSON API under `/api/` prefix. Routes include auth (signup/login/logout/me), matches, players, teams (CRUD), admin (user approvals, match sync)
- **CORS**: Dynamic CORS configuration supporting Replit domains and localhost for development

### Shared Code
- **Location**: `shared/schema.ts` — contains Drizzle ORM table definitions and Zod validation schemas (via `drizzle-zod`)
- **Path aliases**: `@/*` maps to project root, `@shared/*` maps to `./shared/*`

### Database (PostgreSQL + Drizzle ORM)
- **ORM**: Drizzle ORM with `drizzle-kit` for migrations
- **⚠️ THREE SEPARATE DATABASE INSTANCES — CRITICAL**:
  - **Dev DB** (`executeSql(environment:"development")`): Replit-managed PostgreSQL at `heliumdb` (PGHOST=helium). Only used locally.
  - **Replit "production" DB** (`executeSql(environment:"production")`): Neon PostgreSQL (`neondb`, user=`neondb_owner`, IP=`169.254.254.254`). This is a MIRROR of early production data and is **NOT the live Railway app database**. Querying this does NOT reflect what the live app sees.
  - **Railway production DB** (the REAL live app database): Railway-managed PostgreSQL at `shortline.proxy.rlwy.net`, database name `railway`, user `postgres`. This is what `server/db.ts` connects to on Railway (detected via `DATABASE_URL.includes("railway") || DATABASE_URL.includes("rlwy")`). This is the ONLY database that matters for production users, signups, and approvals. **Access method from Replit**: Use the `DESTINATION_DB` Replit secret — it contains the Railway connection string. Query via bash: `NODE_TLS_REJECT_UNAUTHORIZED=0 node -e "const pg=require('pg'); const pool=new pg.Pool({connectionString:process.env.DESTINATION_DB,ssl:true}); ..."`. Do NOT use `executeSql()` for Railway production data — it connects to the wrong database.
  - The Replit Neon DB and Railway DB both started with the same 11 seed users (ravee, ajay, Ilamcetni, etc.) but have diverged. All new signups (uthra, any user after Feb 23) exist ONLY in Railway's DB.
- **Connection**: `pg` (node-postgres) pool via `DATABASE_URL`. Pool settings: max 10, idleTimeout 30s, connectionTimeout 2s. `connectWithRetry()` in `server/db.ts` retries up to 10× with 3s delay before server starts accepting requests. Pool error events logged to console. Health check endpoint at `/health` returns `{server, database}` status
- **Schema** (`shared/schema.ts`):
  - `users` — id (UUID), username, email, phone, password (plain text currently), isVerified, isAdmin, joinedAt
  - `referenceCodes` — id, code (4-char), isActive, createdBy, createdAt. Used for invite-only gating
  - `matches` — id, externalId, team1/team2 info (names, short codes, colors), venue, startTime, status, league info, tournamentName, entryStake (default 30), potProcessed, impactFeaturesEnabled, officialWinner, isVoid
  - `tournamentLedger` — id, userId, userName, matchId, tournamentName, pointsChange, createdAt. Transactional history for zero-sum tournament points
  - `players` — id, match-linked player data with roles (WK/BAT/AR/BOWL), credits, points, impact player flag
  - `userTeams` — id, userId, matchId, team name, playerIds (JSONB array), captainId, viceCaptainId, primaryImpactId, backupImpactId, captainType, vcType, invisibleMode, predictionPoints, totalPoints
  - `matchPlayerStatus` — matchId, playerId, adminStatus, actualParticipationStatus, officialImpactSubUsed, sourceType, updatedAt
  - `userWeeklyUsage` — userId, weekStartDate, multiTeamUsageCount, invisibleModeUsageCount
  - `adminAuditLog` — userId, userName, entityType, entityId, actionType, metadata, createdAt
  - `matchPredictions` — id, userId, matchId, predictedWinner (team short code), createdAt. One prediction per user per match
  - `codeVerifications` — tracks which users verified with which codes
  - `rewards` — id, brand, title, code, terms, isClaimed, claimedByUserId, claimedMatchId, claimedAt, createdAt. Reward vault for auto-distribution to match winners
- **Push command**: `npm run db:push` uses drizzle-kit to push schema to database

### Key Business Rules
- **Invite-only access**: After signup, users must wait for admin approval before they can log in. All 3 admins (ravee, ajay, Ilamcetni) can approve/reject new signups from the Admin Panel's User Approvals section. Rejected users are deleted from the database
- **Match visibility**: Matches appear on the dashboard up to 7 days before start time (so admin-imported matches are visible immediately after adding)
- **Team constraints**: Max 3 teams per user per match; 11 players per team with role limits (WK: 1-4, BAT: 1-6, AR: 1-6, BOWL: 1-6); max 10 players from single real team; Captain (2x points) and Vice-Captain (1.5x points); duplicate teams (same players + same C/VC) are blocked
- **Entry deadline**: Teams editable up to 1 second before match start; server time used for validation (not device time)
- **Winner Predictions**: Mandatory prediction modal intercepts first team submission per match; user must pick team1 or team2 as winner. Predictions hidden from others pre-match, revealed when match goes live. One prediction per user per match (can be updated pre-match). Displayed on match detail overview tab
- **Impact Picks System**: Users pick Primary + Backup Impact players (same franchise, not in Main XI). If the Primary enters as Impact Sub (officialImpactSubUsed=true), they score for you; otherwise Backup is tried; otherwise slot scores 0. +4 bonus for activated impact player. C/VC can be assigned to Impact Slot (captainType/vcType = 'impact_slot') for 2x/1.5x multiplier on the slot's points. Match-level toggle via `impactFeaturesEnabled`
- **Invisible Mode**: Users can hide their team from others during live matches (revealed on completion). Weekly limit: 1 invisible mode use per IST week
- **Weekly Restrictions**: Max 3 multi-team entries per IST week (Mon-Sun). Admin can lock/unlock. Tracked in userWeeklyUsage table
- **Match Void**: Admin can void matches, zeroing all team points and excluding from scoring
- **Admin Audit Log**: All admin actions logged with entityType/entityId/actionType/metadata for accountability
- **Rewards System**: Admin adds reward codes (brand, title, coupon code, terms) to a vault via the Admin Panel. When a match completes (via heartbeat or manual admin action), the Rank 1 player automatically receives an unclaimed reward from the vault. Winners see a gold banner on the match standings page with a modal to reveal and copy their reward code. All rewards are also listed in the Profile → My Rewards section
- **Tournament Standings (Zero-Sum)**: Matches can be assigned a tournamentName and entryStake (default 30). Admin processes pot after match completion. Winners get (losers × stake / winners), losers get -stake. Each team entry counts separately (user with 2 losing teams gets 2× -stake). Standings tab shows aggregated points per user across tournament. potProcessed flag prevents double-counting
- **Fantasy Points Engine** (`calculateFantasyPoints` in `server/cricket-api.ts`):
  - Batting: +1/run, +4/four, +6/six, -2 duck. Milestones MUTUALLY EXCLUSIVE: 100+=+16, 75+=+12, 50+=+8, 25+=+4. SR bonus/penalty (≥10 balls): >170=+6, >150=+4, ≥130=+2, ≤70=-2, <60=-4, <50=-6
  - Bowling: +30/wicket, wicket milestones (5w=+16, 4w=+8, 3w=+4 mutually exclusive), +12/maiden, +1/dot ball, economy bonus/penalty (≥2 overs), +8 per bowled/LBW dismissal
  - Fielding: +8/catch, +4 one-time bonus for 3+ catches, +12 stumping, run out: direct hit (1 fielder)=+12, multi-fielder=+6 to involved players
  - Playing XI base: +4 pts for being in the Playing XI

### Build & Development
- **Dev mode**: Two processes — `npm run expo:dev` (Expo dev server) and `npm run server:dev` (Express via tsx)
- **Production build**: `npm run expo:static:build` builds the web client; `npm run server:build` bundles server with esbuild; `npm run server:prod` runs production server
- **Static web serving**: Production server serves built Expo web assets from `dist/` directory

## External Dependencies

### Database
- **PostgreSQL**: Required. Connected via `DATABASE_URL` environment variable. Used through Drizzle ORM with node-postgres driver

### External APIs
- **CricAPI** (`https://api.cricapi.com/v1`): Cricket data API for match sync, player squads, scorecards, live scores. Has rate limits (2000 calls/day per key). Uses a 2-key fallback system: when primary key (`CRICKET_API_KEY`) quota is exhausted, automatically switches to Tier 2 key (`CRICAPI_KEY_TIER2`) for 1 hour. Used in `server/cricket-api.ts`

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — Express session secret (falls back to dev default)
- `EXPO_PUBLIC_DOMAIN` — Public domain for API requests from the client
- `REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS` — Replit-specific for CORS and dev setup
- `CRICKET_API_KEY` — Primary CricAPI key (Tier 1)
- `CRICAPI_KEY_TIER2` — Fallback CricAPI key (Tier 2, auto-used when Tier 1 quota exhausted)

### Key NPM Packages
- **Frontend**: expo, expo-router, react-native, @tanstack/react-query, expo-linear-gradient, expo-haptics, expo-image, react-native-reanimated, react-native-gesture-handler, @react-native-async-storage/async-storage
- **Backend**: express, express-session, pg, drizzle-orm
- **Shared**: drizzle-zod, zod

## Static Assets

### User Avatars
- **Location**: `assets/images/` (avatar JPEG files, e.g. `ravee-avatar.jpg`)
- **Utility**: `utils/userAvatars.ts` — `getCustomAvatar(userId)` maps Railway UUID → require() for local avatar image
- **Component**: `components/UserAvatar.tsx` — renders circular user avatar with fallback to initials
- **Coverage**: All 10 active production users mapped by Railway UUID

### Player Headshot Images (CSK complete + RCB complete — 49 players total)
- **Location**: `assets/images/players/{player_id}.jpeg` — keyed by the player's API UUID
- **Utility**: `utils/playerImages.ts` — `getPlayerImage(playerId)` returns `ImageSourcePropType | null`. Returns `null` for unmapped players (safe fallback).
- **Coverage**:
  - CSK (24 players, complete) — Batch 1 (19): Ruturaj Gaikwad, MS Dhoni, Noor Ahmad, Ayush Mhatre, Khaleel Ahmed, Rahul Chahar, Nathan Ellis, Anshul Kamboj, Akeal Hosein, Dewald Brewis, Sanju Samson, Matt Henry, Jamie Overton, Kartik Sharma, Matthew Short, Gurjapneet Singh, Mukesh Choudhary, Ramakrishna Ghosh, Prashant Veer. Batch 2 (5): Shivam Dube, Urvil Patel, Shreyas Gopal, Zakary Foulkes, Sarfaraz Khan
  - RCB (25 players, complete) — Batch 1 (17): Abhinandan Singh, Bhuvneshwar Kumar, Devdutt Padikkal, Jacob Bethell, Jacob Duffy, Jitesh Sharma, Jordan Cox, Josh Hazlewood, Krunal Pandya, Mangesh Yadav, Nuwan Thushara, Philip Salt, Rajat Patidar, Rasikh Salam, Romario Shepherd, Satvik Deswal, Swapnil Singh. Batch 2 (8): Kanishk Chouhan, Suyash Sharma, Tim David, Venkatesh Iyer, Vicky Ostwal, Vihaan Malhotra, Virat Kohli, Yash Dayal
- **UI integration**: `app/create-team/[matchId].tsx` — `PlayerItem`, `CompactPlayerItem`, `CaptainItem` all show circular player photo (40px) with colored role badge overlay when a photo exists. Fallback: existing role pill unchanged (no layout shift for unmapped players).
- **Extending**: To add more teams (MI, SRH, DC, etc.), append new entries to `PLAYER_IMAGES` in `utils/playerImages.ts` with the player's API UUID as key and a `require('../assets/images/players/{id}.jpeg')` as value. Add corresponding JPEG to `assets/images/players/`.