import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp, createTestUser } from "../helpers";
import {
  formatGregorianDate,
  getHijriWeekIndex,
  gregorianToHijri,
  parseGregorianDateStrict,
} from "../../utils/hijri";

const app = createApp();

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function findHijriMonthBoundary(startDateGregorian: string): { before: string; after: string } {
  let cursor = parseGregorianDateStrict(startDateGregorian);

  for (let i = 0; i < 400; i++) {
    const next = addDays(cursor, 1);
    const currentHijri = gregorianToHijri(cursor);
    const nextHijri = gregorianToHijri(next);

    if (currentHijri.month !== nextHijri.month || currentHijri.year !== nextHijri.year) {
      return {
        before: formatGregorianDate(cursor),
        after: formatGregorianDate(next),
      };
    }

    cursor = next;
  }

  throw new Error("Unable to find Hijri month boundary in scan window");
}

function findHijriWeekBoundary(startDateGregorian: string): { before: string; after: string } {
  let cursor = parseGregorianDateStrict(startDateGregorian);

  for (let i = 0; i < 400; i++) {
    const next = addDays(cursor, 1);
    const currentHijri = gregorianToHijri(cursor);
    const nextHijri = gregorianToHijri(next);

    const sameHijriMonth = currentHijri.year === nextHijri.year && currentHijri.month === nextHijri.month;
    if (sameHijriMonth && getHijriWeekIndex(currentHijri.day) !== getHijriWeekIndex(nextHijri.day)) {
      return {
        before: formatGregorianDate(cursor),
        after: formatGregorianDate(next),
      };
    }

    cursor = next;
  }

  throw new Error("Unable to find Hijri week boundary in scan window");
}

function inDateRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

