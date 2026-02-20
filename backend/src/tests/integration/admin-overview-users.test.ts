import { describe, it, expect } from "vitest";
import supertest from "supertest";
import mongoose from "mongoose";
import { createApp, createTestUser } from "../helpers";
import { User } from "../../models/User";
import { DailyEntry } from "../../models/DailyEntry";
import { Challenge } from "../../models/Challenge";
import { Report } from "../../models/Report";
import { FamilyGroup } from "../../models/FamilyGroup";
import { Comment } from "../../models/Comment";
import { Reaction } from "../../models/Reaction";
import { RefreshToken } from "../../models/RefreshToken";
import { AuditLog } from "../../models/AuditLog";

const app = createApp();

async function createAdminUser() {
  const admin = await createTestUser(app, {
    email: `admin-${Date.now()}@example.com`,
    password: "password123",
    displayName: "Admin User",
  });
  await User.updateOne({ _id: admin.userId }, { $set: { role: "admin" } });

  const login = await supertest(app)
    .post("/auth/login")
    .send({ email: admin.email, password: admin.password })
    .expect(200);

  return { ...admin, accessToken: login.body.accessToken as string };
}

describe("Admin overview and user management", () => {
  it("returns filtered overview analytics", async () => {
    const admin = await createAdminUser();
    const userEn = await createTestUser(app, {
      email: `user-en-${Date.now()}@example.com`,
      password: "password123",
      displayName: "User English",
    });
    const userAr = await createTestUser(app, {
      email: `user-ar-${Date.now()}@example.com`,
      password: "password123",
      displayName: "User Arabic",
    });

    await User.updateOne({ _id: userEn.userId }, { $set: { language: "en" } });
    await User.updateOne({ _id: userAr.userId }, { $set: { language: "ar" } });

    const targetId = new mongoose.Types.ObjectId();
    await DailyEntry.create({
      userId: userEn.userId,
      gregorianDate: "2026-04-01",
      hijriYear: 1447,
      hijriMonth: 10,
      hijriDay: 12,
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: new Date("2026-04-01T23:59:59Z"),
      status: "open",
      fields: [{ fieldKey: "a", fieldType: "checkbox", value: true, completed: true }],
    });
    await Challenge.create({
      userId: userEn.userId,
      title: "Overview Challenge",
      scope: "daily",
      active: true,
      progress: [],
    });
    await Report.create({
      ownerUserId: userEn.userId,
      periodScope: "daily",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-01",
      visibility: "private",
      includeProfileInfo: false,
    });
    await FamilyGroup.create({
      ownerUserId: userEn.userId,
      name: "Overview Family",
      members: [
        { userId: userEn.userId, role: "owner", status: "active", joinedAt: new Date() },
        { userId: userAr.userId, role: "member", status: "active", joinedAt: new Date() },
      ],
    });
    await Comment.create({
      ownerUserId: userEn.userId,
      authorUserId: userAr.userId,
      targetType: "daily_entry",
      targetId,
      body: "nice work",
    });
    await Reaction.create({
      ownerUserId: userEn.userId,
      authorUserId: userAr.userId,
      targetType: "daily_entry",
      targetId,
      reactionType: "love",
    });

    const res = await supertest(app)
      .get("/admin/overview?language=en")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(res.body.filters.language).toBe("en");
    expect(res.body.kpis.totalUsers).toBe(2); // admin + userEn
    expect(res.body.kpis.totalEntries).toBe(1);
    expect(res.body.kpis.totalChallenges).toBe(1);
    expect(res.body.kpis.totalReports).toBe(1);
    expect(res.body.kpis.totalFamilies).toBe(1);
    expect(res.body.kpis.totalComments).toBe(1);
    expect(res.body.kpis.totalReactions).toBe(1);
    expect(Array.isArray(res.body.trend)).toBe(true);
    expect(Array.isArray(res.body.topActiveUsers)).toBe(true);

    await supertest(app)
      .get("/admin/overview?from=2026/01/01")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(400);
  });

  it("supports advanced user filters, user detail, edit, and session revocation", async () => {
    const admin = await createAdminUser();
    const target = await createTestUser(app, {
      email: `target-${Date.now()}@example.com`,
      password: "password123",
      displayName: "Target User",
    });
    const other = await createTestUser(app, {
      email: `other-${Date.now()}@example.com`,
      password: "password123",
      displayName: "Other User",
    });

    await User.updateOne(
      { _id: target.userId },
      { $set: { language: "tr", reminderEnabled: false, timezoneIana: "Europe/Istanbul" } }
    );

    await DailyEntry.create({
      userId: target.userId,
      gregorianDate: "2026-04-02",
      hijriYear: 1447,
      hijriMonth: 10,
      hijriDay: 13,
      timezoneSnapshot: "Europe/Istanbul",
      lockAtUtc: new Date("2026-04-02T23:59:59Z"),
      status: "open",
      fields: [{ fieldKey: "x", fieldType: "checkbox", value: true, completed: true }],
    });

    await FamilyGroup.create({
      ownerUserId: other.userId,
      name: "Membership Family",
      members: [
        { userId: other.userId, role: "owner", status: "active", joinedAt: new Date() },
        { userId: target.userId, role: "member", status: "active", joinedAt: new Date() },
      ],
    });

    const listRes = await supertest(app)
      .get("/admin/users?language=tr&reminderEnabled=false&sortBy=entryCount&sortOrder=desc")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(listRes.body.total).toBe(1);
    expect(listRes.body.users[0].id).toBe(target.userId);
    expect(listRes.body.users[0].entryCount).toBe(1);
    expect(listRes.body.users[0].lastActivityAt).toBeTruthy();

    const detailRes = await supertest(app)
      .get(`/admin/users/${target.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(detailRes.body.user.id).toBe(target.userId);
    expect(detailRes.body.metrics.entryCount).toBe(1);
    expect(detailRes.body.metrics.familyMembershipCount).toBe(1);

    const patchRes = await supertest(app)
      .patch(`/admin/users/${target.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        displayName: "Updated Target",
        bio: "Admin updated bio",
        language: "en",
        timezoneIana: "America/New_York",
        timezoneSource: "manual",
        reminderEnabled: true,
        reminderTimeLocal: "20:30",
        reason: "Support request",
      })
      .expect(200);

    expect(patchRes.body.user.displayName).toBe("Updated Target");
    expect(patchRes.body.user.reminderEnabled).toBe(true);

    const updatedUser = await User.findById(target.userId);
    expect(updatedUser?.displayName).toBe("Updated Target");
    expect(updatedUser?.timezoneSource).toBe("manual");
    expect(updatedUser?.reminderTimeLocal).toBe("20:30");

    await RefreshToken.create({
      userId: target.userId,
      token: `rt-${Date.now()}-1`,
      expiresAt: new Date(Date.now() + 3600_000),
    });
    await RefreshToken.create({
      userId: target.userId,
      token: `rt-${Date.now()}-2`,
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const revokeRes = await supertest(app)
      .post(`/admin/users/${target.userId}/revoke-sessions`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "Security incident response" })
      .expect(200);

    expect(revokeRes.body.revokedCount).toBeGreaterThanOrEqual(2);
    expect(await RefreshToken.countDocuments({ userId: target.userId })).toBe(0);

    const revokeAudit = await AuditLog.findOne({
      action: "admin_revoke_sessions",
      targetId: target.userId,
    });
    expect(revokeAudit).toBeTruthy();
  });

  it("denies non-admin access to admin management routes", async () => {
    const user = await createTestUser(app, {
      email: `member-${Date.now()}@example.com`,
      password: "password123",
      displayName: "Normal Member",
    });

    await supertest(app)
      .get("/admin/overview")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(403);

    await supertest(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(403);

    await supertest(app)
      .post(`/admin/users/${user.userId}/revoke-sessions`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(403);
  });
});
