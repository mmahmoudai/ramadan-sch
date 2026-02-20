import { describe, it } from "vitest";
import supertest from "supertest";
import mongoose from "mongoose";
import { createApp, createTestUser } from "../helpers";
import { VisibilityApproval } from "../../models/VisibilityApproval";

const app = createApp();

describe("Visibility Scope Enforcement", () => {
  it("denies comments on dashboard content when only reports approval exists", async () => {
    const owner = await createTestUser(app, { email: "scope-owner-comment@test.com" });
    const viewer = await createTestUser(app, { email: "scope-viewer-comment@test.com" });

    await VisibilityApproval.create({
      ownerUserId: owner.userId,
      viewerUserId: viewer.userId,
      scope: "reports",
      status: "approved",
    });

    await supertest(app)
      .post("/comments")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .send({
        ownerUserId: owner.userId,
        targetType: "daily_entry",
        targetId: new mongoose.Types.ObjectId().toString(),
        body: "Great progress today!",
      })
      .expect(403);
  });

  it("allows comments on dashboard content with dashboard approval", async () => {
    const owner = await createTestUser(app, { email: "scope-owner-comment-ok@test.com" });
    const viewer = await createTestUser(app, { email: "scope-viewer-comment-ok@test.com" });

    await VisibilityApproval.create({
      ownerUserId: owner.userId,
      viewerUserId: viewer.userId,
      scope: "dashboard",
      status: "approved",
    });

    await supertest(app)
      .post("/comments")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .send({
        ownerUserId: owner.userId,
        targetType: "daily_entry",
        targetId: new mongoose.Types.ObjectId().toString(),
        body: "MashaAllah!",
      })
      .expect(201);
  });

  it("denies reactions on dashboard content when only reports approval exists", async () => {
    const owner = await createTestUser(app, { email: "scope-owner-reaction@test.com" });
    const viewer = await createTestUser(app, { email: "scope-viewer-reaction@test.com" });

    await VisibilityApproval.create({
      ownerUserId: owner.userId,
      viewerUserId: viewer.userId,
      scope: "reports",
      status: "approved",
    });

    await supertest(app)
      .post("/comments/reactions")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .send({
        ownerUserId: owner.userId,
        targetType: "daily_entry",
        targetId: new mongoose.Types.ObjectId().toString(),
        reactionType: "love",
      })
      .expect(403);
  });

  it("allows reactions on dashboard content with dashboard approval", async () => {
    const owner = await createTestUser(app, { email: "scope-owner-reaction-ok@test.com" });
    const viewer = await createTestUser(app, { email: "scope-viewer-reaction-ok@test.com" });

    await VisibilityApproval.create({
      ownerUserId: owner.userId,
      viewerUserId: viewer.userId,
      scope: "dashboard",
      status: "approved",
    });

    await supertest(app)
      .post("/comments/reactions")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .send({
        ownerUserId: owner.userId,
        targetType: "daily_entry",
        targetId: new mongoose.Types.ObjectId().toString(),
        reactionType: "love",
      })
      .expect(201);
  });
});
