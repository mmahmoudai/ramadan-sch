import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../helpers";

const app = createApp();

describe("Auth API", () => {
  it("POST /auth/signup — creates a new user", async () => {
    const res = await supertest(app)
      .post("/auth/signup")
      .send({ email: "new@test.com", password: "password123", displayName: "New User" })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe("new@test.com");
    expect(res.body.user.displayName).toBe("New User");
  });

  it("POST /auth/signup — rejects duplicate email", async () => {
    await supertest(app)
      .post("/auth/signup")
      .send({ email: "dup@test.com", password: "password123", displayName: "Dup" })
      .expect(201);

    const res = await supertest(app)
      .post("/auth/signup")
      .send({ email: "dup@test.com", password: "password123", displayName: "Dup2" })
      .expect(409);

    expect(res.body.error).toMatch(/already/i);
  });

  it("POST /auth/signup — rejects weak password", async () => {
    await supertest(app)
      .post("/auth/signup")
      .send({ email: "weak@test.com", password: "short", displayName: "Weak" })
      .expect(400);
  });

  it("POST /auth/login — logs in with valid credentials", async () => {
    await supertest(app)
      .post("/auth/signup")
      .send({ email: "login@test.com", password: "password123", displayName: "Login" });

    const res = await supertest(app)
      .post("/auth/login")
      .send({ email: "login@test.com", password: "password123" })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe("login@test.com");
  });

  it("POST /auth/login — rejects wrong password", async () => {
    await supertest(app)
      .post("/auth/signup")
      .send({ email: "wrong@test.com", password: "password123", displayName: "Wrong" });

    await supertest(app)
      .post("/auth/login")
      .send({ email: "wrong@test.com", password: "wrongpassword" })
      .expect(401);
  });

  it("POST /auth/login — rejects non-existent user", async () => {
    await supertest(app)
      .post("/auth/login")
      .send({ email: "nouser@test.com", password: "password123" })
      .expect(401);
  });

  it("POST /auth/logout — invalidates refresh token", async () => {
    const signup = await supertest(app)
      .post("/auth/signup")
      .send({ email: "logout@test.com", password: "password123", displayName: "Logout" });

    await supertest(app)
      .post("/auth/logout")
      .send({ refreshToken: signup.body.refreshToken })
      .expect(200);
  });

  it("POST /auth/refresh — returns new access token", async () => {
    const signup = await supertest(app)
      .post("/auth/signup")
      .send({ email: "refresh@test.com", password: "password123", displayName: "Refresh" });

    const res = await supertest(app)
      .post("/auth/refresh")
      .send({ refreshToken: signup.body.refreshToken })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
  });

  it("GET /me — returns profile with valid token", async () => {
    const signup = await supertest(app)
      .post("/auth/signup")
      .send({ email: "me@test.com", password: "password123", displayName: "Me User" });

    const res = await supertest(app)
      .get("/me")
      .set("Authorization", `Bearer ${signup.body.accessToken}`)
      .expect(200);

    expect(res.body.user.displayName).toBe("Me User");
  });

  it("GET /me — rejects without token", async () => {
    await supertest(app).get("/me").expect(401);
  });
});
