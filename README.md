# SkyCheck

A full-stack weather application with Express backend, PostgreSQL persistence, JWT authentication, and a vanilla TypeScript frontend. Uses the [Open-Meteo API](https://open-meteo.com/) for weather data.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Node](https://img.shields.io/badge/Node.js-20-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **User authentication** with JWT (access + refresh tokens)
- **City search** with geocoding (handles international cities)
- **Browser geolocation** for current location weather
- **5-day forecast** with high/low temperatures
- **Celsius / Fahrenheit** toggle with server-side conversion
- **Dark / Light theme** with smooth transitions
- **Favorite cities** — save up to 5 (persisted server-side)
- **Search history** with pagination
- **Server-side weather caching** (10-minute TTL)
- **Rate limiting** — global (100/15min) and weather (30/min per user)
- **API documentation** via Swagger UI (dev mode)
- **CI/CD** with GitHub Actions
- **Docker** deployment ready

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla TypeScript, ES modules |
| Backend | Express, TypeScript, Zod |
| Database | PostgreSQL 16, Prisma ORM |
| Auth | JWT (access + refresh), bcrypt |
| Testing | Vitest, Supertest, Playwright |
| CI/CD | GitHub Actions |
| Deployment | Docker, Docker Compose |

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for PostgreSQL)

### Setup

```bash
# Clone and install
git clone <repo-url>
cd weather-app
npm install

# Start PostgreSQL
docker compose up postgres -d

# Set up environment
cp .env.example .env
# Edit .env with your secrets

# Run database migrations
cd server && npx prisma migrate dev

# Build and start
cd server && npx tsc && node dist/index.js
```

The server starts on `http://localhost:3000` and serves the frontend in production mode.

### Development

```bash
# Start PostgreSQL
docker compose up postgres -d

# Run server (from server/)
cd server && npx tsc --watch  # in one terminal
node dist/index.js            # in another

# Client TypeScript (from client/)
cd client && npx tsc --watch
```

API docs available at `http://localhost:3000/api/docs` in development mode.

### Docker (Full Stack)

```bash
docker compose up --build
```

Starts PostgreSQL + server on port 3000.

## Project Structure

```
weather-app/
├── client/                  # Frontend (vanilla TypeScript)
│   ├── src/
│   │   ├── types.ts         # Shared interfaces
│   │   ├── api.ts           # Backend API calls
│   │   ├── auth.ts          # Token management & refresh
│   │   ├── storage.ts       # localStorage (theme, unit)
│   │   ├── ui.ts            # DOM manipulation
│   │   └── app.ts           # Entry point & state
│   ├── index.html
│   └── styles.css
├── server/                  # Backend (Express + TypeScript)
│   ├── prisma/schema.prisma # Database schema
│   └── src/
│       ├── routes/          # Auth, weather, favorites
│       ├── services/        # Business logic
│       ├── middleware/       # Auth, rate limit, errors
│       ├── schemas/         # Zod validation
│       ├── utils/           # JWT, password, temperature
│       └── app.ts           # Express app factory
├── e2e/                     # Playwright E2E tests
├── Dockerfile               # Multi-stage production build
├── docker-compose.yml       # Dev: Postgres + server
└── .github/workflows/ci.yml # CI pipeline
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/refresh` | Cookie | Refresh access token |
| POST | `/api/auth/logout` | Cookie | Logout |
| GET | `/api/auth/me` | Bearer | Get current user |
| GET | `/api/weather/search` | Bearer | Search by city |
| GET | `/api/weather/coords` | Bearer | Search by coordinates |
| GET | `/api/weather/history` | Bearer | Search history |
| GET | `/api/favorites` | Bearer | List favorites |
| POST | `/api/favorites` | Bearer | Add favorite |
| DELETE | `/api/favorites/:id` | Bearer | Remove favorite |
| GET | `/api/health` | No | Health check |

## Testing

```bash
# Unit tests
cd server && npx vitest run src/tests/unit/

# Integration tests (requires PostgreSQL)
cd server && npx vitest run src/tests/integration/

# All tests
cd server && npx vitest run

# E2E tests (requires Docker Compose stack running)
cd e2e && npx playwright test
```

## CI Pipeline

GitHub Actions runs on every push/PR to `main`:
1. **Lint & Typecheck** — `tsc --noEmit` for server and client
2. **Unit Tests** — Vitest (no database needed)
3. **Integration Tests** — Vitest with PostgreSQL service container
4. **Docker Build** — Validates production image builds

## External APIs

- [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) — city name to coordinates
- [Open-Meteo Forecast](https://open-meteo.com/en/docs) — weather data
- [BigDataCloud](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) — reverse geocoding

All APIs are free and require no authentication.
