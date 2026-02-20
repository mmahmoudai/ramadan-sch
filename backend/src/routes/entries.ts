import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { DailyEntry, IDailyEntryField } from "../models/DailyEntry";
import { User } from "../models/User";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { gregorianToHijri } from "../utils/hijri";
import { sanitizeStr } from "../utils/sanitize";

const fieldSchema = z.object({
  fieldKey: z.string().min(1).max(100).transform(sanitizeStr),
  fieldType: z.enum(["checkbox", "text", "radio", "textarea"]),
  completed: z.boolean(),
  value: z.union([z.string().max(2000).transform(sanitizeStr), z.number(), z.boolean(), z.null()]).optional(),
  label: z.string().max(200).transform(sanitizeStr).optional(),
  category: z.string().max(100).transform(sanitizeStr).optional(),
}).passthrough();

const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

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
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (from && !dateRe.test(from)) throw new AppError(400, "Invalid 'from' date format");
    if (to && !dateRe.test(to)) throw new AppError(400, "Invalid 'to' date format");

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
    const date = dateParamSchema.parse(req.params.date);
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
    const date = dateParamSchema.parse(req.params.date);
    const rawFields = req.body?.fields;
    if (!Array.isArray(rawFields)) throw new AppError(400, "fields must be an array");
    if (rawFields.length > 100) throw new AppError(400, "Too many fields");
    const fields = z.array(fieldSchema).parse(rawFields);

    let entry = await DailyEntry.findOne({ userId: req.user!.userId, gregorianDate: date });

    if (entry) {
      if (entry.status === "locked" || new Date() > entry.lockAtUtc) {
        entry.status = "locked";
        await entry.save();
        throw new AppError(423, "Entry is permanently locked");
      }
      entry.fields = fields as unknown as typeof entry.fields;
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
        fields: fields as unknown as IDailyEntryField[],
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
    const date = dateParamSchema.parse(req.params.date);
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
