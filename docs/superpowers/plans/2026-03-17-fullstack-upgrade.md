# SkyCheck Full-Stack Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the vanilla TypeScript weather app into a full-stack application with Express backend, PostgreSQL, auth, testing, CI/CD, and Docker deployment.

**Architecture:** Monorepo with `client/` (existing frontend) and `server/` (new Express + TypeScript backend). The frontend calls the backend, which proxies to Open-Meteo/BigDataCloud with caching and auth. PostgreSQL via Prisma for persistence.

**Tech Stack:** Express, TypeScript, Prisma, PostgreSQL, Zod, JWT, bcrypt, Vitest, Supertest, Playwright, Docker, GitHub Actions, Swagger

**Spec:** `docs/superpowers/specs/2026-03-17-fullstack-upgrade-design.md`

---

## File Structure

```
weather-app/
├── package.json                          ← root workspace
├── docker-compose.yml                    ← dev: server + postgres
├── Dockerfile                            ← production multi-stage build
├── .env.example                          ← placeholder env vars
├── .github/workflows/ci.yml             ← CI pipeline
├── client/                               ← existing frontend, moved
│   ├── package.json
│   ├── tsconfig.json
│   ├── index.html
│   ├── styles.css
│   └── src/
│       ├── types.ts
│       ├── api.ts                        ← MODIFIED: calls backend, not external APIs
│       ├── auth.ts                       ← NEW: token management + refresh logic
│       ├── storage.ts                    ← MODIFIED: remove favorites persistence
│       ├── ui.ts                         ← MODIFIED: add auth UI, history view
│       └── app.ts                        ← MODIFIED: integrate auth + history
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── index.ts                      ← entry point (starts server)
│       ├── app.ts                        ← Express app factory
│       ├── config.ts                     ← Zod env validation
│       ├── middleware/
│       │   ├── auth.ts                   ← JWT verification
│       │   ├── error-handler.ts          ← centralized error handling
│       │   └── rate-limit.ts             ← rate limiting config
│       ├── routes/
│       │   ├── auth.ts                   ← auth endpoints
│       │   ├── weather.ts                ← weather + history endpoints
│       │   └── favorites.ts              ← favorites CRUD
│       ├── services/
│       │   ├── auth.ts                   ← register, login, refresh, logout
│       │   ├── weather.ts                ← proxy + caching + history
│       │   └── favorites.ts              ← CRUD + limit enforcement
│       ├── schemas/
│       │   ├── auth.ts                   ← Zod schemas for auth inputs
│       │   ├── weather.ts                ← Zod schemas for weather inputs
│       │   └── favorites.ts              ← Zod schemas for favorites inputs
│       ├── lib/
│       │   └── prisma.ts                 ← singleton Prisma client
│       ├── utils/
│       │   ├── jwt.ts                    ← generate/verify tokens
│       │   ├── password.ts               ← bcrypt hash/compare
│       │   ├── errors.ts                 ← AppError class
│       │   └── temperature.ts            ← C↔F conversion
│       └── tests/
│           ├── setup.ts                  ← test DB setup/teardown
│           ├── helpers.ts                ← test factories (createUser, getAuthToken)
│           ├── unit/
│           │   ├── schemas.test.ts
│           │   ├── jwt.test.ts
│           │   ├── password.test.ts
│           │   └── temperature.test.ts
│           └── integration/
│               ├── auth.test.ts
│               ├── weather.test.ts
│               └── favorites.test.ts
├── e2e/
│   ├── package.json
│   ├── playwright.config.ts
│   └── tests/
│       └── user-journey.spec.ts
```

---

## Chunk 1: Project Foundation

### Task 1: Restructure into Monorepo

Move the existing frontend into `client/` and set up npm workspaces.

**Files:**
- Create: `package.json` (root workspace — replaces existing)
- Move: `index.html`, `styles.css`, `tsconfig.json`, `src/` → `client/`
- Create: `client/package.json`
- Modify: `client/tsconfig.json` (adjust outDir)
- Modify: `.gitignore` (add server dist, .env)

- [ ] **Step 1: Create root workspace package.json**

```json
{
  "name": "skycheck",
  "private": true,
  "workspaces": ["client", "server", "e2e"]
}
```

- [ ] **Step 2: Move frontend files into client/**

```bash
mkdir -p client/src
mv src/*.ts client/src/
mv index.html styles.css tsconfig.json client/
```

- [ ] **Step 3: Create client/package.json**

```json
{
  "name": "@skycheck/client",
  "private": true,
  "dependencies": {
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 4: Update client/tsconfig.json outDir**

Change `"outDir": "./dist"` — no change needed, paths are already relative.

Verify: `cd client && npx tsc && ls dist/app.js`

- [ ] **Step 5: Update client/index.html script path**

The `<script src="dist/app.js">` path remains correct since it's relative to `client/`.

- [ ] **Step 6: Update .gitignore**

```gitignore
node_modules/
dist/
.DS_Store
.env
*.env.local
```

- [ ] **Step 7: Verify frontend still builds**

```bash
cd client && npx tsc
```

Expected: compiles with no errors, `dist/` populated.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Restructure project into monorepo with client workspace"
```

---

### Task 2: Server Scaffold

Set up the Express + TypeScript server with a health endpoint.

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`
- Create: `server/src/app.ts`
- Create: `server/src/config.ts`
- Create: `server/src/utils/errors.ts`
- Create: `server/src/middleware/error-handler.ts`
- Create: `server/.env.example`

- [ ] **Step 1: Create server/package.json with dependencies**

```json
{
  "name": "@skycheck/server",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/client": "^6.4.0",
    "bcrypt": "^5.1.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.0",
    "jsonwebtoken": "^9.0.2",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.1",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cookie-parser": "^1.4.8",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.9",
    "@types/node": "^22.13.0",
    "@types/supertest": "^6.0.2",
    "@types/swagger-jsdoc": "^6.0.4",
    "@types/swagger-ui-express": "^4.1.8",
    "eslint": "^9.19.0",
    "prisma": "^6.4.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.9.3",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "sourceMap": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["src/tests/**/*"]
}
```

- [ ] **Step 3: Create server/src/config.ts — Zod env validation**

```typescript
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

export function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
```

- [ ] **Step 4: Create server/src/utils/errors.ts — AppError class**

```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

