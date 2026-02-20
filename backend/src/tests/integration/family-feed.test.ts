import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp, createTestUser } from "../helpers";
import { FamilyGroup } from "../../models/FamilyGroup";
import { DailyEntry } from "../../models/DailyEntry";
import { Report } from "../../models/Report";
import { VisibilityApproval } from "../../models/VisibilityApproval";

const app = createApp();

describe("Family Feed API", () => {
  it("allows active family members to fetch feed", async () => {
    const owner = await createTestUser(app, { email: "feed-owner-1@test.com" });
    const member = await createTestUser(app, { email: "feed-member-1@test.com" });

    const group = await FamilyGroup.create({
      ownerUserId: owner.userId,
      name: "Feed Group",
      members: [
        { userId: owner.userId, role: "owner", status: "active", joinedAt: new Date() },
        { userId: member.userId, role: "member", status: "active", joinedAt: new Date() },
      ],
    });

    await DailyEntry.create({
      userId: owner.userId,
      gregorianDate: "2026-03-10",
      hijriYear: 1447,
      hijriMonth: 9,
      hijriDay: 10,
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: new Date("2026-03-10T23:59:59Z"),
      status: "open",
      fields: [{ fieldKey: "test", fieldType: "checkbox", value: true, completed: true }],
    });

    await VisibilityApproval.create({
      ownerUserId: owner.userId,
      viewerUserId: member.userId,
      scope: "dashboard",
      status: "approved",
    });

    const res = await supertest(app)
      .get(`/families/${group._id}/feed?filter=entries`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events.length).toBeGreaterThan(0);
    expect(res.body.events[0].type).toBe("entries");
    expect(res.body.events[0].actor.id).toBe(owner.userId);
  });

  it("denies feed access to non-members", async () => {
    const owner = await createTestUser(app, { email: "feed-owner-2@test.com" });
    const outsider = await createTestUser(app, { email: "feed-outsider-2@test.com" });

    const group = await FamilyGroup.create({
      ownerUserId: owner.userId,
      name: "Private Family",
      members: [{ userId: owner.userId, role: "owner", status: "active", joinedAt: new Date() }],
    });

    await supertest(app)
      .get(`/families/${group._id}/feed`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .expect(403);
  });

  it("gates dashboard and reports events by visibility approvals", async () => {
    const owner = await createTestUser(app, { email: "feed-owner-3@test.com" });
    const member = await createTestUser(app, { email: "feed-member-3@test.com" });

    const group = await FamilyGroup.create({
      ownerUserId: owner.userId,
      name: "Approval Family",
      members: [
        { userId: owner.userId, role: "owner", status: "active", joinedAt: new Date() },
        { userId: member.userId, role: "member", status: "active", joinedAt: new Date() },
      ],
    });

    await DailyEntry.create({
      userId: owner.userId,
      gregorianDate: "2026-03-11",
      hijriYear: 1447,
      hijriMonth: 9,
      hijriDay: 11,
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: new Date("2026-03-11T23:59:59Z"),
      status: "open",
      fields: [{ fieldKey: "test", fieldType: "checkbox", value: true, completed: true }],
    });

    await Report.create({
      ownerUserId: owner.userId,
      periodScope: "daily",
      periodStart: "2026-03-11",
      periodEnd: "2026-03-11",
      visibility: "private",
      includeProfileInfo: false,
    });

    // No approvals: member should not see owner's dashboard/report events
    const noApprovalEntries = await supertest(app)
      .get(`/families/${group._id}/feed?filter=entries`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    expect(noApprovalEntries.body.events).toHaveLength(0);

    const noApprovalReports = await supertest(app)
      .get(`/families/${group._id}/feed?filter=reports`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    expect(noApprovalReports.body.events).toHaveLength(0);

    await VisibilityApproval.create({
      ownerUserId: owner.userId,
      viewerUserId: member.userId,
      scope: "dashboard",
      status: "approved",
    });

    const dashboardApproved = await supertest(app)
      .get(`/families/${group._id}/feed?filter=entries`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    expect(dashboardApproved.body.events.length).toBeGreaterThan(0);

    const stillNoReportApproval = await supertest(app)
      .get(`/families/${group._id}/feed?filter=reports`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    expect(stillNoReportApproval.body.events).toHaveLength(0);

    await VisibilityApproval.create({
      ownerUserId: owner.userId,
      viewerUserId: member.userId,
      scope: "reports",
      status: "approved",
    });

    const reportsApproved = await supertest(app)
      .get(`/families/${group._id}/feed?filter=reports`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    expect(reportsApproved.body.events.length).toBeGreaterThan(0);
  });
});
