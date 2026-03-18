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
