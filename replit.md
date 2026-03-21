# CDO Cricket - Fantasy Cricket Platform

## Overview

CDO Cricket is an invite-only Fantasy Cricket platform inspired by Dream11, designed for a private group of friends. It allows users to create fantasy teams, predict match outcomes, and compete in tournaments. The platform supports a premium dark/light theme and features a sophisticated points engine. Access is restricted, requiring admin approval after signup. The project aims to provide a robust and engaging fantasy cricket experience within a closed community.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The project is built as a monorepo, sharing schema definitions between the frontend and backend.

### Frontend (Expo/React Native)
- **Framework**: Expo SDK 54 with React Native 0.81, utilizing `expo-router` for file-based routing.
- **State Management**: React Context API for core application states (authentication, theme, teams) and TanStack React Query for server data fetching.
- **Navigation**: Employs a bottom tab navigation layout (Home, My Matches, Leaderboard, Profile) with stack screens for detailed views, team creation, admin functions, and authentication flows.
- **Styling**: React Native StyleSheet, custom theme system with dark mode as default, and Inter font family.
- **UI/UX**: Features a premium dark/light theme with a 4-tier color palette (Deep Blue & Gold, Purple/Magenta, Orange). All screens adhere to desktop max-width containers (700px for users, 800px for admin) and consistent card depth/hierarchy.

### Backend (Express.js)
- **Structure**: Located in the `server/` directory, handling API routes, database access, and external cricket data integration.
- **Authentication**: Session-based using `express-session` and cookies, with HMAC-SHA256 signed tokens as a fallback. Sessions are persisted in PostgreSQL.
- **Authorization**: `isAuthenticated` and `isAdmin` middleware protect routes, with admin status determined by an email whitelist and database flag.
- **API Pattern**: RESTful JSON API under the `/api/` prefix, covering auth, matches, players, teams (CRUD), and admin functionalities (user approvals, match sync).
- **CORS**: Dynamically configured to support Replit domains and localhost.

### Shared Code
- Contains Drizzle ORM table definitions and Zod validation schemas, enabling consistent data structures across frontend and backend.

### Database (PostgreSQL + Drizzle ORM)
- **ORM**: Drizzle ORM with `drizzle-kit` for schema migrations.
- **Database Instances**: Critical distinction between three instances:
    - **Development DB**: Replit-managed PostgreSQL (`heliumdb`).
    - **Replit "Production" DB**: Neon PostgreSQL (`neondb`), a mirror of early production data, *not* the live app.
    - **Railway Production DB**: The **live production database** hosted on Railway. This is the primary source for all current user data and application state.
- **Connection**: `pg` (node-postgres) pool with connection retry logic.
- **Key Business Rules**:
    - **Invite-only Access**: New users require admin approval to log in.
    - **Match Visibility**: Matches appear on the dashboard up to 7 days before start.
    - **Team Constraints**: Max 3 teams per user per match, 11 players per team with role limits, max 10 players from a single real team, unique teams (C/VC included) enforced.
    - **Entry Deadline**: Teams editable until 1 second before match start based on server time.
    - **Winner Predictions**: Mandatory prediction (team 1 or 2) on first team submission, visible to others post-match.
    - **Impact Picks System**: Allows users to select primary and backup impact players for potential bonus points based on in-game substitutions.
    - **Invisible Mode**: Users can hide their team during live matches, with a weekly usage limit.
    - **Weekly Restrictions**: Limits on multi-team entries per week.
    - **Match Void**: Admin can void matches, nullifying scores and excluding them from scoring.
    - **Admin Audit Log**: Logs all administrative actions.
    - **Rewards System**: Automated distribution of rewards to match winners from an admin-managed vault.
    - **Tournament Standings**: Zero-sum points system for matches assigned to tournaments, with pot processing by admin.
    - **Fantasy Points Engine**: Detailed scoring logic for batting, bowling, and fielding, including bonuses and penalties for performance metrics, milestones, and impact player activation.

## External Dependencies

### Database
- **PostgreSQL**: The primary database, accessed via `DATABASE_URL` environment variable and Drizzle ORM.

### External APIs
- **CricAPI (`https://api.cricapi.com/v1`)**: Provides cricket data for match synchronization, player squads, scorecards, and live scores. Features a 2-key fallback system to manage rate limits.

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string.
- `SESSION_SECRET`: Secret for Express sessions.
- `EXPO_PUBLIC_DOMAIN`: Public domain for client-side API requests.
- `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS`: Replit-specific configurations for CORS and development.
- `CRICKET_API_KEY`, `CRICAPI_KEY_TIER2`: Primary and fallback API keys for CricAPI.

### Key NPM Packages
- **Frontend**: `expo`, `expo-router`, `react-native`, `@tanstack/react-query`, `expo-linear-gradient`, `expo-haptics`, `expo-image`, `react-native-reanimated`, `react-native-gesture-handler`, `@react-native-async-storage/async-storage`.
- **Backend**: `express`, `express-session`, `pg`, `drizzle-orm`.
- **Shared**: `drizzle-zod`, `zod`.