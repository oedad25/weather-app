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
    await favoritesService.remove(req.userId!, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
