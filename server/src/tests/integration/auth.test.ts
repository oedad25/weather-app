import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";

const app = createApp();

describe("POST /api/auth/register", () => {
  it("creates a new user and returns access token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "new@example.com", password: "testpassword123" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("new@example.com");
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects duplicate email", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@example.com", password: "testpassword123" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@example.com", password: "testpassword123" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("rejects invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "notanemail", password: "testpassword123" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com", password: "short" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with valid credentials", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "login@example.com", password: "testpassword123" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "testpassword123" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it("rejects wrong password", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "wrong@example.com", password: "testpassword123" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "wrong@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns user profile with valid token", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: "me@example.com", password: "testpassword123" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${reg.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("me@example.com");
  });

  it("rejects missing token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("returns new access token using refresh cookie", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: "refresh@example.com", password: "testpassword123" });

    const cookies = reg.headers["set-cookie"];

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookies);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes refresh token and clears cookie", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: "logout@example.com", password: "testpassword123" });

    const cookies = reg.headers["set-cookie"];

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookies);

    expect(logoutRes.status).toBe(200);

    // Refresh should now fail
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookies);

    expect(refreshRes.status).toBe(401);
  });
});
