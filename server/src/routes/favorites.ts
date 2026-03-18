import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import { addFavoriteSchema } from "../schemas/favorites.js";
import * as favoritesService from "../services/favorites.js";

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /api/favorites:
 *   get:
 *     summary: List all favorites for the current user
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of favorites
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const favorites = await favoritesService.list(req.userId!);
    res.json({ favorites });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/favorites:
 *   post:
 *     summary: Add a new favorite location
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, country, latitude, longitude]
 *             properties:
 *               name:
 *                 type: string
 *               admin1:
 *                 type: string
 *               country:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       201:
 *         description: Favorite created
 *       400:
 *         description: Validation error or maximum of 5 favorites reached
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = addFavoriteSchema.parse(req.body);
    const favorite = await favoritesService.add(req.userId!, data);
    res.status(201).json(favorite);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/favorites/{id}:
 *   delete:
 *     summary: Remove a favorite by ID
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Favorite ID
 *     responses:
 *       204:
 *         description: Favorite deleted
 *       404:
 *         description: Favorite not found
 */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await favoritesService.remove(req.userId!, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
