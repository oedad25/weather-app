# SkyCheck Full-Stack Upgrade — Design Spec

## Goal

Transform the existing vanilla TypeScript weather app into a production-grade full-stack application with a backend, database, auth, testing, CI/CD, and deployment.

## Architecture

```
┌─────────────┐     ┌─────────────────────┐     ┌────────────┐
│   Frontend   │────▶│   Express Backend    │────▶│ PostgreSQL │
│  (vanilla TS)│◀────│   (TypeScript)       │◀────│            │
└─────────────┘     └──────────┬──────────┘     └────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  Open-Meteo API  │
                      │  BigDataCloud    │
                      └─────────────────┘
```

The frontend stops calling external APIs directly. All requests go through the Express backend, which handles auth, caching, rate limiting, and proxying to external APIs.

### Monorepo Structure

```
weather-app/
├── client/              ← existing frontend, moved here
├── server/              ← new Express + TypeScript backend
├── docker-compose.yml
├── .github/workflows/
└── package.json         ← root workspace (npm workspaces)
```

## Backend

### Tech Stack

- Express + TypeScript
- Prisma ORM
- PostgreSQL
- Zod for input validation
- JWT + bcrypt for auth
- express-rate-limit for rate limiting
- swagger-jsdoc + swagger-ui-express for API docs

### API Endpoints

```
Auth:
  POST   /api/auth/register      ← create account (email + password)
  POST   /api/auth/login         ← returns JWT
  POST   /api/auth/logout        ← invalidates token
  GET    /api/auth/me            ← get current user profile

Weather (all require auth):
  GET    /api/weather/search?city=Denver    ← geocode + fetch weather
  GET    /api/weather/coords?lat=X&lon=Y   ← weather by coordinates
  GET    /api/weather/history               ← user's search history

Favorites (all require auth):
  GET    /api/favorites           ← list user's favorites
  POST   /api/favorites           ← add a favorite
  DELETE /api/favorites/:id       ← remove a favorite
```

### Auth

- Passwords hashed with bcrypt
- Access token (JWT) held in memory on the client
- Refresh token in HTTP-only cookie
- Middleware extracts and verifies JWT on protected routes

### Server-Side Weather Caching

Weather responses cached in the database for 15 minutes per location. Shared across all users — if two users search "Denver" within that window, only one external API call is made.

### Input Validation

Every endpoint validates inputs with Zod schemas. Type-safe, pairs naturally with TypeScript.

### Rate Limiting

express-rate-limit middleware on all routes. Per-user limiting on authenticated routes.

## Database Schema

```prisma
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  favorites     Favorite[]
  searchHistory SearchHistory[]
}

model Favorite {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  admin1    String?
  country   String
  latitude  Float
  longitude Float
  createdAt DateTime @default(now())

  @@unique([userId, latitude, longitude])
  @@index([userId])
}

model SearchHistory {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  query     String
  latitude  Float
  longitude Float
  cityName  String
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
}

model WeatherCache {
  id        String   @id @default(uuid())
  latitude  Float
  longitude Float
  unit      String
  data      Json
  fetchedAt DateTime @default(now())

  @@unique([latitude, longitude, unit])
  @@index([fetchedAt])
}
```

Key decisions:
- WeatherCache is user-independent (shared cache).
- `@@unique([userId, latitude, longitude])` on Favorite replaces the frontend's coordinate-proximity check with a database constraint.
- `onDelete: Cascade` on relations ensures user deletion cleans up all associated data.
- SearchHistory indexed by `[userId, createdAt]` for efficient recent-searches queries.

## Frontend Changes

- Move existing code into `client/` directory.
- Redirect all `fetch()` calls from Open-Meteo/BigDataCloud to the Express backend.
- Add auth UI: login/register forms, logout button.
- Add search history view.
- Favorites and preferences now sync via the backend instead of localStorage (localStorage used as fallback for unauthenticated state if needed).

## Testing Strategy

### Unit Tests (Vitest)
- Zod validation schemas
- Utility functions (cache expiry logic, token generation, password hashing helpers)
- Frontend functions (weather code mapping, unit conversion)

### Integration Tests (Vitest + Supertest)
- Each API endpoint against a real test database
- Auth flow: register → login → access protected route → logout
- Weather endpoints: search, coords, cache hit vs cache miss
- Favorites CRUD: add, list, duplicate prevention, delete
- Search history: recorded on search, returned in order
- Error cases: 400 for invalid input, 401 for unauthorized, 404 for not found

### E2E Tests (Playwright)
- Full user journey: sign up → search → save favorite → toggle units → switch theme → view history
- Run against Docker Compose

### Not tested:
- Open-Meteo API behavior (not our code)
- CSS styling / pixel-level UI

## CI/CD

### GitHub Actions Pipeline

Triggered on push/PR to main:
1. Lint (ESLint) + type check (`tsc --noEmit`) — both client and server
2. Unit tests
3. Integration tests (Postgres container in CI)
4. E2E tests (Playwright against Docker Compose)
5. Build Docker images

PRs cannot merge unless all steps pass.

### Deployment

- Multi-stage Dockerfile for the Express server (build TS → slim production image)
- `docker-compose.yml` for local development (server + Postgres)
- Deploy to Railway (free tier) with auto-deploy on push to main
- Frontend served as static files by Express in production

### Environment Management

- `.env.example` committed with placeholder values
- Secrets stored in Railway's environment variables
- Zod validation on startup — fail fast if required env vars are missing

## API Documentation

swagger-jsdoc + swagger-ui-express serving interactive docs at `/api/docs`:
- Endpoints grouped by domain (Auth, Weather, Favorites)
- Request/response examples with types
- Auth flows documented
- "Try it out" button for live testing

## Tech Summary

| Layer | Tech |
|-------|------|
| Frontend | Vanilla TypeScript |
| Backend | Express + TypeScript |
| Database | PostgreSQL + Prisma |
| Validation | Zod |
| Auth | JWT + bcrypt |
| Testing | Vitest + Supertest + Playwright |
| CI/CD | GitHub Actions |
| Deployment | Docker + Railway |
| API Docs | Swagger (OpenAPI) |
| Monorepo | npm workspaces |

All tools are free for personal use.
