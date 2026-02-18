/**
 * MongoDB Seed Script
 * Populates the database with sample data for development/testing.
 * Run: npx tsx src/scripts/seed.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../config/db";
import { User } from "../models/User";
import { RefreshToken } from "../models/RefreshToken";
import { DailyEntry } from "../models/DailyEntry";
import { Challenge } from "../models/Challenge";
import { FamilyGroup } from "../models/FamilyGroup";
import { VisibilityApproval } from "../models/VisibilityApproval";
import { Comment } from "../models/Comment";
import { Reaction } from "../models/Reaction";
import { Report } from "../models/Report";
import { AuditLog } from "../models/AuditLog";
import { EmailReminder } from "../models/EmailReminder";

dotenv.config();

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function lockTime(dateStr: string): Date {
  return new Date(dateStr + "T23:59:59Z");
}

async function seed() {
  await connectDB();
  console.log("\n=== Seeding Database ===\n");

  // Clear all collections
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
  await DailyEntry.deleteMany({});
  await Challenge.deleteMany({});
  await FamilyGroup.deleteMany({});
  await VisibilityApproval.deleteMany({});
  await Comment.deleteMany({});
  await Reaction.deleteMany({});
  await Report.deleteMany({});
  await AuditLog.deleteMany({});
  await EmailReminder.deleteMany({});
  console.log("  ✓ Cleared all collections");

  // ─── Users ───
  const adminUser = new User({
    email: "admin@ramadantracker.app",
    passwordHash: "admin123",
    displayName: "Admin",
    role: "admin",
    bio: "System administrator",
    language: "en",
    timezoneIana: "Asia/Riyadh",
    reminderEnabled: false,
  });
  await adminUser.save();

  const user1 = new User({
    email: "ahmad@example.com",
    passwordHash: "password123",
    displayName: "Ahmad",
    bio: "Striving to make the most of Ramadan",
    language: "en",
    timezoneIana: "Asia/Riyadh",
    reminderEnabled: true,
    reminderTimeLocal: "21:00",
  });
  await user1.save();

  const user2 = new User({
    email: "fatima@example.com",
    passwordHash: "password123",
    displayName: "فاطمة",
    bio: "الحمد لله على نعمة رمضان",
    language: "ar",
    timezoneIana: "Asia/Riyadh",
    reminderEnabled: true,
    reminderTimeLocal: "21:00",
  });
  await user2.save();

  const user3 = new User({
    email: "omar@example.com",
    passwordHash: "password123",
    displayName: "Omar",
    bio: "Consistency is key",
    language: "en",
    timezoneIana: "Europe/London",
    reminderEnabled: false,
  });
  await user3.save();

  console.log("  ✓ Created 1 admin (admin@ramadantracker.app / admin123)");
  console.log("  ✓ Created 3 users (ahmad@example.com, fatima@example.com, omar@example.com)");
  console.log("    Password for all regular users: password123");

  // ─── Daily Entries (7 days for user1, 5 for user2) ───
  const ibadahFields = [
    { fieldKey: "ibadah_intention_quran", fieldType: "checkbox" as const, value: true, completed: true },
    { fieldKey: "ibadah_adhkar_focus", fieldType: "checkbox" as const, value: true, completed: true },
    { fieldKey: "ibadah_two_rakaat", fieldType: "checkbox" as const, value: true, completed: true },
    { fieldKey: "ibadah_simple_charity", fieldType: "checkbox" as const, value: false, completed: false },
    { fieldKey: "ibadah_tafsir_page", fieldType: "checkbox" as const, value: true, completed: true },
    { fieldKey: "ibadah_istighfar_100", fieldType: "checkbox" as const, value: true, completed: true },
  ];

  const habitFields = [
    { fieldKey: "habit_no_smoking", fieldType: "checkbox" as const, value: true, completed: true },
    { fieldKey: "habit_walk", fieldType: "checkbox" as const, value: false, completed: false },
    { fieldKey: "habit_no_sugar", fieldType: "checkbox" as const, value: true, completed: true },
    { fieldKey: "habit_healthy_food", fieldType: "checkbox" as const, value: true, completed: true },
    { fieldKey: "habit_water", fieldType: "checkbox" as const, value: true, completed: true },
  ];

  const salahFields = ["fajr", "dhuhr", "asr", "maghrib", "isha"].flatMap((s) =>
    [1, 2, 3].map((n) => ({
      fieldKey: `${s}_${n}`,
      fieldType: "checkbox" as const,
      value: n <= 2,
      completed: n <= 2,
    }))
  );

  const sunnahFields = [
    { fieldKey: "sunnah_morning_dhikr", fieldType: "checkbox" as const, value: true, completed: true },
    { fieldKey: "sunnah_evening_dhikr", fieldType: "checkbox" as const, value: true, completed: true },
    { fieldKey: "sunnah_duha", fieldType: "checkbox" as const, value: false, completed: false },
    { fieldKey: "sunnah_tahajjud", fieldType: "checkbox" as const, value: true, completed: true },
    { fieldKey: "sunnah_tarawih", fieldType: "checkbox" as const, value: true, completed: true },
    { fieldKey: "sunnah_quran", fieldType: "checkbox" as const, value: true, completed: true },
  ];

  const textFields = [
    { fieldKey: "daily_challenge", fieldType: "textarea" as const, value: "Read 5 pages of Quran with reflection", completed: true },
    { fieldKey: "gratitude", fieldType: "textarea" as const, value: "Alhamdulillah for family, health, and guidance", completed: true },
    { fieldKey: "mood", fieldType: "radio" as const, value: "happy", completed: true },
    { fieldKey: "quran_tracker", fieldType: "textarea" as const, value: "Surah Al-Baqarah, pages 10-15", completed: true },
    { fieldKey: "hadith_day", fieldType: "textarea" as const, value: "Whoever fasts Ramadan out of faith and seeking reward, his previous sins will be forgiven.", completed: true },
  ];

  const allFields = [...ibadahFields, ...habitFields, ...salahFields, ...sunnahFields, ...textFields];

  for (let i = 0; i < 7; i++) {
    const dateStr = daysAgo(i);
    const isLocked = i > 0;
    // Vary completion slightly per day
    const dayFields = allFields.map((f, idx) => ({
      ...f,
      value: i === 0 ? f.value : (idx + i) % 3 !== 0 ? f.value : (typeof f.value === "boolean" ? !f.value : f.value),
      completed: i === 0 ? f.completed : (idx + i) % 3 !== 0,
    }));

    await DailyEntry.create({
      userId: user1._id,
      gregorianDate: dateStr,
      hijriYear: 1446,
      hijriMonth: i === 0 ? 8 : 9, // Feb 18 = 30 Sha'ban (month 8), Feb 19+ = Ramadan (month 9)
      hijriDay: i === 0 ? 30 : (i === 1 ? 1 : i), // Feb 18 = 30 Sha'ban, Feb 19 = 1 Ramadan
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: lockTime(dateStr),
      status: isLocked ? "locked" : "open",
      fields: dayFields,
    });
  }
  console.log("  ✓ Created 7 daily entries for Ahmad");

  for (let i = 0; i < 5; i++) {
    const dateStr = daysAgo(i);
    const isLocked = i > 0;
    await DailyEntry.create({
      userId: user2._id,
      gregorianDate: dateStr,
      hijriYear: 1446,
      hijriMonth: i === 0 ? 8 : 9, // Feb 18 = 30 Sha'ban (month 8), Feb 19+ = Ramadan (month 9)
      hijriDay: i === 0 ? 30 : (i === 1 ? 1 : i), // Feb 18 = 30 Sha'ban, Feb 19 = 1 Ramadan
      timezoneSnapshot: "Asia/Riyadh",
      lockAtUtc: lockTime(dateStr),
      status: isLocked ? "locked" : "open",
      fields: allFields.slice(0, 20).map((f, idx) => ({
        ...f,
        completed: (idx + i) % 2 === 0,
        value: typeof f.value === "boolean" ? (idx + i) % 2 === 0 : f.value,
      })),
    });
  }
  console.log("  ✓ Created 5 daily entries for Fatima");

  // ─── Challenges ───
  const ch1 = await Challenge.create({
    userId: user1._id,
    title: "Read 1 Juz Daily",
    description: "Complete the entire Quran during Ramadan by reading one juz each day",
    scope: "daily",
    active: true,
    progress: [
      { periodIndex: 0, dateGregorian: daysAgo(6), progressValue: 100, notes: "Juz 1 complete", completed: true },
      { periodIndex: 0, dateGregorian: daysAgo(5), progressValue: 100, notes: "Juz 2 complete", completed: true },
      { periodIndex: 0, dateGregorian: daysAgo(4), progressValue: 80, notes: "Almost done with Juz 3", completed: false },
      { periodIndex: 0, dateGregorian: daysAgo(3), progressValue: 100, notes: "Juz 4 complete", completed: true },
      { periodIndex: 0, dateGregorian: daysAgo(2), progressValue: 100, notes: "Juz 5 complete", completed: true },
      { periodIndex: 0, dateGregorian: daysAgo(1), progressValue: 50, notes: "Half of Juz 6", completed: false },
    ],
  });

  const ch2 = await Challenge.create({
    userId: user1._id,
    title: "No Social Media After Iftar",
    description: "Avoid scrolling social media from iftar to suhoor",
    scope: "daily",
    active: true,
    progress: [
      { periodIndex: 0, dateGregorian: daysAgo(3), progressValue: 100, completed: true },
      { periodIndex: 0, dateGregorian: daysAgo(2), progressValue: 100, completed: true },
      { periodIndex: 0, dateGregorian: daysAgo(1), progressValue: 0, notes: "Slipped today", completed: false },
    ],
  });

  await Challenge.create({
    userId: user1._id,
    title: "Weekly Sadaqah",
    description: "Give charity every week during Ramadan",
    scope: "weekly",
    active: true,
    progress: [
      { periodIndex: 0, dateGregorian: daysAgo(5), progressValue: 100, notes: "Donated to local masjid", completed: true },
    ],
  });

  await Challenge.create({
    userId: user2._id,
    title: "حفظ سورة الملك",
    description: "حفظ سورة الملك كاملة خلال رمضان",
    scope: "monthly",
    active: true,
    progress: [
      { periodIndex: 0, dateGregorian: daysAgo(4), progressValue: 30, notes: "آيات ١-١٠", completed: false },
    ],
  });

  console.log("  ✓ Created 4 challenges (3 for Ahmad, 1 for Fatima)");

  // ─── Family Group ───
  const family = await FamilyGroup.create({
    ownerUserId: user1._id,
    name: "Al-Rahman Family",
    members: [
      { userId: user1._id, role: "owner", status: "active", joinedAt: new Date() },
      { userId: user2._id, role: "member", status: "active", joinedAt: new Date() },
      { userId: user3._id, role: "member", status: "invited", joinedAt: new Date() },
    ],
  });
  console.log("  ✓ Created 1 family group with 3 members");

  // ─── Visibility Approvals ───
  await VisibilityApproval.create({
    ownerUserId: user1._id,
    viewerUserId: user2._id,
    scope: "dashboard",
    status: "approved",
  });

  await VisibilityApproval.create({
    ownerUserId: user2._id,
    viewerUserId: user1._id,
    scope: "dashboard",
    status: "approved",
  });

  await VisibilityApproval.create({
    ownerUserId: user1._id,
    viewerUserId: user3._id,
    scope: "reports",
    status: "pending",
  });

  console.log("  ✓ Created 3 visibility approvals");

  // ─── Comments & Reactions ───
  const entry1 = await DailyEntry.findOne({ userId: user1._id, gregorianDate: daysAgo(1) });
  if (entry1) {
    await Comment.create({
      ownerUserId: user1._id,
      authorUserId: user2._id,
      targetType: "daily_entry",
      targetId: entry1._id,
      body: "ما شاء الله! Keep it up Ahmad!",
    });

    await Comment.create({
      ownerUserId: user1._id,
      authorUserId: user2._id,
      targetType: "daily_entry",
      targetId: entry1._id,
      body: "بارك الله فيك",
    });

    await Reaction.create({
      ownerUserId: user1._id,
      authorUserId: user2._id,
      targetType: "daily_entry",
      targetId: entry1._id,
      reactionType: "mashallah",
    });

    await Reaction.create({
      ownerUserId: user1._id,
      authorUserId: user3._id,
      targetType: "daily_entry",
      targetId: entry1._id,
      reactionType: "love",
    });
  }
  console.log("  ✓ Created 2 comments and 2 reactions");

  // ─── Reports ───
  const report1 = await Report.create({
    ownerUserId: user1._id,
    periodScope: "weekly",
    periodStart: daysAgo(6),
    periodEnd: daysAgo(0),
    visibility: "public",
    includeProfileInfo: true,
  });

  await Report.create({
    ownerUserId: user1._id,
    periodScope: "daily",
    periodStart: daysAgo(1),
    periodEnd: daysAgo(1),
    visibility: "private",
    includeProfileInfo: false,
  });

  await Report.create({
    ownerUserId: user2._id,
    periodScope: "weekly",
    periodStart: daysAgo(6),
    periodEnd: daysAgo(0),
    visibility: "public",
    includeProfileInfo: true,
  });

  console.log("  ✓ Created 3 reports (2 for Ahmad, 1 for Fatima)");

  // ─── Audit Logs ───
  await AuditLog.create({ actorUserId: user1._id, action: "signup", targetType: "user", targetId: user1._id.toString() });
  await AuditLog.create({ actorUserId: user2._id, action: "signup", targetType: "user", targetId: user2._id.toString() });
  await AuditLog.create({ actorUserId: user3._id, action: "signup", targetType: "user", targetId: user3._id.toString() });
  await AuditLog.create({ actorUserId: user1._id, action: "family_invite", targetType: "family_group", targetId: family._id.toString(), metadata: { inviteeId: user2._id } });
  console.log("  ✓ Created 4 audit log entries");

  // ─── Email Reminders ───
  await EmailReminder.create({ userId: user1._id, sendAtUtc: new Date(daysAgo(1) + "T18:00:00Z"), status: "sent", reason: "Reminder sent successfully" });
  await EmailReminder.create({ userId: user1._id, sendAtUtc: new Date(daysAgo(2) + "T18:00:00Z"), status: "skipped", reason: "Day already complete" });
  await EmailReminder.create({ userId: user2._id, sendAtUtc: new Date(daysAgo(1) + "T18:00:00Z"), status: "sent", reason: "Reminder sent successfully" });
  console.log("  ✓ Created 3 email reminder records");

  // ─── Summary ───
  console.log("\n=== Seed Complete ===");
  console.log("\nTest accounts:");
  console.log("  0. admin@ramadantracker.app / admin123   (Admin)");
  console.log("  1. ahmad@example.com  / password123  (English, 7 entries, 3 challenges)");
  console.log("  2. fatima@example.com / password123  (Arabic, 5 entries, 1 challenge)");
  console.log("  3. omar@example.com   / password123  (English, invited to family)");
  console.log(`\nPublic report link token: ${report1.publicToken}`);
  console.log("");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
