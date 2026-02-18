import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp, createTestUser } from "../helpers";

const app = createApp();

describe("Reports API", () => {
  it("POST /reports — creates a private report", async () => {
    const user = await createTestUser(app);
    const res = await supertest(app)
      .post("/reports")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        periodScope: "weekly",
        periodStart: "2026-02-12",
        periodEnd: "2026-02-18",
        visibility: "private",
        includeProfileInfo: false,
      })
      .expect(201);

    expect(res.body.report.visibility).toBe("private");
    expect(res.body.report.publicToken).toBeNull();
  });

  it("POST /reports — creates a public report with token", async () => {
    const user = await createTestUser(app);
    const res = await supertest(app)
      .post("/reports")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        periodScope: "weekly",
        periodStart: "2026-02-12",
        periodEnd: "2026-02-18",
        visibility: "public",
        includeProfileInfo: true,
      })
      .expect(201);

    expect(res.body.report.visibility).toBe("public");
    expect(res.body.report.publicToken).toBeDefined();
  });

  it("GET /reports/mine — lists user reports", async () => {
    const user = await createTestUser(app);

    await supertest(app)
      .post("/reports")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ periodScope: "daily", periodStart: "2026-02-18", periodEnd: "2026-02-18", visibility: "private" });

    const res = await supertest(app)
      .get("/reports/mine")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(res.body.reports.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /reports/public/:token — returns public report", async () => {
    const user = await createTestUser(app);

    const create = await supertest(app)
      .post("/reports")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ periodScope: "weekly", periodStart: "2026-02-12", periodEnd: "2026-02-18", visibility: "public" });

    const token = create.body.report.publicToken;

    const res = await supertest(app)
      .get(`/reports/public/${token}`)
      .expect(200);

    expect(res.body.report).toBeDefined();
    expect(res.body.entries).toBeDefined();
  });

  it("GET /reports/public/:token — 404 for invalid token", async () => {
    await supertest(app)
      .get("/reports/public/invalid-token-123")
      .expect(404);
  });

  it("POST /reports/:id/revoke — revokes public link", async () => {
    const user = await createTestUser(app);

    const create = await supertest(app)
      .post("/reports")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ periodScope: "weekly", periodStart: "2026-02-12", periodEnd: "2026-02-18", visibility: "public" });

    const reportId = create.body.report._id;
    const token = create.body.report.publicToken;

    await supertest(app)
      .post(`/reports/${reportId}/revoke`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    // Token should no longer work
    await supertest(app)
      .get(`/reports/public/${token}`)
      .expect(404);
  });

  it("GET /reports/:id — owner can access private report", async () => {
    const user = await createTestUser(app);

    const create = await supertest(app)
      .post("/reports")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ periodScope: "daily", periodStart: "2026-02-18", periodEnd: "2026-02-18", visibility: "private" });

    const res = await supertest(app)
      .get(`/reports/${create.body.report._id}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(res.body.report).toBeDefined();
  });

  it("GET /reports/:id — non-owner denied without approval", async () => {
    const owner = await createTestUser(app, { email: "owner@report.com" });
    const viewer = await createTestUser(app, { email: "viewer@report.com" });

    const create = await supertest(app)
      .post("/reports")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ periodScope: "daily", periodStart: "2026-02-18", periodEnd: "2026-02-18", visibility: "private" });

    await supertest(app)
      .get(`/reports/${create.body.report._id}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .expect(403);
  });

  it("POST /reports/:id/share-link — generates share link", async () => {
    const user = await createTestUser(app);

    const create = await supertest(app)
      .post("/reports")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ periodScope: "weekly", periodStart: "2026-02-12", periodEnd: "2026-02-18", visibility: "public" });

    const res = await supertest(app)
      .post(`/reports/${create.body.report._id}/share-link`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(res.body.link).toContain("/reports/public/");
  });
});