- [ ] **Step 5: Create server/src/middleware/error-handler.ts**

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import { ZodError } from "zod";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: err.errors.map((e) => e.message).join(", "),
      },
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
}
```

- [ ] **Step 6: Create server/src/app.ts — Express app factory**

```typescript
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { errorHandler } from "./middleware/error-handler.js";
import { config } from "./config.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  if (config.NODE_ENV === "development") {
    app.use(cors({ origin: /localhost/, credentials: true }));
  }

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // --- API routes are mounted here in later tasks ---
  // (see Tasks 9, 12, 13 — they add lines before the comment below)

  // Serve frontend in production (MUST be after all API routes)
  if (config.NODE_ENV === "production") {
    const clientPath = path.join(__dirname, "../../client");
    app.use(express.static(clientPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientPath, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
```

**Important:** When later tasks say "mount routes in app.ts," they must be added BEFORE the production static-file block, after the health check. The `app.get("*")` catch-all must always come last.

- [ ] **Step 7: Create server/src/index.ts — entry point**

```typescript
import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT} (${config.NODE_ENV})`);
});
```

- [ ] **Step 8: Create .env.example at project root**

```env
DATABASE_URL=postgresql://skycheck:skycheck@localhost:5432/skycheck
JWT_SECRET=change-me-to-a-random-string-at-least-32-chars
JWT_REFRESH_SECRET=change-me-to-another-random-string-32-chars
PORT=3000
NODE_ENV=development
```

- [ ] **Step 9: Install dependencies and verify server starts**

```bash
cd server && npm install
cp ../.env.example .env
npx tsx src/index.ts
```

Expected: `Server running on port 3000 (development)`

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "Add Express server scaffold with health endpoint and env config"
```

---

### Task 3: Prisma Schema & Database

**Files:**
- Create: `server/prisma/schema.prisma`
- Create: `docker-compose.yml` (root)

- [ ] **Step 1: Create docker-compose.yml for local Postgres**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: skycheck
      POSTGRES_PASSWORD: skycheck
      POSTGRES_DB: skycheck
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 2: Start Postgres**

```bash
docker compose up -d postgres
```

Expected: Postgres container running on port 5432.

- [ ] **Step 3: Create server/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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
  data      Json
  fetchedAt DateTime @default(now())

  @@unique([latitude, longitude])
  @@index([fetchedAt])
}
```

- [ ] **Step 4: Run initial migration**

```bash
cd server && npx prisma migrate dev --name init
```

Expected: Migration created, Prisma Client generated.

- [ ] **Step 5: Verify Prisma Client works**

```bash
cd server && npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.\$connect().then(() => { console.log('DB connected'); p.\$disconnect(); })"
```

Expected: `DB connected`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add Prisma schema and Docker Compose for local Postgres"
```

---

### Task 4: Test Infrastructure

**Files:**
- Create: `server/vitest.config.ts`
- Create: `server/src/tests/setup.ts`
- Create: `server/src/tests/helpers.ts`

- [ ] **Step 1: Create server/vitest.config.ts**

Note: We set test env vars here so `config.ts` Zod validation passes when modules are imported.

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://skycheck:skycheck@localhost:5432/skycheck_test",
      JWT_SECRET: "test-secret-at-least-thirty-two-characters-long",
      JWT_REFRESH_SECRET: "test-refresh-secret-at-least-thirty-two-chars",
      NODE_ENV: "test",
      PORT: "3000",
    },
  },
});
```

- [ ] **Step 2: Create server/src/lib/prisma.ts — singleton Prisma client**

All services and tests import Prisma from here to avoid exhausting the connection pool.

```typescript
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

- [ ] **Step 3: Create server/src/tests/setup.ts — test DB reset**

```typescript
import { prisma } from "../lib/prisma.js";
import { beforeEach, afterAll } from "vitest";

beforeEach(async () => {
  // Clear all tables before each test (order matters for FK constraints)
  await prisma.searchHistory.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.weatherCache.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

- [ ] **Step 4: Create server/src/tests/helpers.ts — test factories**

```typescript
import { prisma } from "../lib/prisma.js";
import bcrypt from "bcrypt";

export async function createTestUser(
  email = "test@example.com",
  password = "testpassword123",
) {
  const passwordHash = await bcrypt.hash(password, 4); // low rounds for speed
  return prisma.user.create({
    data: { email, passwordHash },
  });
}
```

- [ ] **Step 5: Verify test runner works**

Create a smoke test at `server/src/tests/unit/smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("smoke test", () => {
  it("passes", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `cd server && npx vitest run`

Expected: 1 test passes.

- [ ] **Step 6: Remove smoke test and commit**

```bash
rm server/src/tests/unit/smoke.test.ts
git add -A && git commit -m "Add Vitest test infrastructure with DB reset and Prisma singleton"
```

---

## Chunk 2: Auth System

### Task 5: Utility Functions (TDD)

**Files:**
- Create: `server/src/utils/password.ts`
- Create: `server/src/utils/jwt.ts`
- Create: `server/src/utils/temperature.ts`
- Create: `server/src/tests/unit/password.test.ts`
- Create: `server/src/tests/unit/jwt.test.ts`
- Create: `server/src/tests/unit/temperature.test.ts`

- [ ] **Step 1: Write password util tests**

```typescript
// server/src/tests/unit/password.test.ts
import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword } from "../../utils/password.js";

describe("password utils", () => {
  it("hashes a password and verifies it", async () => {
    const hash = await hashPassword("mypassword");
    expect(hash).not.toBe("mypassword");
    expect(await comparePassword("mypassword", hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("mypassword");
    expect(await comparePassword("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd server && npx vitest run src/tests/unit/password.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement password.ts**

```typescript
// server/src/utils/password.ts
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd server && npx vitest run src/tests/unit/password.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write JWT util tests**

```typescript
// server/src/tests/unit/jwt.test.ts
import { describe, it, expect } from "vitest";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";

describe("jwt utils", () => {
  const userId = "test-user-id";

  it("generates and verifies an access token", () => {
    const token = generateAccessToken(userId);
    const payload = verifyAccessToken(token);
    expect(payload.userId).toBe(userId);
  });

  it("generates and verifies a refresh token", () => {
    const token = generateRefreshToken(userId);
    const payload = verifyRefreshToken(token);
    expect(payload.userId).toBe(userId);
  });

  it("rejects an invalid token", () => {
    expect(() => verifyAccessToken("invalid")).toThrow();
  });
});
```

- [ ] **Step 6: Run test — verify it fails**

- [ ] **Step 7: Implement jwt.ts**

```typescript
// server/src/utils/jwt.ts
import jwt from "jsonwebtoken";
import { config } from "../config.js";

interface TokenPayload {
  userId: string;
}

export function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: "15m" });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, config.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as TokenPayload;
}
```

- [ ] **Step 8: Run test — verify it passes**

- [ ] **Step 9: Write temperature conversion tests**

```typescript
// server/src/tests/unit/temperature.test.ts
import { describe, it, expect } from "vitest";
import { celsiusToFahrenheit, convertWeatherData } from "../../utils/temperature.js";

describe("temperature utils", () => {
  it("converts Celsius to Fahrenheit", () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(celsiusToFahrenheit(-40)).toBe(-40);
  });
});
```

- [ ] **Step 10: Run test — verify it fails**

- [ ] **Step 11: Implement temperature.ts**

```typescript
// server/src/utils/temperature.ts
export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function convertWeatherData(data: any): any {
  return {
    ...data,
    current: {
      ...data.current,
      temperature: celsiusToFahrenheit(data.current.temperature),
      apparentTemperature: celsiusToFahrenheit(data.current.apparentTemperature),
      windSpeed: data.current.windSpeed * 0.621371, // km/h to mph
    },
    daily: data.daily.map((day: any) => ({
      ...day,
      maxTemp: celsiusToFahrenheit(day.maxTemp),
      minTemp: celsiusToFahrenheit(day.minTemp),
    })),
  };
}
```

- [ ] **Step 12: Run all unit tests — verify they pass**

```bash
cd server && npx vitest run src/tests/unit/
```

- [ ] **Step 13: Commit**

```bash
git add -A && git commit -m "Add password, JWT, and temperature utility functions with tests"
```

---

### Task 6: Zod Validation Schemas (TDD)

**Files:**
- Create: `server/src/schemas/auth.ts`
- Create: `server/src/schemas/weather.ts`
- Create: `server/src/schemas/favorites.ts`
- Create: `server/src/tests/unit/schemas.test.ts`

- [ ] **Step 1: Write schema tests**

```typescript
// server/src/tests/unit/schemas.test.ts
import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "../../schemas/auth.js";
import { searchSchema, coordsSchema, historySchema } from "../../schemas/weather.js";
import { addFavoriteSchema } from "../../schemas/favorites.js";

describe("auth schemas", () => {
  it("accepts valid registration", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "securepassword",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      email: "notanemail",
      password: "securepassword",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("weather schemas", () => {
  it("accepts valid city search", () => {
    const result = searchSchema.safeParse({ city: "Denver" });
    expect(result.success).toBe(true);
  });

  it("accepts valid coords", () => {
    const result = coordsSchema.safeParse({
      lat: "39.74",
      lon: "-104.99",
      unit: "fahrenheit",
    });
    expect(result.success).toBe(true);
  });

  it("defaults unit to celsius", () => {
    const result = coordsSchema.safeParse({ lat: "39.74", lon: "-104.99" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.unit).toBe("celsius");
  });
});

describe("favorites schemas", () => {
  it("accepts valid favorite", () => {
    const result = addFavoriteSchema.safeParse({
      name: "Denver",
      country: "United States",
      admin1: "Colorado",
      latitude: 39.74,
      longitude: -104.99,
    });
    expect(result.success).toBe(true);
  });

  it("allows optional admin1", () => {
    const result = addFavoriteSchema.safeParse({
      name: "Tokyo",
      country: "Japan",
      latitude: 35.68,
      longitude: 139.69,
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

- [ ] **Step 3: Implement schemas**

```typescript
// server/src/schemas/auth.ts
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = registerSchema;
```

```typescript
// server/src/schemas/weather.ts
import { z } from "zod";

export const searchSchema = z.object({
  city: z.string().min(1).max(100),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

export const coordsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

export const historySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

```typescript
// server/src/schemas/favorites.ts
import { z } from "zod";

export const addFavoriteSchema = z.object({
  name: z.string().min(1).max(200),
  admin1: z.string().max(200).optional(),
  country: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd server && npx vitest run src/tests/unit/schemas.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add Zod validation schemas for auth, weather, and favorites"
```

---

### Task 7: Auth Middleware

**Files:**
- Create: `server/src/middleware/auth.ts`
- Create: `server/src/middleware/rate-limit.ts`

- [ ] **Step 1: Create auth middleware**

```typescript
// server/src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { AppError } from "../utils/errors.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid token");
  }

  try {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired token");
  }
}
```

- [ ] **Step 2: Create rate limit middleware**

```typescript
// server/src/middleware/rate-limit.ts
import rateLimit from "express-rate-limit";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests" } },
});

export const weatherLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (req) => req.userId || req.ip || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many weather requests" } },
});
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add auth and rate limiting middleware"
```

---

### Task 8: Auth Service

**Files:**
- Create: `server/src/services/auth.ts`

- [ ] **Step 1: Implement auth service**

```typescript
// server/src/services/auth.ts
import { prisma } from "../lib/prisma.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { AppError } from "../utils/errors.js";

export async function register(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "CONFLICT", "Email already registered");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true },
  });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { user, accessToken, refreshToken };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken,
  };
}

export async function refresh(token: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired refresh token");
  }

  const payload = verifyRefreshToken(token);
  const accessToken = generateAccessToken(payload.userId);

  return { accessToken };
}

export async function logout(token: string) {
  await prisma.refreshToken.updateMany({
    where: { token },
    data: { revoked: true },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true },
  });
  if (!user) {
    throw new AppError(404, "NOT_FOUND", "User not found");
  }
  return user;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Add auth service with register, login, refresh, and logout"
```

---

### Task 9: Auth Routes

**Files:**
- Create: `server/src/routes/auth.ts`
- Modify: `server/src/app.ts` (mount routes)

- [ ] **Step 1: Create auth routes**

```typescript
// server/src/routes/auth.ts
import { Router, Request, Response, NextFunction } from "express";
import { registerSchema, loginSchema } from "../schemas/auth.js";
import * as authService from "../services/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = registerSchema.parse(req.body);
    const result = await authService.register(email, password);
    res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({ user: result.user, accessToken: result.accessToken });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "No refresh token" } });
      return;
    }
    const result = await authService.refresh(token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/logout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      await authService.logout(token);
    }
    res.clearCookie("refreshToken", { path: "/api/auth" });
    res.json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe(req.userId!);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Mount auth routes in app.ts**

Add to `server/src/app.ts` before the error handler:

```typescript
import authRoutes from "./routes/auth.js";
import { globalLimiter } from "./middleware/rate-limit.js";

// After cookieParser:
app.use(globalLimiter);

// Before error handler:
app.use("/api/auth", authRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add auth routes (register, login, refresh, logout, me)"
```

---

### Task 10: Auth Integration Tests

**Files:**
- Create: `server/src/tests/integration/auth.test.ts`

- [ ] **Step 1: Write auth integration tests**

```typescript
// server/src/tests/integration/auth.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";

const app = createApp();

describe("POST /api/auth/register", () => {
  it("creates a new user and returns access token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "new@example.com", password: "testpassword123" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("new@example.com");
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects duplicate email", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@example.com", password: "testpassword123" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@example.com", password: "testpassword123" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("rejects invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "notanemail", password: "testpassword123" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com", password: "short" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with valid credentials", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "login@example.com", password: "testpassword123" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "testpassword123" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it("rejects wrong password", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "wrong@example.com", password: "testpassword123" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "wrong@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns user profile with valid token", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: "me@example.com", password: "testpassword123" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${reg.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("me@example.com");
  });

  it("rejects missing token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("returns new access token using refresh cookie", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: "refresh@example.com", password: "testpassword123" });

    const cookies = reg.headers["set-cookie"];

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookies);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes refresh token and clears cookie", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: "logout@example.com", password: "testpassword123" });

    const cookies = reg.headers["set-cookie"];

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookies);

    expect(logoutRes.status).toBe(200);

    // Refresh should now fail
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookies);

    expect(refreshRes.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
cd server && npx vitest run src/tests/integration/auth.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add auth integration tests"
```

---

## Chunk 3: Weather & Favorites API

### Task 11: Weather Service

**Files:**
- Create: `server/src/services/weather.ts`

- [ ] **Step 1: Implement weather service**

```typescript
// server/src/services/weather.ts
import { prisma } from "../lib/prisma.js";
import { convertWeatherData } from "../utils/temperature.js";

const GEO_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_BASE = "https://api.open-meteo.com/v1/forecast";
const REVERSE_GEO_BASE = "https://api.bigdatacloud.net/data/reverse-geocode-client";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface GeoLocation {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

export async function searchByCity(city: string, unit: string) {
  // Geocode
  const geoUrl = `${GEO_BASE}?name=${encodeURIComponent(city)}&count=5&language=en`;
  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) throw new Error("Geocoding failed");
  const geoData = await geoRes.json();

  if (!geoData.results?.length) {
    return null; // No results
  }

  const location: GeoLocation = {
    name: geoData.results[0].name,
    latitude: geoData.results[0].latitude,
    longitude: geoData.results[0].longitude,
    country: geoData.results[0].country,
    admin1: geoData.results[0].admin1,
  };

  const weather = await fetchWeatherWithCache(location.latitude, location.longitude, unit);
  return { location, ...weather };
}

export async function searchByCoords(lat: number, lon: number, unit: string) {
  // Reverse geocode
  const revUrl = `${REVERSE_GEO_BASE}?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  let location: GeoLocation;

  try {
    const revRes = await fetch(revUrl);
    const revData = await revRes.json();
    location = {
      name: revData.city || revData.locality || "Your Location",
      latitude: lat,
      longitude: lon,
      country: revData.countryName || "",
      admin1: revData.principalSubdivision || undefined,
    };
  } catch {
    location = { name: "Your Location", latitude: lat, longitude: lon, country: "" };
  }

  const weather = await fetchWeatherWithCache(lat, lon, unit);
  return { location, ...weather };
}

async function fetchWeatherWithCache(lat: number, lon: number, unit: string) {
  // Check cache
  const cached = await prisma.weatherCache.findUnique({
    where: { latitude_longitude: { latitude: lat, longitude: lon } },
  });

  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    const data = cached.data as any;
    return unit === "fahrenheit" ? convertWeatherData(data) : data;
  }

  // Fetch fresh data (always in Celsius for canonical cache)
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    forecast_days: "5",
    timezone: "auto",
  });

  const res = await fetch(`${WEATHER_BASE}?${params}`);
  if (!res.ok) throw new Error("Weather fetch failed");
  const raw = await res.json();

  const weatherData = {
    current: {
      temperature: raw.current.temperature_2m,
      apparentTemperature: raw.current.apparent_temperature,
      humidity: raw.current.relative_humidity_2m,
      windSpeed: raw.current.wind_speed_10m,
      weatherCode: raw.current.weather_code,
      isDay: raw.current.is_day === 1,
    },
    daily: raw.daily.time.map((date: string, i: number) => ({
      date,
      maxTemp: raw.daily.temperature_2m_max[i],
      minTemp: raw.daily.temperature_2m_min[i],
      weatherCode: raw.daily.weather_code[i],
    })),
  };

  // Upsert cache
  await prisma.weatherCache.upsert({
    where: { latitude_longitude: { latitude: lat, longitude: lon } },
    update: { data: weatherData, fetchedAt: new Date() },
    create: { latitude: lat, longitude: lon, data: weatherData, fetchedAt: new Date() },
  });

  return unit === "fahrenheit" ? convertWeatherData(weatherData) : weatherData;
}

