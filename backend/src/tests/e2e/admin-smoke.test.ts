import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../helpers";
import { User } from "../../models/User";

const app = createApp();

describe("Admin Journeys Smoke", () => {
  it("covers overview filters, user edit, family action, and challenge action", async () => {
    const adminSignup = await supertest(app)
      .post("/auth/signup")
      .send({
        email: "admin-smoke@test.com",
        password: "password123",
        displayName: "Admin Smoke",
      })
      .expect(201);

    await User.updateOne({ _id: adminSignup.body.user.id }, { $set: { role: "admin" } });

    const adminLogin = await supertest(app)
      .post("/auth/login")
      .send({ email: "admin-smoke@test.com", password: "password123" })
      .expect(200);
    const adminToken = adminLogin.body.accessToken as string;

    const ownerSignup = await supertest(app)
      .post("/auth/signup")
      .send({
        email: "owner-smoke@test.com",
        password: "password123",
        displayName: "Owner Smoke",
      })
      .expect(201);
    const ownerToken = ownerSignup.body.accessToken as string;
    const ownerUserId = ownerSignup.body.user.id as string;

    const memberSignup = await supertest(app)
      .post("/auth/signup")
      .send({
        email: "member-smoke@test.com",
        password: "password123",
        displayName: "Member Smoke",
      })
      .expect(201);
    const memberToken = memberSignup.body.accessToken as string;
    const memberUserId = memberSignup.body.user.id as string;

    await supertest(app)
      .put("/entries/2026-06-01")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        fields: [{ fieldKey: "smoke", fieldType: "checkbox", value: true, completed: true }],
      })
      .expect(200);

    const challengeRes = await supertest(app)
      .post("/challenges")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Admin Smoke Challenge", scope: "daily" })
      .expect(201);
    const challengeId = challengeRes.body.challenge._id as string;

    const reportRes = await supertest(app)
      .post("/reports")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        periodScope: "daily",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-01",
        visibility: "private",
      })
      .expect(201);
    expect(reportRes.body.report._id).toBeTruthy();

    const familyCreate = await supertest(app)
      .post("/families")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Admin Smoke Family" })
      .expect(201);
    const familyId = familyCreate.body.group._id as string;

    await supertest(app)
      .post(`/families/${familyId}/invite`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "member-smoke@test.com" })
      .expect(200);

    await supertest(app)
      .post(`/families/${familyId}/accept`)
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);

    const overview = await supertest(app)
      .get("/admin/overview?from=2026-05-25&to=2026-06-10")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(overview.body.kpis.totalUsers).toBeGreaterThanOrEqual(3);

    const editRes = await supertest(app)
      .patch(`/admin/users/${ownerUserId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        displayName: "Owner Smoke Updated",
        language: "ar",
        reason: "Smoke admin edit",
      })
      .expect(200);
    expect(editRes.body.user.displayName).toBe("Owner Smoke Updated");

    await supertest(app)
      .post(`/admin/families/${familyId}/transfer-ownership`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newOwnerUserId: memberUserId, reason: "Smoke transfer ownership" })
      .expect(200);

    const familyDetail = await supertest(app)
      .get(`/admin/families/${familyId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(familyDetail.body.family.ownerUserId).toBe(memberUserId);

    await supertest(app)
      .post(`/admin/challenges/${challengeId}/archive`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Smoke archive challenge" })
      .expect(200);

    const challengeDetail = await supertest(app)
      .get(`/admin/challenges/${challengeId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(challengeDetail.body.challenge.active).toBe(false);
  });
});
