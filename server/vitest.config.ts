import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      DATABASE_URL: "postgresql://skycheck:skycheck@localhost:5432/skycheck",
      JWT_SECRET: "test-secret-at-least-thirty-two-characters-long",
      JWT_REFRESH_SECRET: "test-refresh-secret-at-least-thirty-two-chars",
      NODE_ENV: "test",
      PORT: "3000",
    },
  },
});
