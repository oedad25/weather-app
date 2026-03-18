import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";

const app = createApp();

async function registerAndGetToken(email = "fav@example.com") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "testpassword123" });
  return res.body.accessToken;
}

describe("Favorites API", () => {
  let token: string;

  beforeEach(async () => {
    token = await registerAndGetToken();
  });

  it("adds and lists favorites", async () => {
    await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Denver", country: "US", latitude: 39.74, longitude: -104.99 })
      .expect(201);

    const res = await request(app)
      .get("/api/favorites")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.favorites).toHaveLength(1);
    expect(res.body.favorites[0].name).toBe("Denver");
  });

  it("prevents duplicate locations", async () => {
    const fav = { name: "Denver", country: "US", latitude: 39.74, longitude: -104.99 };
    await request(app).post("/api/favorites").set("Authorization", `Bearer ${token}`).send(fav);
    const res = await request(app).post("/api/favorites").set("Authorization", `Bearer ${token}`).send(fav);

    expect(res.status).toBe(409);
  });

  it("enforces 5-favorite limit", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/favorites")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: `City${i}`, country: "US", latitude: i, longitude: i });
    }

    const res = await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "City5", country: "US", latitude: 5, longitude: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("LIMIT_REACHED");
  });

  it("deletes a favorite", async () => {
    const addRes = await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Denver", country: "US", latitude: 39.74, longitude: -104.99 });

    await request(app)
      .delete(`/api/favorites/${addRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const listRes = await request(app)
      .get("/api/favorites")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.body.favorites).toHaveLength(0);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/favorites");
    expect(res.status).toBe(401);
  });
});
