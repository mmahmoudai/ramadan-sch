import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp, createTestUser } from "../helpers";

const app = createApp();

describe("Dashboard Filters API", () => {
  it("applies from/to range to entry and challenge aggregates", async () => {
    const user = await createTestUser(app, { email: "dashboard-filter@test.com" });

    await supertest(app)
      .put("/entries/2026-03-01")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        fields: [
          { fieldKey: "f1", fieldType: "checkbox", value: true, completed: true },
          { fieldKey: "f2", fieldType: "checkbox", value: false, completed: false },
        ],
      })
      .expect(200);

    await supertest(app)
      .put("/entries/2026-03-02")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        fields: [
          { fieldKey: "f1", fieldType: "checkbox", value: true, completed: true },
          { fieldKey: "f2", fieldType: "checkbox", value: true, completed: true },
        ],
      })
      .expect(200);

    await supertest(app)
      .put("/entries/2026-03-03")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        fields: [
          { fieldKey: "f1", fieldType: "checkbox", value: true, completed: true },
          { fieldKey: "f2", fieldType: "checkbox", value: false, completed: false },
        ],
      })
      .expect(200);

    const createChallenge = await supertest(app)
      .post("/challenges")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ title: "Filtered Progress", scope: "daily" })
      .expect(201);

    const challengeId = createChallenge.body.challenge._id;

    await supertest(app)
      .post(`/challenges/${challengeId}/progress`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ dateGregorian: "2026-03-01", progressValue: 20, completed: false })
      .expect(200);

    await supertest(app)
      .post(`/challenges/${challengeId}/progress`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ dateGregorian: "2026-03-03", progressValue: 100, completed: true })
      .expect(200);

    const res = await supertest(app)
      .get("/dashboard/summary?from=2026-03-02&to=2026-03-03")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(res.body.range).toEqual({
      from: "2026-03-02",
      to: "2026-03-03",
      isFiltered: true,
    });

    expect(res.body.totalEntries).toBe(2);

    const dates = res.body.completionScores.map((entry: any) => entry.date).sort();
    expect(dates).toEqual(["2026-03-02", "2026-03-03"]);

    expect(res.body.challengeSummary).toHaveLength(1);
    expect(res.body.challengeSummary[0].totalProgress).toBe(1);
    expect(res.body.challengeSummary[0].completedCount).toBe(1);
  });

  it("rejects invalid date format", async () => {
    const user = await createTestUser(app, { email: "dashboard-bad-date@test.com" });

    await supertest(app)
      .get("/dashboard/summary?from=2026/03/01")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(400);
  });

  it("rejects when from is greater than to", async () => {
    const user = await createTestUser(app, { email: "dashboard-bad-range@test.com" });

    await supertest(app)
      .get("/dashboard/summary?from=2026-03-05&to=2026-03-01")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(400);
  });
});
