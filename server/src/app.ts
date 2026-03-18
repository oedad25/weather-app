import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { errorHandler } from "./middleware/error-handler.js";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  // --- API routes will be mounted here in later tasks ---

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