export async function recordSearch(
  userId: string,
  query: string,
  latitude: number,
  longitude: number,
  cityName: string,
) {
  await prisma.searchHistory.create({
    data: { userId, query, latitude, longitude, cityName },
  });
}

export async function getHistory(userId: string, page: number, limit: number) {
  const [items, total] = await Promise.all([
    prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.searchHistory.count({ where: { userId } }),
  ]);

  return { items, total, page, limit };
}

// Cleanup stale cache (call on startup or periodic timer)
export async function cleanupStaleCache() {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  await prisma.weatherCache.deleteMany({
    where: { fetchedAt: { lt: cutoff } },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Add weather service with caching and search history"
```

---

### Task 12: Weather Routes

**Files:**
- Create: `server/src/routes/weather.ts`
- Modify: `server/src/app.ts` (mount routes)

- [ ] **Step 1: Create weather routes**

```typescript
// server/src/routes/weather.ts
import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import { weatherLimiter } from "../middleware/rate-limit.js";
import { searchSchema, coordsSchema, historySchema } from "../schemas/weather.js";
import * as weatherService from "../services/weather.js";

const router = Router();

router.use(requireAuth);
router.use(weatherLimiter);

router.get("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { city, unit } = searchSchema.parse(req.query);
    const result = await weatherService.searchByCity(city, unit);

    if (!result) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "No results found" } });
      return;
    }

    await weatherService.recordSearch(
      req.userId!,
      city,
      result.location.latitude,
      result.location.longitude,
      result.location.name,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/coords", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lon, unit } = coordsSchema.parse(req.query);
    const result = await weatherService.searchByCoords(lat, lon, unit);

    await weatherService.recordSearch(
      req.userId!,
      "[geolocation]",
      lat,
      lon,
      result.location.name,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = historySchema.parse(req.query);
    const result = await weatherService.getHistory(req.userId!, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Mount in app.ts**

Add to `server/src/app.ts`:

```typescript
import weatherRoutes from "./routes/weather.js";

app.use("/api/weather", weatherRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add weather routes with search, coords, and history endpoints"
```

---

### Task 13: Favorites Service & Routes

**Files:**
- Create: `server/src/services/favorites.ts`
- Create: `server/src/routes/favorites.ts`
- Modify: `server/src/app.ts` (mount routes)

- [ ] **Step 1: Implement favorites service**

```typescript
// server/src/services/favorites.ts
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";

const MAX_FAVORITES = 5;

export async function list(userId: string) {
  return prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function add(
  userId: string,
  data: { name: string; admin1?: string; country: string; latitude: number; longitude: number },
) {
  const count = await prisma.favorite.count({ where: { userId } });
  if (count >= MAX_FAVORITES) {
    throw new AppError(400, "LIMIT_REACHED", "Maximum of 5 favorites reached");
  }

  try {
    return await prisma.favorite.create({
      data: { userId, ...data },
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      throw new AppError(409, "CONFLICT", "Location already in favorites");
    }
    throw err;
  }
}

export async function remove(userId: string, favoriteId: string) {
  const favorite = await prisma.favorite.findFirst({
    where: { id: favoriteId, userId },
  });
  if (!favorite) {
    throw new AppError(404, "NOT_FOUND", "Favorite not found");
  }

  await prisma.favorite.delete({ where: { id: favoriteId } });
}
```

- [ ] **Step 2: Create favorites routes**

```typescript
// server/src/routes/favorites.ts
import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import { addFavoriteSchema } from "../schemas/favorites.js";
import * as favoritesService from "../services/favorites.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const favorites = await favoritesService.list(req.userId!);
    res.json({ favorites });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = addFavoriteSchema.parse(req.body);
    const favorite = await favoritesService.add(req.userId!, data);
    res.status(201).json(favorite);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await favoritesService.remove(req.userId!, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 3: Mount in app.ts**

Add to `server/src/app.ts`:

```typescript
import favoritesRoutes from "./routes/favorites.js";

app.use("/api/favorites", favoritesRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add favorites service and routes with 5-favorite limit"
```

---

### Task 14: Weather & Favorites Integration Tests

**Files:**
- Create: `server/src/tests/integration/weather.test.ts`
- Create: `server/src/tests/integration/favorites.test.ts`

- [ ] **Step 1: Write favorites integration tests**

```typescript
// server/src/tests/integration/favorites.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";

const app = createApp();

async function registerAndGetToken(email = "fav@example.com") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "testpassword123" });
  return res.body.accessToken;
}

describe("Favorites API", () => {
  let token: string;

  beforeEach(async () => {
    token = await registerAndGetToken();
  });

  it("adds and lists favorites", async () => {
    await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Denver", country: "US", latitude: 39.74, longitude: -104.99 })
      .expect(201);

    const res = await request(app)
      .get("/api/favorites")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.favorites).toHaveLength(1);
    expect(res.body.favorites[0].name).toBe("Denver");
  });

  it("prevents duplicate locations", async () => {
    const fav = { name: "Denver", country: "US", latitude: 39.74, longitude: -104.99 };
    await request(app).post("/api/favorites").set("Authorization", `Bearer ${token}`).send(fav);
    const res = await request(app).post("/api/favorites").set("Authorization", `Bearer ${token}`).send(fav);

    expect(res.status).toBe(409);
  });

  it("enforces 5-favorite limit", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/favorites")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: `City${i}`, country: "US", latitude: i, longitude: i });
    }

    const res = await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "City5", country: "US", latitude: 5, longitude: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("LIMIT_REACHED");
  });

  it("deletes a favorite", async () => {
    const addRes = await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Denver", country: "US", latitude: 39.74, longitude: -104.99 });

    await request(app)
      .delete(`/api/favorites/${addRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const listRes = await request(app)
      .get("/api/favorites")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.body.favorites).toHaveLength(0);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/favorites");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Write weather integration tests (search history portion)**

```typescript
// server/src/tests/integration/weather.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";

const app = createApp();

async function registerAndGetToken(email = "weather@example.com") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "testpassword123" });
  return res.body.accessToken;
}

