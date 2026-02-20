import { describe, it, expect } from "vitest";
import supertest from "supertest";
import crypto from "crypto";
import { createApp } from "../helpers";
import { User } from "../../models/User";

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

  it("POST /auth/password/forgot — returns generic response for unknown email", async () => {
    const res = await supertest(app)
      .post("/auth/password/forgot")
      .send({ email: "nobody@example.com" })
      .expect(200);

    expect(res.body.message).toMatch(/if an account exists/i);
  });

  it("POST /auth/password/forgot — stores reset token for existing user", async () => {
    await supertest(app)
      .post("/auth/signup")
      .send({ email: "forgot-existing@test.com", password: "password123", displayName: "Forgot Existing" })
      .expect(201);

    await supertest(app)
      .post("/auth/password/forgot")
      .send({ email: "forgot-existing@test.com" })
      .expect(200);

    const user = await User.findOne({ email: "forgot-existing@test.com" });
    expect(user).toBeTruthy();
    expect(user!.resetPasswordToken).toBeTruthy();
    expect(user!.resetPasswordExpires).toBeTruthy();
  });

  it("POST /auth/password/reset — resets password with valid token", async () => {
    await supertest(app)
      .post("/auth/signup")
      .send({ email: "reset-valid@test.com", password: "password123", displayName: "Reset Valid" })
      .expect(201);

    const rawToken = "known-valid-reset-token";
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    await User.updateOne(
      { email: "reset-valid@test.com" },
      {
        $set: {
          resetPasswordToken: hashedToken,
          resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      }
    );

    await supertest(app)
      .post("/auth/password/reset")
      .send({ token: rawToken, newPassword: "newpassword123" })
      .expect(200);

    await supertest(app)
      .post("/auth/login")
      .send({ email: "reset-valid@test.com", password: "password123" })
      .expect(401);

    await supertest(app)
      .post("/auth/login")
      .send({ email: "reset-valid@test.com", password: "newpassword123" })
      .expect(200);

    const user = await User.findOne({ email: "reset-valid@test.com" });
    expect(user!.resetPasswordToken).toBeNull();
    expect(user!.resetPasswordExpires).toBeNull();
  });

  it("POST /auth/password/reset — rejects invalid token", async () => {
    await supertest(app)
      .post("/auth/password/reset")
      .send({ token: "invalid-token", newPassword: "newpassword123" })
      .expect(400);
  });

  it("POST /auth/password/reset — rejects expired token", async () => {
    await supertest(app)
      .post("/auth/signup")
      .send({ email: "reset-expired@test.com", password: "password123", displayName: "Reset Expired" })
      .expect(201);

    const rawToken = "known-expired-reset-token";
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    await User.updateOne(
      { email: "reset-expired@test.com" },
      {
        $set: {
          resetPasswordToken: hashedToken,
          resetPasswordExpires: new Date(Date.now() - 60 * 1000),
        },
      }
    );

    await supertest(app)
      .post("/auth/password/reset")
      .send({ token: rawToken, newPassword: "newpassword123" })
      .expect(400);
  });
});
