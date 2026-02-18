import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp, createTestUser } from "../helpers";

const app = createApp();

describe("Daily Tracker API", () => {
  it("GET /entries/:date — returns null for non-existent entry", async () => {
    const user = await createTestUser(app);
    const res = await supertest(app)
      .get("/entries/2026-03-01")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(res.body.entry).toBeNull();
  });

  it("PUT /entries/:date — creates a new entry", async () => {
    const user = await createTestUser(app);
    const fields = [
      { fieldKey: "ibadah_quran", fieldType: "checkbox", value: true, completed: true },
      { fieldKey: "habit_water", fieldType: "checkbox", value: false, completed: false },
    ];

    const res = await supertest(app)
      .put("/entries/2026-03-01")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ fields })
      .expect(200);

    expect(res.body.entry).toBeDefined();
    expect(res.body.entry.gregorianDate).toBe("2026-03-01");
    expect(res.body.entry.fields).toHaveLength(2);
    expect(res.body.entry.status).toBe("open");
  });

  it("PUT /entries/:date — updates existing entry", async () => {
    const user = await createTestUser(app);
    const fields1 = [{ fieldKey: "test", fieldType: "checkbox", value: false, completed: false }];
    const fields2 = [{ fieldKey: "test", fieldType: "checkbox", value: true, completed: true }];

    await supertest(app)
      .put("/entries/2026-03-02")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ fields: fields1 })
      .expect(200);

    const res = await supertest(app)
      .put("/entries/2026-03-02")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ fields: fields2 })
      .expect(200);

    expect(res.body.entry.fields[0].completed).toBe(true);
  });

  it("PUT /entries/:date — rejects update on locked entry", async () => {
    const user = await createTestUser(app);

    // Create entry with past lock time
    const { DailyEntry } = await import("../../models/DailyEntry");
    const { User: UserModel } = await import("../../models/User");
    const dbUser = await UserModel.findOne({ email: user.email });

    const pastLock = new Date();
    pastLock.setHours(pastLock.getHours() - 1);

    await DailyEntry.create({
      userId: dbUser!._id,
      gregorianDate: "2026-02-10",
      hijriYear: 1447, hijriMonth: 8, hijriDay: 21,
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: pastLock,
      status: "locked",
      fields: [{ fieldKey: "locked_field", fieldType: "checkbox", value: false, completed: false }],
    });

    const res = await supertest(app)
      .put("/entries/2026-02-10")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ fields: [{ fieldKey: "locked_field", fieldType: "checkbox", value: true, completed: true }] })
      .expect(423);

    expect(res.body.error).toMatch(/locked/i);
  });

  it("GET /entries — lists entries with date range", async () => {
    const user = await createTestUser(app);

    await supertest(app)
      .put("/entries/2026-03-05")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ fields: [{ fieldKey: "a", fieldType: "checkbox", value: true, completed: true }] });

    await supertest(app)
      .put("/entries/2026-03-06")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ fields: [{ fieldKey: "b", fieldType: "checkbox", value: true, completed: true }] });

    const res = await supertest(app)
      .get("/entries?from=2026-03-05&to=2026-03-06")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(res.body.entries.length).toBe(2);
  });

  it("POST /entries/:date/submit — returns entry if not yet past lock time", async () => {
    const user = await createTestUser(app);

    await supertest(app)
      .put("/entries/2026-03-07")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ fields: [{ fieldKey: "x", fieldType: "checkbox", value: true, completed: true }] });

    const res = await supertest(app)
      .post("/entries/2026-03-07/submit")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    // Entry is still open because lockAtUtc is future (end of day)
    expect(res.body.entry.status).toBe("open");
    expect(res.body.message).toBeDefined();
  });

  it("rejects unauthenticated requests", async () => {
    await supertest(app).get("/entries/2026-03-01").expect(401);
    await supertest(app).put("/entries/2026-03-01").send({ fields: [] }).expect(401);
  });
});
