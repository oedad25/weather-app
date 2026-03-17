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
  POST   /api/auth/login         ← returns JWT access token + sets refresh cookie
  POST   /api/auth/refresh       ← exchange refresh cookie for new access token
  POST   /api/auth/logout        ← revokes refresh token, clears cookie
  GET    /api/auth/me            ← get current user profile

Weather (all require auth):
  GET    /api/weather/search?city=Denver    ← geocode + fetch weather (picks first match)
  GET    /api/weather/coords?lat=X&lon=Y   ← weather by coordinates
  GET    /api/weather/history?page=1&limit=20  ← user's search history (default: page 1, 20 per page, newest first)

Favorites (all require auth, max 5 per user):
  GET    /api/favorites           ← list user's favorites
  POST   /api/favorites           ← add a favorite
  DELETE /api/favorites/:id       ← remove a favorite
```

**Request/response examples:**

```jsonc
// POST /api/auth/register
// Request:
{ "email": "user@example.com", "password": "securepassword" }
// Response 201:
{ "user": { "id": "...", "email": "user@example.com" }, "accessToken": "eyJ..." }

// POST /api/auth/login
// Response 200: same as register

// POST /api/favorites
// Request:
{ "name": "Denver", "country": "United States", "admin1": "Colorado", "latitude": 39.74, "longitude": -104.99 }
// Response 201:
{ "id": "...", "name": "Denver", ... }
```

**Error response format (all endpoints):**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid email format" } }
```
Status codes: 400 (validation), 401 (unauthorized), 404 (not found), 409 (conflict, e.g. duplicate email), 429 (rate limited).

### Auth

- Passwords hashed with bcrypt (12 salt rounds)
- Access token (JWT, 15-minute expiry) held in memory on the client
- Refresh token (JWT, 7-day expiry) in HTTP-only secure cookie
- Refresh tokens tracked in a `RefreshToken` database table so they can be revoked on logout
- Middleware extracts and verifies access token on protected routes
- Client calls `POST /api/auth/refresh` when the access token expires

### Server-Side Weather Caching

Weather responses cached in the database for 15 minutes per location. Shared across all users — if two users search "Denver" within that window, only one external API call is made.

### Input Validation

Every endpoint validates inputs with Zod schemas. Type-safe, pairs naturally with TypeScript.

### Rate Limiting

express-rate-limit middleware:
- Global: 100 requests per 15-minute window per IP
- Weather endpoints: 30 requests per minute per authenticated user

### CORS

In production, Express serves the frontend as static files (same origin), so CORS is not needed. In development, the client may run on a different port — configure CORS middleware to allow `http://localhost:*` in development only.

## Database Schema

```prisma
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  favorites      Favorite[]
  searchHistory  SearchHistory[]
  refreshTokens  RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([token])
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
  data      Json                  // stored in Celsius (canonical unit)
  fetchedAt DateTime @default(now())

  @@unique([latitude, longitude])
  @@index([fetchedAt])
}
```

Key decisions:
- WeatherCache is user-independent (shared cache). Always stored in Celsius; the server converts to Fahrenheit at response time if requested. This avoids duplicate cache entries per unit.
- Cache eviction: a query filter (`WHERE fetchedAt > NOW() - INTERVAL '15 minutes'`) ignores stale entries. A scheduled cleanup (e.g., Prisma `deleteMany` on app startup or a periodic timer) purges old rows.
- `@@unique([userId, latitude, longitude])` on Favorite replaces the frontend's coordinate-proximity check with a database constraint. Max 5 favorites per user enforced in the API layer.
- `onDelete: Cascade` on relations ensures user deletion cleans up all associated data.
- SearchHistory indexed by `[userId, createdAt]` for efficient recent-searches queries. For geolocation searches (no text query), `query` is stored as `"[geolocation]"`.
- RefreshToken table enables server-side revocation on logout.

## Frontend Changes

- Move existing code into `client/` directory.
- Redirect all `fetch()` calls from Open-Meteo/BigDataCloud to the Express backend.
- Add auth UI: login/register forms, logout button.
- Add search history view.
- Favorites sync via the backend instead of localStorage.
- Theme and unit preferences remain in localStorage (client-side only) — they're UI preferences, not worth a round-trip to the server.

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
- Database migrations: `prisma migrate deploy` runs as a Railway release command before the app starts. Locally, use `prisma migrate dev`.

### Environment Management

Required environment variables:
- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — signing key for access tokens
- `JWT_REFRESH_SECRET` — signing key for refresh tokens
- `PORT` — server port (default: 3000)
- `NODE_ENV` — `development` or `production`

`.env.example` committed with placeholder values. Secrets stored in Railway's environment variables. Zod validation on startup — fail fast if required env vars are missing.

## API Documentation

swagger-jsdoc + swagger-ui-express serving interactive docs at `/api/docs` (development only — disabled in production):
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
