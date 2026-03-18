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
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Create a new account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already taken
 */
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

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login to an existing account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
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

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New access token issued
 *       401:
 *         description: No or invalid refresh token
 */
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

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Clear refresh token and log out
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
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

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *       401:
 *         description: Unauthorized
 */
router.get("/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe(req.userId!);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