describe("Weather API", () => {
  let token: string;

  beforeEach(async () => {
    token = await registerAndGetToken();
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/weather/search?city=Denver");
    expect(res.status).toBe(401);
  });

  it("validates search query parameter", async () => {
    const res = await request(app)
      .get("/api/weather/search")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("validates coords parameters", async () => {
    const res = await request(app)
      .get("/api/weather/coords?lat=999&lon=0")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns paginated search history", async () => {
    const res = await request(app)
      .get("/api/weather/history")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.total).toBeDefined();
    expect(res.body.page).toBe(1);
  });
});
```

Note: We test input validation and auth locally. The actual weather search tests that hit Open-Meteo are not included because they depend on an external API — those are covered by E2E tests.

- [ ] **Step 3: Run all tests**

```bash
cd server && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add integration tests for favorites and weather endpoints"
```

---

## Chunk 4: Frontend Migration

### Task 15: Client Auth Module

**Files:**
- Create: `client/src/auth.ts`

- [ ] **Step 1: Create auth token management**

```typescript
// client/src/auth.ts
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let res = await fetch(url, { ...options, headers, credentials: "include" });

  // If 401, try refreshing the token
  if (res.status === 401 && accessToken) {
    const refreshRes = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      accessToken = data.accessToken;
      headers.set("Authorization", `Bearer ${accessToken}`);
      res = await fetch(url, { ...options, headers, credentials: "include" });
    } else {
      accessToken = null;
    }
  }

  return res;
}