describe("Challenge Hijri Periods", () => {
  it("persists daily Hijri metadata for progress and period", async () => {
    const user = await createTestUser(app, { email: "hijri-daily@test.com" });

    const create = await supertest(app)
      .post("/challenges")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ title: "Daily Hijri", scope: "daily" })
      .expect(201);

    const challengeId = create.body.challenge._id;
    const dateGregorian = "2026-03-12";

    await supertest(app)
      .post(`/challenges/${challengeId}/progress`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        dateGregorian,
        progressValue: 100,
        completed: true,
      })
      .expect(200);

    const detail = await supertest(app)
      .get(`/challenges/${challengeId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    const challenge = detail.body.challenge;
    const progress = challenge.progress.find((p: any) => p.dateGregorian === dateGregorian);
    expect(progress).toBeTruthy();

    const hijri = gregorianToHijri(parseGregorianDateStrict(dateGregorian));
    const expectedPeriodIndex = hijri.year * 10000 + hijri.month * 100 + hijri.day;

    expect(progress.periodIndex).toBe(expectedPeriodIndex);
    expect(progress.hijriYear).toBe(hijri.year);
    expect(progress.hijriMonth).toBe(hijri.month);
    expect(progress.hijriDay).toBe(hijri.day);
    expect(progress.periodStartGregorian).toBe(dateGregorian);
    expect(progress.periodEndGregorian).toBe(dateGregorian);

    expect(challenge.periods).toHaveLength(1);
    expect(challenge.periods[0].hijriYear).toBe(hijri.year);
    expect(challenge.periods[0].hijriMonth).toBe(hijri.month);
    expect(challenge.periods[0].hijriDay).toBe(hijri.day);
    expect(challenge.periods[0].startDateGregorian).toBe(dateGregorian);
    expect(challenge.periods[0].endDateGregorian).toBe(dateGregorian);
  });

  it("splits weekly periods on Hijri week boundary", async () => {
    const boundary = findHijriWeekBoundary("2026-01-01");
    const user = await createTestUser(app, { email: "hijri-weekly@test.com" });

    const create = await supertest(app)
      .post("/challenges")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ title: "Weekly Hijri", scope: "weekly" })
      .expect(201);

    const challengeId = create.body.challenge._id;

    await supertest(app)
      .post(`/challenges/${challengeId}/progress`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ dateGregorian: boundary.before, progressValue: 40, completed: false })
      .expect(200);

    await supertest(app)
      .post(`/challenges/${challengeId}/progress`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ dateGregorian: boundary.after, progressValue: 60, completed: true })
      .expect(200);

    const detail = await supertest(app)
      .get(`/challenges/${challengeId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    const challenge = detail.body.challenge;
    expect(challenge.progress).toHaveLength(2);
    expect(challenge.periods).toHaveLength(2);

    const beforeHijri = gregorianToHijri(parseGregorianDateStrict(boundary.before));
    const afterHijri = gregorianToHijri(parseGregorianDateStrict(boundary.after));

    const beforeProgress = challenge.progress.find((p: any) => p.dateGregorian === boundary.before);
    const afterProgress = challenge.progress.find((p: any) => p.dateGregorian === boundary.after);

    const beforeIndex = beforeHijri.year * 1000 + beforeHijri.month * 10 + getHijriWeekIndex(beforeHijri.day);
    const afterIndex = afterHijri.year * 1000 + afterHijri.month * 10 + getHijriWeekIndex(afterHijri.day);

    expect(beforeProgress.periodIndex).toBe(beforeIndex);
    expect(afterProgress.periodIndex).toBe(afterIndex);
    expect(beforeProgress.periodIndex).not.toBe(afterProgress.periodIndex);

    const beforePeriod = challenge.periods.find((period: any) =>
      inDateRange(boundary.before, period.startDateGregorian, period.endDateGregorian)
    );
    const afterPeriod = challenge.periods.find((period: any) =>
      inDateRange(boundary.after, period.startDateGregorian, period.endDateGregorian)
    );

    expect(beforePeriod).toBeTruthy();
    expect(afterPeriod).toBeTruthy();
    expect(beforePeriod.hijriWeekIndex).not.toBe(afterPeriod.hijriWeekIndex);
  });

  it("splits monthly periods on Hijri month boundary", async () => {
    const boundary = findHijriMonthBoundary("2026-01-01");
    const user = await createTestUser(app, { email: "hijri-monthly@test.com" });

    const create = await supertest(app)
      .post("/challenges")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ title: "Monthly Hijri", scope: "monthly" })
      .expect(201);

    const challengeId = create.body.challenge._id;

    await supertest(app)
      .post(`/challenges/${challengeId}/progress`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ dateGregorian: boundary.before, progressValue: 20, completed: false })
      .expect(200);

    await supertest(app)
      .post(`/challenges/${challengeId}/progress`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ dateGregorian: boundary.after, progressValue: 80, completed: true })
      .expect(200);

    const detail = await supertest(app)
      .get(`/challenges/${challengeId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    const challenge = detail.body.challenge;
    expect(challenge.progress).toHaveLength(2);
    expect(challenge.periods).toHaveLength(2);

    const beforeHijri = gregorianToHijri(parseGregorianDateStrict(boundary.before));
    const afterHijri = gregorianToHijri(parseGregorianDateStrict(boundary.after));

    const beforeProgress = challenge.progress.find((p: any) => p.dateGregorian === boundary.before);
    const afterProgress = challenge.progress.find((p: any) => p.dateGregorian === boundary.after);

    expect(beforeProgress.periodIndex).toBe(beforeHijri.year * 100 + beforeHijri.month);
    expect(afterProgress.periodIndex).toBe(afterHijri.year * 100 + afterHijri.month);

    const beforePeriod = challenge.periods.find((period: any) =>
      inDateRange(boundary.before, period.startDateGregorian, period.endDateGregorian)
    );
    const afterPeriod = challenge.periods.find((period: any) =>
      inDateRange(boundary.after, period.startDateGregorian, period.endDateGregorian)
    );

    expect(beforePeriod).toBeTruthy();
    expect(afterPeriod).toBeTruthy();
    expect(beforePeriod.hijriMonth).not.toBe(afterPeriod.hijriMonth);
  });
});
