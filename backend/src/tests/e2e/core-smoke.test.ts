import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../helpers";

const app = createApp();

describe("Core Journeys Smoke (E2E Foundation)", () => {
  it("covers auth, tracker, challenges, reports, family, and approvals", async () => {
    const ownerSignup = await supertest(app)
      .post("/auth/signup")
      .send({
        email: "smoke-owner@test.com",
        password: "password123",
        displayName: "Smoke Owner",
      })
      .expect(201);

    const memberSignup = await supertest(app)
      .post("/auth/signup")
      .send({
        email: "smoke-member@test.com",
        password: "password123",
        displayName: "Smoke Member",
      })
      .expect(201);

    const ownerLogin = await supertest(app)
      .post("/auth/login")
      .send({ email: "smoke-owner@test.com", password: "password123" })
      .expect(200);

    const ownerToken = ownerLogin.body.accessToken as string;
    const memberToken = memberSignup.body.accessToken as string;
    const ownerUserId = ownerSignup.body.user.id as string;

    await supertest(app)
      .get("/me")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    await supertest(app)
      .put("/entries/2026-03-20")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        fields: [{ fieldKey: "smoke", fieldType: "checkbox", value: true, completed: true }],
      })
      .expect(200);

    const challengeCreate = await supertest(app)
      .post("/challenges")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Smoke Challenge", scope: "daily" })
      .expect(201);

    await supertest(app)
      .post(`/challenges/${challengeCreate.body.challenge._id}/progress`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ dateGregorian: "2026-03-20", progressValue: 100, completed: true })
      .expect(200);

    await supertest(app)
      .post("/reports")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        periodScope: "daily",
        periodStart: "2026-03-20",
        periodEnd: "2026-03-20",
        visibility: "private",
      })
      .expect(201);

    const familyCreate = await supertest(app)
      .post("/families")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Smoke Family" })
      .expect(201);

    const familyId = familyCreate.body.group._id as string;

    await supertest(app)
      .post(`/families/${familyId}/invite`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "smoke-member@test.com" })
      .expect(200);

    await supertest(app)
      .post(`/families/${familyId}/accept`)
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);

    const approvalRequest = await supertest(app)
      .post("/visibility/request")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ ownerUserId: ownerUserId, scope: "dashboard" })
      .expect(201);

    await supertest(app)
      .post(`/visibility/approvals/${approvalRequest.body.approval._id}/respond`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ action: "approved" })
      .expect(200);

    const feedRes = await supertest(app)
      .get(`/families/${familyId}/feed?filter=entries`)
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);

    expect(Array.isArray(feedRes.body.events)).toBe(true);
  });
});
