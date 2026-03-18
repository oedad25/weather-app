# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

- **Install:** `npm install` (monorepo — installs all workspace deps)
- **Start PostgreSQL:** `docker compose up postgres -d`
- **Env setup:** `cp .env.example .env` and fill in secrets
- **Migrate DB:** `cd server && npx prisma migrate dev`
- **Build server:** `cd server && npx tsc`
- **Build client:** `cd client && npx tsc`
- **Run server:** `cd server && node dist/index.js` (serves frontend at `/` in production mode)
- **Full Docker stack:** `docker compose up --build`

## Testing

- **All server tests:** `cd server && npx vitest run`
- **Unit only:** `cd server && npx vitest run src/tests/unit/`
- **Integration only:** `cd server && npx vitest run src/tests/integration/` (requires PostgreSQL)
- **Single test file:** `cd server && npx vitest run src/tests/unit/jwt.test.ts`
- **E2E:** `cd e2e && npx playwright test` (requires Docker Compose stack)

Integration tests need these env vars (set in `server/vitest.config.ts`): `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=test`.

## Architecture

Monorepo with npm workspaces: `client/`, `server/`, `e2e/`.

### Server (`server/`)

Express + TypeScript backend with ES modules. Entry: `src/index.ts` → `src/app.ts` (factory).

- **Routes** (`src/routes/`) — auth, weather, favorites. Thin handlers that parse input and call services.
- **Services** (`src/services/`) — business logic. Auth (register/login/refresh/logout), weather (fetch + cache + history), favorites (CRUD with 5-max limit).
- **Middleware** (`src/middleware/`) — `auth.ts` (JWT verification, sets `req.userId`), `rate-limit.ts` (global 100/15min, weather 30/min), `error-handler.ts` (AppError/ZodError/unhandled).
- **Schemas** (`src/schemas/`) — Zod validation for request bodies/params.
- **Database** — PostgreSQL via Prisma. Schema at `prisma/schema.prisma`. Singleton client at `src/lib/prisma.ts`.

Weather data is cached in Celsius (canonical unit) and converted to Fahrenheit at response time via `src/utils/temperature.ts`.

### Client (`client/`)

Vanilla TypeScript frontend. `app.ts` → `api.ts`, `auth.ts`, `ui.ts`, `storage.ts` → `types.ts`.

- Calls backend API (not external APIs directly)
- Token management in `auth.ts` — stores access token in memory, refresh token in HTTP-only cookie, auto-refreshes on 401
- `storage.ts` only persists theme and temperature unit to localStorage

## Key Conventions

- **ES module imports use `.js` extensions** everywhere (required for Node16 module resolution and browser ES modules)
- **Error responses** follow `{ error: { code: string, message: string } }` format
- **Auth** uses Bearer JWT for access tokens (15min TTL) and HTTP-only cookies for refresh tokens (7-day TTL)
- **Tests** use Vitest with `pool: "forks"` and `singleFork: true` to prevent DB race conditions between test files
- **Test setup** (`src/tests/setup.ts`) clears all tables before each test
- **Test helpers** (`src/tests/helpers.ts`) use bcrypt cost factor 4 for speed