export async function register(email: string, password: string) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Registration failed");
  accessToken = data.accessToken;
  return data.user;
}

export async function login(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Login failed");
  accessToken = data.accessToken;
  return data.user;
}

export async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  accessToken = null;
}

export async function checkAuth() {
  const refreshRes = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  if (refreshRes.ok) {
    const data = await refreshRes.json();
    accessToken = data.accessToken;
    return true;
  }
  return false;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Add client auth module with token refresh logic"
```

---

### Task 16: Update Client API Layer

**Files:**
- Modify: `client/src/api.ts` — redirect calls to backend

- [ ] **Step 1: Rewrite api.ts to call backend**

Replace the contents of `client/src/api.ts`. Instead of calling Open-Meteo directly, it now calls the Express backend via `fetchWithAuth`:

```typescript
// client/src/api.ts
import { GeoLocation, WeatherData, TemperatureUnit } from "./types.js";
import { fetchWithAuth } from "./auth.js";

export async function searchWeather(
  city: string,
  unit: TemperatureUnit,
): Promise<{ location: GeoLocation; current: any; daily: any[] } | null> {
  const params = new URLSearchParams({ city, unit });
  const res = await fetchWithAuth(`/api/weather/search?${params}`);

  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Search failed");
  }
  return res.json();
}

export async function searchByCoords(
  lat: number,
  lon: number,
  unit: TemperatureUnit,
): Promise<{ location: GeoLocation; current: any; daily: any[] }> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    unit,
  });
  const res = await fetchWithAuth(`/api/weather/coords?${params}`);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Location search failed");
  }
  return res.json();
}

export async function getHistory(page = 1, limit = 20) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  const res = await fetchWithAuth(`/api/weather/history?${params}`);
  if (!res.ok) throw new Error("Failed to load history");
  return res.json();
}

