import { Router, Response, NextFunction } from "express";
import { DailyEntry } from "../models/DailyEntry";
import { User } from "../models/User";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { gregorianToHijri } from "../utils/hijri";

export const entriesRouter = Router();

function computeLockAtUtc(dateStr: string, timezoneIana: string): Date {
  const dayEnd = new Date(dateStr + "T23:59:59");
  const offsetMs = getTimezoneOffsetMs(timezoneIana, dayEnd);
  return new Date(dayEnd.getTime() - offsetMs);
}

function getTimezoneOffsetMs(tz: string, date: Date): number {
  try {
    const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
    const tzStr = date.toLocaleString("en-US", { timeZone: tz });
    return new Date(tzStr).getTime() - new Date(utcStr).getTime();
  } catch {
    return 3 * 60 * 60 * 1000;
  }
}

entriesRouter.get("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query;
    const filter: Record<string, unknown> = { userId: req.user!.userId };
    if (from || to) {
      filter.gregorianDate = {};
      if (from) (filter.gregorianDate as Record<string, unknown>).$gte = from;
      if (to) (filter.gregorianDate as Record<string, unknown>).$lte = to;
    }
    const entries = await DailyEntry.find(filter).sort({ gregorianDate: -1 });
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

entriesRouter.get("/:date", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date } = req.params;
    const entry = await DailyEntry.findOne({ userId: req.user!.userId, gregorianDate: date });
    if (!entry) return res.json({ entry: null });

    if (entry.status === "open" && new Date() > entry.lockAtUtc) {
      entry.status = "locked";
      await entry.save();
    }

    res.json({ entry });
  } catch (err) {
    next(err);
  }
});

entriesRouter.put("/:date", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date } = req.params;
    const { fields } = req.body;

    let entry = await DailyEntry.findOne({ userId: req.user!.userId, gregorianDate: date });

    if (entry) {
      if (entry.status === "locked" || new Date() > entry.lockAtUtc) {
        entry.status = "locked";
        await entry.save();
        throw new AppError(423, "Entry is permanently locked");
      }
      entry.fields = fields || [];
      await entry.save();
    } else {
      const user = await User.findById(req.user!.userId);
      if (!user) throw new AppError(404, "User not found");

      const gDate = new Date(date);
      const hijri = gregorianToHijri(gDate);
      const tz = user.timezoneIana || "Asia/Riyadh";

      entry = new DailyEntry({
        userId: req.user!.userId,
        gregorianDate: date,
        hijriYear: hijri.year,
        hijriMonth: hijri.month,
        hijriDay: hijri.day,
        timezoneSnapshot: tz,
        lockAtUtc: computeLockAtUtc(date, tz),
        status: "open",
        fields: fields || [],
      });
      await entry.save();
    }

    res.json({ entry });
  } catch (err) {
    next(err);
  }
});

entriesRouter.post("/:date/submit", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date } = req.params;
    const entry = await DailyEntry.findOne({ userId: req.user!.userId, gregorianDate: date });
    if (!entry) throw new AppError(404, "Entry not found");

    if (entry.status === "locked" || new Date() > entry.lockAtUtc) {
      entry.status = "locked";
      await entry.save();
      throw new AppError(423, "Entry is permanently locked");
    }

    res.json({ entry, message: "Entry submitted (still editable until day end)" });
  } catch (err) {
    next(err);
  }
});
