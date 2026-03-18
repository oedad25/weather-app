import { describe, it, expect } from "vitest";
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from "../../utils/jwt.js";

describe("jwt utils", () => {
  const userId = "test-user-id";

  it("generates and verifies an access token", () => {
    const token = generateAccessToken(userId);
    const payload = verifyAccessToken(token);
    expect(payload.userId).toBe(userId);
  });

  it("generates and verifies a refresh token", () => {
    const token = generateRefreshToken(userId);
    const payload = verifyRefreshToken(token);
    expect(payload.userId).toBe(userId);
  });

  it("rejects an invalid token", () => {
    expect(() => verifyAccessToken("invalid")).toThrow();
  });
});
