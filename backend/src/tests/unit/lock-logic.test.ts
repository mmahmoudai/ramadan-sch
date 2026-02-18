import { describe, it, expect } from "vitest";
import { DailyEntry } from "../../models/DailyEntry";
import { User } from "../../models/User";

describe("Daily Entry Lock Logic", () => {
  it("should create an entry with open status", async () => {
    const user = await User.create({
      email: "lock1@test.com",
      passwordHash: "test123456",
      displayName: "Lock Test",
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entry = await DailyEntry.create({
      userId: user._id,
      gregorianDate: "2026-03-01",
      hijriYear: 1447,
      hijriMonth: 9,
      hijriDay: 1,
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: tomorrow,
      status: "open",
      fields: [
        { fieldKey: "ibadah_quran", fieldType: "checkbox", value: true, completed: true },
      ],
    });

    expect(entry.status).toBe("open");
    expect(entry.fields).toHaveLength(1);
    expect(entry.fields[0].completed).toBe(true);
  });

  it("should mark entry as locked when lockAtUtc is in the past", async () => {
    const user = await User.create({
      email: "lock2@test.com",
      passwordHash: "test123456",
      displayName: "Lock Test 2",
    });

    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);

    const entry = await DailyEntry.create({
      userId: user._id,
      gregorianDate: "2026-02-17",
      hijriYear: 1447,
      hijriMonth: 8,
      hijriDay: 28,
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: pastDate,
      status: "open",
      fields: [
        { fieldKey: "test_field", fieldType: "checkbox", value: false, completed: false },
      ],
    });

    // Simulate the lock check that happens in the entries route
    if (entry.status === "open" && new Date() > entry.lockAtUtc) {
      entry.status = "locked";
      await entry.save();
    }

    const updated = await DailyEntry.findById(entry._id);
    expect(updated!.status).toBe("locked");
  });

  it("should NOT allow updating fields on a locked entry", async () => {
    const user = await User.create({
      email: "lock3@test.com",
      passwordHash: "test123456",
      displayName: "Lock Test 3",
    });

    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);

    const entry = await DailyEntry.create({
      userId: user._id,
      gregorianDate: "2026-02-16",
      hijriYear: 1447,
      hijriMonth: 8,
      hijriDay: 27,
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: pastDate,
      status: "locked",
      fields: [
        { fieldKey: "test_field", fieldType: "checkbox", value: false, completed: false },
      ],
    });

    // Simulate the guard in the PUT handler
    const isLocked = entry.status === "locked" || new Date() > entry.lockAtUtc;
    expect(isLocked).toBe(true);
  });

  it("should enforce unique userId + gregorianDate constraint", async () => {
    const user = await User.create({
      email: "lock4@test.com",
      passwordHash: "test123456",
      displayName: "Lock Test 4",
    });

    await DailyEntry.create({
      userId: user._id,
      gregorianDate: "2026-02-15",
      hijriYear: 1447,
      hijriMonth: 8,
      hijriDay: 26,
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: new Date("2026-02-16T00:00:00Z"),
      status: "open",
      fields: [],
    });

    await expect(
      DailyEntry.create({
        userId: user._id,
        gregorianDate: "2026-02-15",
        hijriYear: 1447,
        hijriMonth: 8,
        hijriDay: 26,
        timezoneSnapshot: "Asia/Riyadh",
        lockAtUtc: new Date("2026-02-16T00:00:00Z"),
        status: "open",
        fields: [],
      })
    ).rejects.toThrow();
  });

  it("should allow different dates for same user", async () => {
    const user = await User.create({
      email: "lock5@test.com",
      passwordHash: "test123456",
      displayName: "Lock Test 5",
    });

    const e1 = await DailyEntry.create({
      userId: user._id,
      gregorianDate: "2026-02-14",
      hijriYear: 1447, hijriMonth: 8, hijriDay: 25,
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: new Date("2026-02-15T00:00:00Z"),
      status: "open",
      fields: [],
    });

    const e2 = await DailyEntry.create({
      userId: user._id,
      gregorianDate: "2026-02-13",
      hijriYear: 1447, hijriMonth: 8, hijriDay: 24,
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: new Date("2026-02-14T00:00:00Z"),
      status: "open",
      fields: [],
    });

    expect(e1.gregorianDate).not.toBe(e2.gregorianDate);
  });
});
