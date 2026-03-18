import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "../../schemas/auth.js";
import { searchSchema, coordsSchema, historySchema } from "../../schemas/weather.js";
import { addFavoriteSchema } from "../../schemas/favorites.js";

describe("auth schemas", () => {
  it("accepts valid registration", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "securepassword",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      email: "notanemail",
      password: "securepassword",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("weather schemas", () => {
  it("accepts valid city search", () => {
    const result = searchSchema.safeParse({ city: "Denver" });
    expect(result.success).toBe(true);
  });

  it("accepts valid coords", () => {
    const result = coordsSchema.safeParse({
      lat: "39.74",
      lon: "-104.99",
      unit: "fahrenheit",
    });
    expect(result.success).toBe(true);
  });

  it("defaults unit to celsius", () => {
    const result = coordsSchema.safeParse({ lat: "39.74", lon: "-104.99" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.unit).toBe("celsius");
  });
});

describe("favorites schemas", () => {
  it("accepts valid favorite", () => {
    const result = addFavoriteSchema.safeParse({
      name: "Denver",
      country: "United States",
      admin1: "Colorado",
      latitude: 39.74,
      longitude: -104.99,
    });
    expect(result.success).toBe(true);
  });

  it("allows optional admin1", () => {
    const result = addFavoriteSchema.safeParse({
      name: "Tokyo",
      country: "Japan",
      latitude: 35.68,
      longitude: 139.69,
    });
    expect(result.success).toBe(true);
  });
});
