import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp, createTestUser } from "../helpers";
import { User } from "../../models/User";
import { DailyEntry } from "../../models/DailyEntry";
import { Challenge } from "../../models/Challenge";
import { Report } from "../../models/Report";
import { FamilyGroup } from "../../models/FamilyGroup";

const app = createApp();

async function createAdminUser() {
  const admin = await createTestUser(app, {
    email: `admin-mgmt-${Date.now()}@example.com`,
    password: "password123",
    displayName: "Admin Management",
  });
  await User.updateOne({ _id: admin.userId }, { $set: { role: "admin" } });

  const login = await supertest(app)
    .post("/auth/login")
    .send({ email: admin.email, password: admin.password })
    .expect(200);

  return { ...admin, accessToken: login.body.accessToken as string };
}

describe("Admin management endpoints", () => {
  it("manages families, entries, challenges, reports and reset trigger", async () => {
    const admin = await createAdminUser();
    const owner = await createTestUser(app, {
      email: `owner-mgmt-${Date.now()}@example.com`,
      password: "password123",
      displayName: "Owner Mgmt",
    });
    const member = await createTestUser(app, {
      email: `member-mgmt-${Date.now()}@example.com`,
      password: "password123",
      displayName: "Member Mgmt",
    });

    await DailyEntry.create({
      userId: owner.userId,
      gregorianDate: "2026-05-01",
      hijriYear: 1447,
      hijriMonth: 11,
      hijriDay: 5,
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: new Date("2026-05-01T23:59:59Z"),
      status: "open",
      fields: [{ fieldKey: "f1", fieldType: "checkbox", value: true, completed: true }],
    });

    const challenge = await Challenge.create({
      userId: owner.userId,
      title: "Manage Challenge",
      description: "Challenge for admin management",
      scope: "daily",
      active: true,
      periods: [],
      progress: [],
    });

    const report = await Report.create({
      ownerUserId: owner.userId,
      periodScope: "daily",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-01",
      visibility: "private",
      includeProfileInfo: false,
    });

    const family = await FamilyGroup.create({
      ownerUserId: owner.userId,
      name: "Admin Managed Family",
      archivedAt: null,
      members: [
        { userId: owner.userId, role: "owner", status: "active", joinedAt: new Date() },
        { userId: member.userId, role: "member", status: "active", joinedAt: new Date() },
      ],
    });

    const familiesRes = await supertest(app)
      .get("/admin/families")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(familiesRes.body.total).toBe(1);
    expect(familiesRes.body.families[0].name).toBe("Admin Managed Family");

    const familyDetail = await supertest(app)
      .get(`/admin/families/${family._id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(familyDetail.body.metrics.memberCount).toBe(2);
    expect(familyDetail.body.metrics.entryCount).toBe(1);

    await supertest(app)
      .post(`/admin/families/${family._id}/transfer-ownership`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ newOwnerUserId: member.userId, reason: "Owner requested transfer" })
      .expect(200);

    const familyAfterTransfer = await FamilyGroup.findById(family._id);
    expect(familyAfterTransfer?.ownerUserId.toString()).toBe(member.userId);

    await supertest(app)
      .post(`/admin/families/${family._id}/remove-member`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ memberUserId: owner.userId, reason: "Cleanup inactive member" })
      .expect(200);

    await supertest(app)
      .post(`/admin/families/${family._id}/archive`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "Archive completed family" })
      .expect(200);

    const entryDoc = await DailyEntry.findOne({ userId: owner.userId });
    expect(entryDoc).toBeTruthy();

    const entriesRes = await supertest(app)
      .get(`/admin/entries?userId=${owner.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(entriesRes.body.total).toBe(1);

    await supertest(app)
      .get(`/admin/entries/${entryDoc!._id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    await supertest(app)
      .get("/admin/challenges")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    await supertest(app)
      .get(`/admin/challenges/${challenge._id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    await supertest(app)
      .post(`/admin/challenges/${challenge._id}/archive`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "Challenge should be paused" })
      .expect(200);

    const archivedChallenge = await Challenge.findById(challenge._id);
    expect(archivedChallenge?.active).toBe(false);

    await supertest(app)
      .post(`/admin/challenges/${challenge._id}/reactivate`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "Challenge resumed by admin" })
      .expect(200);

    const reactivatedChallenge = await Challenge.findById(challenge._id);
    expect(reactivatedChallenge?.active).toBe(true);

    await supertest(app)
      .get("/admin/reports")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    await supertest(app)
      .get(`/admin/reports/${report._id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    await supertest(app)
      .patch(`/admin/reports/${report._id}/access-policy`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ visibility: "public", includeProfileInfo: true, reason: "Enable supervised share" })
      .expect(200);

    const publicReport = await Report.findById(report._id);
    expect(publicReport?.visibility).toBe("public");
    expect(publicReport?.publicToken).toBeTruthy();

    await supertest(app)
      .post(`/admin/reports/${report._id}/revoke-public`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "Security rollback" })
      .expect(200);

    const revokedReport = await Report.findById(report._id);
    expect(revokedReport?.visibility).toBe("private");
    expect(revokedReport?.revokedAt).toBeTruthy();

    await supertest(app)
      .post(`/admin/users/${owner.userId}/reset-password-trigger`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "Compromised credentials", forceLogout: true })
      .expect(200);

    const ownerAfterReset = await User.findById(owner.userId);
    expect(ownerAfterReset?.resetPasswordToken).toBeTruthy();
    expect(ownerAfterReset?.resetPasswordExpires).toBeTruthy();

    await supertest(app)
      .delete(`/admin/reports/${report._id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "Data retention cleanup" })
      .expect(200);
    expect(await Report.findById(report._id)).toBeNull();

    await supertest(app)
      .delete(`/admin/challenges/${challenge._id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "Challenge no longer valid" })
      .expect(200);
    expect(await Challenge.findById(challenge._id)).toBeNull();

    await supertest(app)
      .delete(`/admin/families/${family._id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "Archived family removal" })
      .expect(200);
    expect(await FamilyGroup.findById(family._id)).toBeNull();
  });

  it("requires reason on mutating endpoints", async () => {
    const admin = await createAdminUser();
    const user = await createTestUser(app, {
      email: `reason-check-${Date.now()}@example.com`,
      password: "password123",
      displayName: "Reason Check",
    });

    await supertest(app)
      .patch(`/admin/users/${user.userId}/role`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ role: "admin" })
      .expect(400);

    await supertest(app)
      .post(`/admin/users/${user.userId}/revoke-sessions`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({})
      .expect(400);
  });

  it("denies non-admin users from management endpoints", async () => {
    const user = await createTestUser(app, {
      email: `no-admin-mgmt-${Date.now()}@example.com`,
      password: "password123",
      displayName: "No Admin",
    });

    await supertest(app)
      .get("/admin/families")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(403);

    await supertest(app)
      .get("/admin/entries")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(403);

    await supertest(app)
      .get("/admin/challenges")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(403);

    await supertest(app)
      .get("/admin/reports")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(403);
  });
});
