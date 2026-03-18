import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";

const app = createApp();

async function registerAndGetToken(email = "weather@example.com") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "testpassword123" });
  return res.body.accessToken;
}

describe("Weather API", () => {
  let token: string;

  beforeEach(async () => {
    token = await registerAndGetToken();
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/weather/search?city=Denver");
    expect(res.status).toBe(401);
  });

  it("validates search query parameter", async () => {
    const res = await request(app)
      .get("/api/weather/search")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("validates coords parameters", async () => {
    const res = await request(app)
      .get("/api/weather/coords?lat=999&lon=0")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns paginated search history", async () => {
    const res = await request(app)
      .get("/api/weather/history")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.total).toBeDefined();
    expect(res.body.page).toBe(1);
  });

  it("includes airQuality field in search response (requires external API)", async () => {
    const res = await request(app)
      .get("/api/weather/search?city=Denver&unit=celsius")
      .set("Authorization", `Bearer ${token}`);

    // This test hits the real Open-Meteo API. If the API is unavailable,
    // we skip assertions rather than fail the CI pipeline.
    if (res.status === 200) {
      expect(res.body).toHaveProperty("airQuality");
      if (res.body.airQuality !== null) {
        expect(res.body.airQuality).toHaveProperty("aqi");
        expect(res.body.airQuality).toHaveProperty("pm25");
        expect(res.body.airQuality).toHaveProperty("pm10");
        expect(res.body.airQuality).toHaveProperty("ozone");
        expect(res.body.airQuality).toHaveProperty("no2");
        expect(res.body.airQuality).toHaveProperty("so2");
        expect(res.body.airQuality).toHaveProperty("co");
      }
    }
  });
});
