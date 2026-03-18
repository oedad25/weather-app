import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/unit/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
      JWT_SECRET: "test-secret-at-least-thirty-two-characters-long",
      JWT_REFRESH_SECRET: "test-refresh-secret-at-least-thirty-two-chars",
      NODE_ENV: "test",
      PORT: "3000",
    },
  },
});
