import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { weatherLimiter } from "../middleware/rate-limit.js";
import { searchSchema, coordsSchema, historySchema } from "../schemas/weather.js";
import * as weatherService from "../services/weather.js";

const router = Router();

router.use(optionalAuth);
router.use(weatherLimiter);

/**
 * @openapi
 * /api/weather/search:
 *   get:
 *     summary: Search weather by city name
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: city
 *         required: true
 *         schema:
 *           type: string
 *         description: City name to search
 *       - in: query
 *         name: unit
 *         schema:
 *           type: string
 *           enum: [fahrenheit, celsius]
 *           default: fahrenheit
 *         description: Temperature unit
 *     responses:
 *       200:
 *         description: Weather data for the city
 *       404:
 *         description: City not found
 */
router.get("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { city, unit } = searchSchema.parse(req.query);
    const result = await weatherService.searchByCity(city, unit);

    if (!result) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "No results found" } });
      return;
    }

    if (req.userId) {
      await weatherService.recordSearch(
        req.userId,
        city,
        result.location.latitude,
        result.location.longitude,
        result.location.name,
      );
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/weather/coords:
 *   get:
 *     summary: Search weather by coordinates
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         description: Latitude
 *       - in: query
 *         name: lon
 *         required: true
 *         schema:
 *           type: number
 *         description: Longitude
 *       - in: query
 *         name: unit
 *         schema:
 *           type: string
 *           enum: [fahrenheit, celsius]
 *           default: fahrenheit
 *         description: Temperature unit
 *     responses:
 *       200:
 *         description: Weather data for the coordinates
 */
router.get("/coords", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lon, unit } = coordsSchema.parse(req.query);
    const result = await weatherService.searchByCoords(lat, lon, unit);

    if (req.userId) {
      await weatherService.recordSearch(
        req.userId,
        "[geolocation]",
        lat,
        lon,
        result.location.name,
      );
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/weather/history:
 *   get:
 *     summary: Get search history
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *         description: Results per page
 *     responses:
 *       200:
 *         description: Paginated search history
 */
router.get("/history", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = historySchema.parse(req.query);
    const result = await weatherService.getHistory(req.userId!, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