export async function getFavorites(): Promise<any[]> {
  const res = await fetchWithAuth("/api/favorites");
  if (!res.ok) throw new Error("Failed to load favorites");
  const data = await res.json();
  return data.favorites;
}

export async function addFavorite(location: GeoLocation) {
  const res = await fetchWithAuth("/api/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: location.name,
      admin1: location.admin1,
      country: location.country,
      latitude: location.latitude,
      longitude: location.longitude,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to add favorite");
  }
  return res.json();
}

export async function removeFavorite(id: string) {
  const res = await fetchWithAuth(`/api/favorites/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove favorite");
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Redirect client API calls to Express backend"
```

---

### Task 17: Update Client HTML & Styles for Auth + History

**Files:**
- Modify: `client/index.html`
- Modify: `client/styles.css`

- [ ] **Step 1: Update index.html — add auth and history sections**

Add a logout button to the header title-row, an auth container before the app content, and a history container. Key additions:

```html
<!-- In .title-row, after theme toggle button: -->
<button class="btn btn-icon hidden" id="history-button" title="Search history">📋</button>
<button class="btn btn-secondary hidden" id="logout-button" data-testid="logout-button">Logout</button>
<span class="user-email hidden" id="user-email"></span>

<!-- New auth container, before #favorites-container: -->
<div id="auth-container" class="auth-container">
  <div class="auth-card">
    <h2 class="auth-title">Welcome to Sky<span>Check</span></h2>
    <form id="auth-form" class="auth-form">
      <input type="email" id="auth-email" data-testid="email-input" placeholder="Email" required autocomplete="email">
      <input type="password" id="auth-password" data-testid="password-input" placeholder="Password (min 8 chars)" required minlength="8">
      <div class="auth-buttons">
        <button type="submit" class="btn btn-primary" id="login-button" data-testid="login-button">Log In</button>
        <button type="button" class="btn btn-secondary" id="register-button" data-testid="register-button">Register</button>
      </div>
      <p id="auth-error" class="auth-error hidden"></p>
    </form>
  </div>
</div>

<!-- New history container, after #weather-container: -->
<div id="history-container" class="hidden">
  <div class="history-card">
    <div class="history-header">
      <h3 class="forecast-title">Search History</h3>
      <button class="btn btn-icon" id="history-close">&times;</button>
    </div>
    <div id="history-list"></div>
  </div>
</div>
```

- [ ] **Step 2: Add auth and history CSS to styles.css**

```css
/* --- Auth --- */
.auth-container { display: flex; justify-content: center; padding: 2rem 0; }
.auth-card {
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  padding: 2.5rem 2rem;
  box-shadow: 0 8px 24px var(--color-shadow-lg);
  width: 100%;
  max-width: 400px;
  transition: background 0.3s;
}
.auth-title {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 1.5rem;
  color: var(--color-text);
}
.auth-title span { color: var(--color-accent); }
.auth-form { display: flex; flex-direction: column; gap: 0.75rem; }
.auth-form input {
  padding: 0.85rem 1rem;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: 0.95rem;
  background: var(--color-bg);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.auth-form input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}
.auth-buttons { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.auth-buttons .btn { flex: 1; }
.auth-error { color: #ef4444; font-size: 0.85rem; text-align: center; margin-top: 0.5rem; }
.user-email {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- History --- */
.history-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: 0 2px 8px var(--color-shadow);
  margin-top: 1rem;
  transition: background 0.3s;
}
.history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.88rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color 0.2s;
}
.history-item:hover { color: var(--color-accent); }
.history-item:last-child { border-bottom: none; }
.history-time { font-size: 0.75rem; color: var(--color-text-muted); }
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add auth and history HTML/CSS to client"
```

---

### Task 18: Update Client Storage, UI, and App Logic

**Files:**
- Modify: `client/src/storage.ts`
- Modify: `client/src/ui.ts`
- Modify: `client/src/app.ts`

- [ ] **Step 1: Slim down storage.ts — remove favorites functions**

Remove `getFavorites`, `addFavorite`, `removeFavorite`, `isFavorite`, `MAX_FAVORITES`, and the `FAVORITES` key. Keep only theme and unit persistence:

```typescript
// client/src/storage.ts — only theme and unit persistence remain
import { TemperatureUnit } from "./types.js";

const KEYS = {
  THEME: "skycheck_theme",
  UNIT: "skycheck_unit",
} as const;

export type Theme = "light" | "dark";

export function getSavedTheme(): Theme {
  const saved = localStorage.getItem(KEYS.THEME);
  return saved === "dark" ? "dark" : "light";
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(KEYS.THEME, theme);
}

export function getSavedUnit(): TemperatureUnit {
  const saved = localStorage.getItem(KEYS.UNIT);
  return saved === "celsius" ? "celsius" : "fahrenheit";
}

export function saveUnit(unit: TemperatureUnit): void {
  localStorage.setItem(KEYS.UNIT, unit);
}
```

- [ ] **Step 2: Add auth and history UI functions to ui.ts**

Add these exports to `client/src/ui.ts`:

```typescript
// --- Auth UI ---
const authContainer = document.getElementById("auth-container") as HTMLElement;
const authForm = document.getElementById("auth-form") as HTMLFormElement;
const authEmail = document.getElementById("auth-email") as HTMLInputElement;
const authPassword = document.getElementById("auth-password") as HTMLInputElement;
const authError = document.getElementById("auth-error") as HTMLElement;
const loginButton = document.getElementById("login-button") as HTMLButtonElement;
const registerButton = document.getElementById("register-button") as HTMLButtonElement;
const logoutButton = document.getElementById("logout-button") as HTMLButtonElement;
const userEmailSpan = document.getElementById("user-email") as HTMLElement;
const historyButton = document.getElementById("history-button") as HTMLButtonElement;
const historyContainer = document.getElementById("history-container") as HTMLElement;
const historyList = document.getElementById("history-list") as HTMLElement;
const historyClose = document.getElementById("history-close") as HTMLButtonElement;

export function showAuthView(): void {
  authContainer.classList.remove("hidden");
  logoutButton.classList.add("hidden");
  userEmailSpan.classList.add("hidden");
  historyButton.classList.add("hidden");
  // Hide app content
  weatherContainer.classList.add("hidden");
  welcomeContainer.classList.add("hidden");
  favoritesContainer.classList.add("hidden");
  searchInput.parentElement!.classList.add("hidden");
}

export function showAppView(email: string): void {
  authContainer.classList.add("hidden");
  logoutButton.classList.remove("hidden");
  userEmailSpan.classList.remove("hidden");
  historyButton.classList.remove("hidden");
  userEmailSpan.textContent = email;
  searchInput.parentElement!.classList.remove("hidden");
  welcomeContainer.classList.remove("hidden");
}

export function showAuthError(message: string): void {
  authError.textContent = message;
  authError.classList.remove("hidden");
}

export function clearAuthError(): void {
  authError.classList.add("hidden");
}

export function getAuthInputs(): { email: string; password: string } {
  return { email: authEmail.value.trim(), password: authPassword.value };
}

export function onLogin(callback: (email: string, password: string) => void): void {
  authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const { email, password } = getAuthInputs();
    if (email && password) callback(email, password);
  });
}

export function onRegister(callback: (email: string, password: string) => void): void {
  registerButton.addEventListener("click", () => {
    const { email, password } = getAuthInputs();
    if (email && password) callback(email, password);
  });
}

export function onLogout(callback: () => void): void {
  logoutButton.addEventListener("click", callback);
}

export function onHistoryToggle(callback: () => void): void {
  historyButton.addEventListener("click", callback);
  historyClose.addEventListener("click", () => {
    historyContainer.classList.add("hidden");
  });
}

export function renderHistory(items: Array<{ query: string; cityName: string; createdAt: string }>): void {
  historyContainer.classList.remove("hidden");
  if (items.length === 0) {
    historyList.innerHTML = '<p style="color: var(--color-text-muted); text-align: center;">No searches yet</p>';
    return;
  }
  historyList.innerHTML = items.map((item) => {
    const time = new Date(item.createdAt).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    return `<div class="history-item" data-query="${item.query}">
      <span>${item.cityName} (${item.query})</span>
      <span class="history-time">${time}</span>
    </div>`;
  }).join("");
}
```

- [ ] **Step 3: Rewrite app.ts with auth integration**

Replace `client/src/app.ts` with a version that:
1. Calls `checkAuth()` on load — shows auth view or app view
2. Handles login/register via `auth.ts` module
3. Fetches favorites from API instead of localStorage
4. Records search history and shows it on demand

Key structure:

```typescript
import * as auth from "./auth.js";
import * as api from "./api.js";
import * as ui from "./ui.js";
import { getSavedTheme, saveTheme, getSavedUnit, saveUnit, Theme } from "./storage.js";
import { TemperatureUnit, GeoLocation, WeatherData } from "./types.js";

let currentUnit: TemperatureUnit = getSavedUnit();
let currentTheme: Theme = getSavedTheme();
let lastLocation: GeoLocation | null = null;
let lastWeatherData: WeatherData | null = null;
let favorites: any[] = [];

async function init() {
  ui.applyTheme(currentTheme);
  ui.updateUnitToggle(currentUnit);

  const isLoggedIn = await auth.checkAuth();
  if (isLoggedIn) {
    // Fetch user profile to get email
    const res = await auth.fetchWithAuth("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      showLoggedInApp(data.user.email);
    } else {
      ui.showAuthView();
    }
  } else {
    ui.showAuthView();
  }

  // Wire auth events
  ui.onLogin(handleLogin);
  ui.onRegister(handleRegister);
  ui.onLogout(handleLogout);

  // Wire app events
  ui.onSearch(handleSearch);
  ui.onUnitToggle(handleUnitToggle);
  ui.onGeolocate(handleGeolocate);
  ui.onThemeToggle(handleThemeToggle);
  ui.onHistoryToggle(handleHistoryToggle);
}

async function showLoggedInApp(email: string) {
  ui.showAppView(email);
  favorites = await api.getFavorites();
  refreshFavoritesUI();
}

async function handleLogin(email: string, password: string) {
  ui.clearAuthError();
  try {
    const user = await auth.login(email, password);
    showLoggedInApp(user.email);
  } catch (err: any) {
    ui.showAuthError(err.message);
  }
}

async function handleRegister(email: string, password: string) {
  ui.clearAuthError();
  try {
    const user = await auth.register(email, password);
    showLoggedInApp(user.email);
  } catch (err: any) {
    ui.showAuthError(err.message);
  }
}

async function handleLogout() {
  await auth.logout();
  lastLocation = null;
  lastWeatherData = null;
  favorites = [];
  ui.showAuthView();
}

async function handleSearch(query: string) {
  ui.showLoading();
  try {
    const result = await api.searchWeather(query, currentUnit);
    if (!result) {
      ui.showError(`No results found for "${query}".`);
      return;
    }
    lastLocation = result.location;
    lastWeatherData = result as any;
    renderWeatherWithFavorite(result as any);
    // Refresh favorites in case UI needs update
    favorites = await api.getFavorites();
    refreshFavoritesUI();
  } catch (err: any) {
    ui.showError(err.message);
  }
}

async function handleHistoryToggle() {
  try {
    const data = await api.getHistory();
    ui.renderHistory(data.items);
  } catch {
    ui.showError("Failed to load history.");
  }
}

// ... (handleUnitToggle, handleGeolocate, handleThemeToggle,
//      refreshFavoritesUI, renderWeatherWithFavorite follow the
//      same pattern as the original app.ts but use api.* functions
//      instead of localStorage for favorites)

init();
```

The full implementation follows the same patterns as the original `app.ts` — the key change is replacing `storage.getFavorites()`/`addFavorite()`/`removeFavorite()` with the async `api.*` equivalents, and adding the auth gating at the top.

- [ ] **Step 4: Verify the full flow manually**

Start Postgres, server, and open client:
```bash
docker compose up -d postgres
cd server && cp ../.env.example .env && npx tsx src/index.ts &
cd client && python3 -m http.server 8080
```

Test: register → search → add favorite → view history → toggle theme → logout → login.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Integrate auth, server-side favorites, and search history into frontend"
```

---

## Chunk 5: DevOps & Polish

### Task 19: Dockerfile

**Files:**
- Create: `Dockerfile` (root)
- Create: `.dockerignore`

- [ ] **Step 1: Create .dockerignore**

```
node_modules
dist
.git
.env
*.md
e2e
```

- [ ] **Step 2: Create multi-stage Dockerfile**

```dockerfile
# Stage 1: Install deps + build
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY server/ server/
COPY client/ client/
RUN cd server && npx prisma generate && npx tsc
RUN cd client && npx tsc

# Stage 2: Production (slim)
FROM node:20-alpine
WORKDIR /app
# Copy root workspace structure
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/server/prisma ./server/prisma
# Copy client (built HTML/CSS/JS served as static files)
COPY --from=build /app/client/index.html ./client/
COPY --from=build /app/client/styles.css ./client/
COPY --from=build /app/client/dist ./client/dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "cd server && npx prisma migrate deploy && node dist/index.js"]
```

Note: `npm ci` at the root installs all workspace deps into the root `node_modules/` (npm hoisting). The production image copies this root `node_modules/`.

- [ ] **Step 3: Update docker-compose.yml for full dev stack**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: skycheck
      POSTGRES_PASSWORD: skycheck
      POSTGRES_DB: skycheck
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U skycheck"]
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://skycheck:skycheck@postgres:5432/skycheck
      JWT_SECRET: dev-secret-change-in-production-min-32-chars
      JWT_REFRESH_SECRET: dev-refresh-secret-change-in-prod-32-chars
      NODE_ENV: production
      PORT: 3000
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
```

- [ ] **Step 4: Build and test Docker image**

```bash
docker compose up --build
```

Expected: Server starts on port 3000, serves frontend at `/`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add Dockerfile and Docker Compose for production deployment"
```

---

### Task 20: GitHub Actions CI Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: cd server && npx tsc --noEmit
      - run: cd client && npx tsc --noEmit

  unit-tests:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: cd server && npx prisma generate
      - run: cd server && npx vitest run src/tests/unit/
    env:
      DATABASE_URL: postgresql://unused:unused@localhost:5432/unused
      JWT_SECRET: test-secret-at-least-thirty-two-characters
      JWT_REFRESH_SECRET: test-refresh-secret-at-least-thirty-two-chars
      NODE_ENV: test

  integration-tests:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: skycheck
          POSTGRES_PASSWORD: skycheck
          POSTGRES_DB: skycheck_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://skycheck:skycheck@localhost:5432/skycheck_test
      JWT_SECRET: test-secret-at-least-thirty-two-characters
      JWT_REFRESH_SECRET: test-refresh-secret-at-least-thirty-two-chars
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: cd server && npx prisma generate && npx prisma migrate deploy
      - run: cd server && npx vitest run src/tests/integration/

  docker-build:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t skycheck .
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Add GitHub Actions CI pipeline with lint, test, and Docker build"
```

---

### Task 21: Swagger API Documentation

**Files:**
- Create: `server/src/swagger.ts`
- Modify: `server/src/app.ts` (mount swagger)

- [ ] **Step 1: Create swagger config**

```typescript
// server/src/swagger.ts
import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SkyCheck API",
      version: "1.0.0",
      description: "Weather app API with auth, favorites, and search history",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
```

- [ ] **Step 2: Add JSDoc annotations to route files**

Add `@openapi` comments above each route handler. Example for auth routes (`server/src/routes/auth.ts`):

```typescript
/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201: { description: User created, returns user + accessToken }
 *       400: { description: Validation error }
 *       409: { description: Email already registered }
 */
router.post("/register", async (req, res, next) => { ... });

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Returns user + accessToken, sets refresh cookie }
 *       401: { description: Invalid credentials }
 */
router.post("/login", async (req, res, next) => { ... });
```

Apply the same pattern to all routes in `weather.ts` and `favorites.ts`. Each route gets `tags`, `summary`, `parameters` or `requestBody`, `security: [bearerAuth: []]` for protected routes, and `responses`.

- [ ] **Step 3: Mount Swagger UI in app.ts (dev only)**

```typescript
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger.js";

if (config.NODE_ENV === "development") {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
```

- [ ] **Step 4: Verify docs at http://localhost:3000/api/docs**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add Swagger API documentation"
```

---

### Task 22: E2E Tests

**Files:**
- Create: `e2e/package.json`
- Create: `e2e/playwright.config.ts`
- Create: `e2e/tests/user-journey.spec.ts`

- [ ] **Step 1: Create e2e/package.json**

```json
{
  "name": "@skycheck/e2e",
  "private": true,
  "devDependencies": {
    "@playwright/test": "^1.50.0"
  },
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui"
  }
}
```

- [ ] **Step 2: Install Playwright and browsers**

```bash
cd e2e && npm install && npx playwright install chromium
```

- [ ] **Step 3: Create playwright.config.ts**

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "docker compose up --build",
    url: "http://localhost:3000/api/health",
    timeout: 120000,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 4: Write E2E user journey test**

```typescript
// e2e/tests/user-journey.spec.ts
import { test, expect } from "@playwright/test";

