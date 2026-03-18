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
