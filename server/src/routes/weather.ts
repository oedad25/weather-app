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
