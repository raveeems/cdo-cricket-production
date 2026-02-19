# CDO Cricket - Fantasy Cricket Platform

## Overview

CDO Cricket is a private, invite-only Fantasy Cricket platform built for a closed group of friends, inspired by Dream11. Users sign up, enter a 4-digit reference code to gain access, then create fantasy teams for upcoming cricket matches. The app features a modern dark/light theme with blue and yellow primary colors.

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
- **API Pattern**: RESTful JSON API under `/api/` prefix. Routes include auth (signup/login/logout/me), matches, players, teams (CRUD), admin (reference codes, match sync)
- **CORS**: Dynamic CORS configuration supporting Replit domains and localhost for development

### Shared Code
- **Location**: `shared/schema.ts` — contains Drizzle ORM table definitions and Zod validation schemas (via `drizzle-zod`)
- **Path aliases**: `@/*` maps to project root, `@shared/*` maps to `./shared/*`

### Database (PostgreSQL + Drizzle ORM)
- **ORM**: Drizzle ORM with `drizzle-kit` for migrations
- **Connection**: `pg` (node-postgres) pool, configured via `DATABASE_URL` environment variable
- **Schema** (`shared/schema.ts`):
  - `users` — id (UUID), username, email, phone, password (plain text currently), isVerified, isAdmin, joinedAt
  - `referenceCodes` — id, code (4-char), isActive, createdBy, createdAt. Used for invite-only gating
  - `matches` — id, externalId, team1/team2 info (names, short codes, colors), venue, startTime, status, league info
  - `players` — id, match-linked player data with roles (WK/BAT/AR/BOWL), credits, points, impact player flag
  - `userTeams` — id, userId, matchId, team name, playerIds (JSONB array), captainId, viceCaptainId, totalPoints
  - `codeVerifications` — tracks which users verified with which codes
- **Push command**: `npm run db:push` uses drizzle-kit to push schema to database

### Key Business Rules
- **Invite-only access**: After signup, users must enter a valid 4-digit reference code (checked against `referenceCodes` table where `isActive = true`) before accessing the app
- **Match visibility**: Matches should only appear on the dashboard 48 hours before start time
- **Team constraints**: Max 3 teams per user per match; 11 players per team with role limits (WK: 1-4, BAT: 1-6, AR: 1-4, BOWL: 1-4); max 10 players from single real team; Captain (2x points) and Vice-Captain (1.5x points); duplicate teams (same players + same C/VC) are blocked
- **Entry deadline**: Teams editable up to 1 second before match start; server time used for validation (not device time)
- **Impact Players**: Super sub system where substituted players earn points normally

### Build & Development
- **Dev mode**: Two processes — `npm run expo:dev` (Expo dev server) and `npm run server:dev` (Express via tsx)
- **Production build**: `npm run expo:static:build` builds the web client; `npm run server:build` bundles server with esbuild; `npm run server:prod` runs production server
- **Static web serving**: Production server serves built Expo web assets from `dist/` directory

## External Dependencies

### Database
- **PostgreSQL**: Required. Connected via `DATABASE_URL` environment variable. Used through Drizzle ORM with node-postgres driver

### External APIs
- **CricAPI** (`https://api.cricapi.com/v1`): Cricket data API for match sync, player squads, scorecards, live scores. Has rate limits (2000 calls/day, 15min block on overuse). Used in `server/cricket-api.ts`

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — Express session secret (falls back to dev default)
- `EXPO_PUBLIC_DOMAIN` — Public domain for API requests from the client
- `REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS` — Replit-specific for CORS and dev setup
- Cricket API key (referenced in `server/cricket-api.ts`)

### Key NPM Packages
- **Frontend**: expo, expo-router, react-native, @tanstack/react-query, expo-linear-gradient, expo-haptics, expo-image, react-native-reanimated, react-native-gesture-handler, @react-native-async-storage/async-storage
- **Backend**: express, express-session, pg, drizzle-orm
- **Shared**: drizzle-zod, zod
- **Build**: drizzle-kit, esbuild, tsx, patch-package