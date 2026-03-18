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
});