test.describe("SkyCheck user journey", () => {
  const email = `test-${Date.now()}@example.com`;
  const password = "testpassword123";

  test("full flow: register → search → favorite → history → logout → login", async ({ page }) => {
    await page.goto("/");

    // Register
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="register-button"]');
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();

    // Search for a city
    await page.fill("#search-input", "Denver");
    await page.click("#search-button");
    await expect(page.locator(".current-weather")).toBeVisible({ timeout: 10000 });

    // Save to favorites
    await page.click("#fav-toggle");
    await expect(page.locator(".favorite-chip")).toBeVisible();

    // Toggle units
    await page.click("#unit-toggle");

    // Toggle theme
    await page.click("#theme-toggle");
    const theme = await page.locator("html").getAttribute("data-theme");
    expect(theme).toBe("dark");

    // Logout
    await page.click('[data-testid="logout-button"]');
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();

    // Login
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();

    // Favorites should persist
    await expect(page.locator(".favorite-chip")).toBeVisible();
  });
});
```

- [ ] **Step 5: Run E2E tests**

```bash
cd e2e && npx playwright test
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add Playwright E2E tests for full user journey"
```

---

### Task 23: Deploy to Railway

- [ ] **Step 1: Create Railway project**

```bash
# Install Railway CLI if needed
npm install -g @railway/cli

