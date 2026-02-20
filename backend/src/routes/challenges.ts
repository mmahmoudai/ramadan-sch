import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { sanitizeStr } from "../utils/sanitize";
import { Challenge } from "../models/Challenge";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { getHijriChallengePeriodMetadata } from "../utils/hijri";

export const challengesRouter = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200).transform(sanitizeStr),
  description: z.string().max(1000).optional().default("").transform(sanitizeStr),
  scope: z.enum(["daily", "weekly", "monthly"]),
});

const patchSchema = z.object({
  title: z.string().min(1).max(200).transform(sanitizeStr).optional(),
  description: z.string().max(1000).transform(sanitizeStr).optional(),
  active: z.boolean().optional(),
});

const progressSchema = z.object({
  dateGregorian: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateGregorian must be YYYY-MM-DD"),
  progressValue: z.number().min(0).max(100),
  notes: z.string().max(500).optional().default("").transform(sanitizeStr),
  completed: z.boolean().optional().default(false),
});

challengesRouter.get("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { active } = req.query;
    const filter: Record<string, unknown> = { userId: req.user!.userId };
    if (active !== undefined) filter.active = active === "true";
    const challenges = await Challenge.find(filter).sort({ createdAt: -1 });
    res.json({ challenges });
  } catch (err) {
    next(err);
  }
});

challengesRouter.get("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const challenge = await Challenge.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!challenge) throw new AppError(404, "Challenge not found");
    res.json({ challenge });
  } catch (err) {
    next(err);
  }
});

challengesRouter.post("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const challenge = new Challenge({
      userId: req.user!.userId,
      title: body.title,
      description: body.description,
      scope: body.scope,
      active: true,
      periods: [],
      progress: [],
    });
    await challenge.save();
    res.status(201).json({ challenge });
  } catch (err) {
    next(err);
  }
});

challengesRouter.patch("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = patchSchema.parse(req.body);
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.active !== undefined) updates.active = body.active;

    if (Object.keys(updates).length === 0) throw new AppError(400, "No valid fields to update");

    const challenge = await Challenge.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.userId },
      { $set: updates },
      { new: true }
    );
    if (!challenge) throw new AppError(404, "Challenge not found");
    res.json({ challenge });
  } catch (err) {
    next(err);
  }
});

challengesRouter.post("/:id/progress", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = progressSchema.parse(req.body);
    const challenge = await Challenge.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!challenge) throw new AppError(404, "Challenge not found");

    let periodMetadata: ReturnType<typeof getHijriChallengePeriodMetadata>;
    try {
      periodMetadata = getHijriChallengePeriodMetadata(body.dateGregorian, challenge.scope);
    } catch {
      throw new AppError(400, "Invalid dateGregorian. Expected YYYY-MM-DD.");
    }

    const existingIdx = challenge.progress.findIndex(
      (p) => p.dateGregorian === body.dateGregorian
    );

    const hasPeriod = challenge.periods.some(
      (period) =>
        period.hijriYear === periodMetadata.hijriYear &&
        (period.hijriMonth ?? null) === periodMetadata.hijriMonth &&
        (period.hijriDay ?? null) === periodMetadata.hijriDay &&
        (period.hijriWeekIndex ?? null) === periodMetadata.hijriWeekIndex &&
        period.startDateGregorian === periodMetadata.startDateGregorian &&
        period.endDateGregorian === periodMetadata.endDateGregorian
    );

    if (!hasPeriod) {
      challenge.periods.push({
        hijriYear: periodMetadata.hijriYear,
        hijriMonth: periodMetadata.hijriMonth,
        hijriDay: periodMetadata.hijriDay,
        hijriWeekIndex: periodMetadata.hijriWeekIndex,
        startDateGregorian: periodMetadata.startDateGregorian,
        endDateGregorian: periodMetadata.endDateGregorian,
      });
      challenge.periods.sort((a, b) => a.startDateGregorian.localeCompare(b.startDateGregorian));
    }

    const progressEntry = {
      periodIndex: periodMetadata.periodIndex,
      dateGregorian: body.dateGregorian,
      progressValue: body.progressValue,
      notes: body.notes,
      completed: body.completed,
      hijriYear: periodMetadata.hijriYear,
      hijriMonth: periodMetadata.hijriMonth,
      hijriDay: periodMetadata.hijriDay,
      hijriWeekIndex: periodMetadata.hijriWeekIndex,
      periodStartGregorian: periodMetadata.startDateGregorian,
      periodEndGregorian: periodMetadata.endDateGregorian,
    };

    if (existingIdx >= 0) {
      challenge.progress[existingIdx] = progressEntry;
    } else {
      challenge.progress.push(progressEntry);
    }

    await challenge.save();
    res.json({ challenge });
  } catch (err) {
    next(err);
  }
});

challengesRouter.delete("/:id/progress/:date", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const challenge = await Challenge.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!challenge) throw new AppError(404, "Challenge not found");

    // Only allow deleting past dates (not today or future)
    // Use string comparison — dates are stored as "YYYY-MM-DD" strings
    const n = new Date();
    const todayStr = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    if (req.params.date >= todayStr) {
      throw new AppError(400, "Cannot delete progress for today or future dates");
    }

    challenge.progress = challenge.progress.filter(p => p.dateGregorian !== req.params.date);
    await challenge.save();
    res.json({ challenge });
  } catch (err) {
    next(err);
  }
});

challengesRouter.delete("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const challenge = await Challenge.findOneAndDelete({ _id: req.params.id, userId: req.user!.userId });
    if (!challenge) throw new AppError(404, "Challenge not found");
    res.json({ message: "Challenge deleted" });
  } catch (err) {
    next(err);
  }
});
