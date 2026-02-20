import { describe, it, expect } from "vitest";
import supertest from "supertest";
import mongoose from "mongoose";
import { createApp, createTestUser } from "../helpers";
import { User } from "../../models/User";
import { DailyEntry } from "../../models/DailyEntry";
import { Challenge } from "../../models/Challenge";
import { Report } from "../../models/Report";
import { EmailReminder } from "../../models/EmailReminder";
import { RefreshToken } from "../../models/RefreshToken";
import { VisibilityApproval } from "../../models/VisibilityApproval";
import { Comment } from "../../models/Comment";
import { Reaction } from "../../models/Reaction";
import { FamilyGroup } from "../../models/FamilyGroup";
import { AuditLog } from "../../models/AuditLog";

const app = createApp();

describe("Admin Delete User Cleanup", () => {
  it("removes user-linked data and cleans external references", async () => {
    const admin = await createTestUser(app, {
      email: "admin-cleanup@test.com",
      password: "password123",
      displayName: "Cleanup Admin",
    });
    await User.updateOne({ _id: admin.userId }, { $set: { role: "admin" } });

    const adminLogin = await supertest(app)
      .post("/auth/login")
      .send({ email: "admin-cleanup@test.com", password: "password123" })
      .expect(200);
    const adminToken = adminLogin.body.accessToken as string;

    const target = await createTestUser(app, {
      email: "target-cleanup@test.com",
      password: "password123",
      displayName: "Cleanup Target",
    });
    const other = await createTestUser(app, {
      email: "other-cleanup@test.com",
      password: "password123",
      displayName: "Cleanup Other",
    });

    await DailyEntry.create({
      userId: target.userId,
      gregorianDate: "2026-03-01",
      hijriYear: 1447,
      hijriMonth: 9,
      hijriDay: 1,
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: new Date("2026-03-01T23:59:59Z"),
      status: "open",
      fields: [],
    });

    await Challenge.create({
      userId: target.userId,
      title: "Cleanup Challenge",
      scope: "daily",
      active: true,
      progress: [],
    });

    const ownedReport = await Report.create({
      ownerUserId: target.userId,
      periodScope: "daily",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-01",
      visibility: "private",
      includeProfileInfo: false,
    });
    expect(ownedReport).toBeTruthy();

    const sharedReport = await Report.create({
      ownerUserId: other.userId,
      periodScope: "weekly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-07",
      visibility: "public",
      includeProfileInfo: false,
      accessLog: [
        {
          viewerUserId: target.userId,
          accessType: "private",
          accessedAt: new Date(),
        },
      ],
    });
    expect(sharedReport.accessLog).toHaveLength(1);

    await EmailReminder.create({
      userId: target.userId,
      sendAtUtc: new Date(),
      status: "sent",
      reason: "seed",
    });

    await RefreshToken.create({
      userId: target.userId,
      token: "cleanup-refresh-token-1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await VisibilityApproval.create({
      ownerUserId: target.userId,
      viewerUserId: other.userId,
      scope: "dashboard",
      status: "approved",
    });
    await VisibilityApproval.create({
      ownerUserId: other.userId,
      viewerUserId: target.userId,
      scope: "reports",
      status: "approved",
    });

    const socialTargetId = new mongoose.Types.ObjectId().toString();
    await Comment.create({
      ownerUserId: target.userId,
      authorUserId: other.userId,
      targetType: "daily_entry",
      targetId: socialTargetId,
      body: "comment owned by target",
    });
    await Reaction.create({
      ownerUserId: target.userId,
      authorUserId: other.userId,
      targetType: "daily_entry",
      targetId: socialTargetId,
      reactionType: "love",
    });

    await Comment.create({
      ownerUserId: other.userId,
      authorUserId: target.userId,
      targetType: "daily_entry",
      targetId: socialTargetId,
      body: "comment authored by target",
    });
    await Reaction.create({
      ownerUserId: other.userId,
      authorUserId: target.userId,
      targetType: "daily_entry",
      targetId: socialTargetId,
      reactionType: "fire",
    });

    const ownedFamily = await FamilyGroup.create({
      ownerUserId: target.userId,
      name: "Owned Family",
      members: [{ userId: target.userId, role: "owner", status: "active", joinedAt: new Date() }],
    });
    expect(ownedFamily).toBeTruthy();

    const membershipFamily = await FamilyGroup.create({
      ownerUserId: other.userId,
      name: "Other Family",
      members: [
        { userId: other.userId, role: "owner", status: "active", joinedAt: new Date() },
        { userId: target.userId, role: "member", status: "active", joinedAt: new Date() },
      ],
    });
    expect(membershipFamily.members).toHaveLength(2);

    await AuditLog.create({
      actorUserId: target.userId,
      action: "target_action",
      targetType: "report",
      targetId: sharedReport._id.toString(),
    });
    await AuditLog.create({
      actorUserId: other.userId,
      action: "action_on_user",
      targetType: "user",
      targetId: target.userId,
    });

    await supertest(app)
      .delete(`/admin/users/${target.userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "GDPR account erasure request" })
      .expect(200);

    expect(await User.findById(target.userId)).toBeNull();
    expect(await DailyEntry.countDocuments({ userId: target.userId })).toBe(0);
    expect(await Challenge.countDocuments({ userId: target.userId })).toBe(0);
    expect(await Report.countDocuments({ ownerUserId: target.userId })).toBe(0);
    expect(await EmailReminder.countDocuments({ userId: target.userId })).toBe(0);
    expect(await RefreshToken.countDocuments({ userId: target.userId })).toBe(0);

    expect(
      await VisibilityApproval.countDocuments({
        $or: [{ ownerUserId: target.userId }, { viewerUserId: target.userId }],
      })
    ).toBe(0);

    expect(
      await Comment.countDocuments({
        $or: [{ ownerUserId: target.userId }, { authorUserId: target.userId }],
      })
    ).toBe(0);

    expect(
      await Reaction.countDocuments({
        $or: [{ ownerUserId: target.userId }, { authorUserId: target.userId }],
      })
    ).toBe(0);

    expect(await FamilyGroup.countDocuments({ ownerUserId: target.userId })).toBe(0);
    const cleanedMembershipFamily = await FamilyGroup.findById(membershipFamily._id);
    expect(
      cleanedMembershipFamily?.members.some((m) => m.userId.toString() === target.userId)
    ).toBe(false);

    const cleanedSharedReport = await Report.findById(sharedReport._id);
    expect(
      cleanedSharedReport?.accessLog.some((l) => l.viewerUserId?.toString() === target.userId)
    ).toBe(false);

    const staleAuditLogs = await AuditLog.find({
      $or: [
        { actorUserId: target.userId },
        { targetType: "user", targetId: target.userId, action: { $ne: "admin_delete_user" } },
      ],
    });
    expect(staleAuditLogs).toHaveLength(0);

    const adminDeleteAudit = await AuditLog.findOne({
      action: "admin_delete_user",
      targetType: "user",
      targetId: target.userId,
    });
    expect(adminDeleteAudit).toBeTruthy();
  });
});