# Login and initialize
railway login
railway init
```

- [ ] **Step 2: Add PostgreSQL plugin in Railway dashboard**

In the Railway dashboard, add a PostgreSQL database to the project. Copy the `DATABASE_URL` — Railway sets this automatically.

- [ ] **Step 3: Set environment variables in Railway**

```bash
railway variables set JWT_SECRET="$(openssl rand -base64 48)"
railway variables set JWT_REFRESH_SECRET="$(openssl rand -base64 48)"
railway variables set NODE_ENV=production
railway variables set PORT=3000
```

- [ ] **Step 4: Deploy**

```bash
railway up
```

- [ ] **Step 5: Verify the deployed app**

Visit the Railway-provided URL. Test: register, search, favorites, theme toggle.

- [ ] **Step 6: Commit any Railway config files**

```bash
git add -A && git commit -m "Add Railway deployment configuration"
```

---

### Task 24: Final Cleanup

- [ ] **Step 1: Update README.md with new setup instructions**

Update to reflect monorepo structure, Docker Compose for local dev, backend setup, and deployment.

- [ ] **Step 2: Update CLAUDE.md with new architecture**

Reflect the full-stack architecture, new commands, and test instructions.

- [ ] **Step 3: Run full test suite one final time**

```bash
cd server && npx vitest run
cd e2e && npx playwright test
```

- [ ] **Step 4: Final commit and push**

```bash
git add -A && git commit -m "Update documentation for full-stack architecture"
git push
```
