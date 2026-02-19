import cron from "node-cron";
import { User } from "../models/User";
import { DailyEntry } from "../models/DailyEntry";
import { EmailReminder } from "../models/EmailReminder";
import { sendDailyReminderEmail } from "../utils/mailer";

async function processReminders() {
  console.log("[CRON] Processing reminders...");
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // List of valid IANA timezones
  const validTimezones = [
    "Africa/Cairo", "Africa/Casablanca", "Asia/Riyadh", "Asia/Dubai",
    "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain", "Europe/London",
    "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Los_Angeles",
    "America/Chicago", "UTC", "Asia/Istanbul", "Asia/Jerusalem"
  ];

  try {
    const users = await User.find({ reminderEnabled: true });

    for (const user of users) {
      try {
        // Validate and fix timezone
        let userTimezone = user.timezoneIana || "Asia/Riyadh";
        
        // Fix common invalid timezone values
        if (userTimezone === "Egypt\Cairo" || userTimezone === "Cairo") {
          userTimezone = "Africa/Cairo";
        } else if (userTimezone === "Casablanca") {
          userTimezone = "Africa/Casablanca";
        } else if (userTimezone === "Cairo/Egy") {
          userTimezone = "Africa/Cairo";
        }
        
        // If timezone is still invalid, use default
        if (!validTimezones.includes(userTimezone)) {
          userTimezone = "Asia/Riyadh";
          // Update user's timezone in database
          await User.findByIdAndUpdate(user._id, { timezoneIana: userTimezone });
        }

        // Compute user's local time
        const userLocalStr = now.toLocaleString("en-US", { timeZone: userTimezone });
        const userLocal = new Date(userLocalStr);
        const userHour = userLocal.getHours();
        const userMinute = userLocal.getMinutes();

        // Only send at 9 PM local (21:00), within a 15 min window
        const targetHour = parseInt(user.reminderTimeLocal?.split(":")[0] || "21");
        if (userHour !== targetHour || userMinute > 15) continue;

        // Check if already sent today
        const alreadySent = await EmailReminder.findOne({
          userId: user._id,
          sendAtUtc: { $gte: new Date(today), $lt: new Date(today + "T23:59:59Z") },
          status: { $in: ["sent", "skipped"] },
        });
        if (alreadySent) continue;

        // Check if day is already complete
        const entry = await DailyEntry.findOne({ userId: user._id, gregorianDate: today });
        if (entry) {
          const completed = entry.fields.filter((f) => f.completed).length;
          if (completed === entry.fields.length && entry.fields.length > 0) {
            await EmailReminder.create({
              userId: user._id,
              sendAtUtc: now,
              status: "skipped",
              reason: "Day already complete",
            });
            continue;
          }
        }

        // Send reminder email
        const isArabic = user.language === "ar";

        try {
          await sendDailyReminderEmail(user.email, user.displayName, isArabic);

          await EmailReminder.create({
            userId: user._id,
            sendAtUtc: now,
            status: "sent",
            reason: "Reminder sent successfully",
          });
          console.log(`[CRON] Reminder sent to ${user.email}`);
        } catch (emailErr) {
          await EmailReminder.create({
            userId: user._id,
            sendAtUtc: now,
            status: "failed",
            reason: String(emailErr),
          });
          console.error(`[CRON] Failed to send to ${user.email}:`, emailErr);
        }
      } catch (userErr) {
        console.error(`[CRON] Error processing user ${user._id}:`, userErr);
      }
    }
  } catch (err) {
    console.error("[CRON] Reminder job error:", err);
  }
}

export function startReminderCron() {
  // Run every 15 minutes to catch users in different timezones at their 9 PM
  cron.schedule("*/15 * * * *", processReminders);
  console.log("[CRON] Reminder cron started (every 15 min)");
}
