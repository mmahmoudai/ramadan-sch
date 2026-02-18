import { describe, it, expect } from "vitest";
import { Challenge } from "../../models/Challenge";
import { User } from "../../models/User";

describe("Challenge Model", () => {
  it("should create a daily challenge", async () => {
    const user = await User.create({
      email: "ch1@test.com",
      passwordHash: "test123456",
      displayName: "Ch Test",
    });

    const ch = await Challenge.create({
      userId: user._id,
      title: "Read 1 Juz",
      description: "Complete one juz per day",
      scope: "daily",
      active: true,
      progress: [],
    });

    expect(ch.title).toBe("Read 1 Juz");
    expect(ch.scope).toBe("daily");
    expect(ch.active).toBe(true);
    expect(ch.progress).toHaveLength(0);
  });

  it("should track progress entries", async () => {
    const user = await User.create({
      email: "ch2@test.com",
      passwordHash: "test123456",
      displayName: "Ch Test 2",
    });

    const ch = await Challenge.create({
      userId: user._id,
      title: "Weekly Sadaqah",
      scope: "weekly",
      active: true,
      progress: [
        { periodIndex: 0, dateGregorian: "2026-02-12", progressValue: 100, completed: true },
        { periodIndex: 1, dateGregorian: "2026-02-19", progressValue: 50, completed: false },
      ],
    });

    expect(ch.progress).toHaveLength(2);
    expect(ch.progress[0].completed).toBe(true);
    expect(ch.progress[1].progressValue).toBe(50);
  });

  it("should allow multiple active challenges per user", async () => {
    const user = await User.create({
      email: "ch3@test.com",
      passwordHash: "test123456",
      displayName: "Ch Test 3",
    });

    await Challenge.create({ userId: user._id, title: "Ch A", scope: "daily", active: true });
    await Challenge.create({ userId: user._id, title: "Ch B", scope: "weekly", active: true });
    await Challenge.create({ userId: user._id, title: "Ch C", scope: "monthly", active: true });

    const active = await Challenge.find({ userId: user._id, active: true });
    expect(active).toHaveLength(3);
  });

  it("should deactivate a challenge", async () => {
    const user = await User.create({
      email: "ch4@test.com",
      passwordHash: "test123456",
      displayName: "Ch Test 4",
    });

    const ch = await Challenge.create({ userId: user._id, title: "Deactivate me", scope: "daily", active: true });
    ch.active = false;
    await ch.save();

    const updated = await Challenge.findById(ch._id);
    expect(updated!.active).toBe(false);
  });

  it("should validate scope enum", async () => {
    const user = await User.create({
      email: "ch5@test.com",
      passwordHash: "test123456",
      displayName: "Ch Test 5",
    });

    await expect(
      Challenge.create({ userId: user._id, title: "Bad scope", scope: "yearly" as any, active: true })
    ).rejects.toThrow();
  });
});
