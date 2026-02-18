import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { Challenge } from "../models/Challenge";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const challengesRouter = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(""),
  scope: z.enum(["daily", "weekly", "monthly"]),
});

const progressSchema = z.object({
  dateGregorian: z.string(),
  progressValue: z.number().min(0).max(100),
  notes: z.string().max(500).optional().default(""),
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
    const updates: Record<string, unknown> = {};
    if (req.body.title) updates.title = req.body.title;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.active !== undefined) updates.active = req.body.active;

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

    // Calculate periodIndex based on scope and date
    const date = new Date(body.dateGregorian);
    let periodIndex: number;
    if (challenge.scope === "daily") {
      periodIndex = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
    } else if (challenge.scope === "weekly") {
      periodIndex = Math.floor(date.getTime() / (1000 * 60 * 60 * 24 * 7));
    } else {
      periodIndex = date.getFullYear() * 12 + date.getMonth();
    }

    const existingIdx = challenge.progress.findIndex(
      (p) => p.dateGregorian === body.dateGregorian
    );

    const progressEntry = {
      periodIndex,
      dateGregorian: body.dateGregorian,
      progressValue: body.progressValue,
      notes: body.notes,
      completed: body.completed,
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
    const progressDate = new Date(req.params.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (progressDate >= today) {
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
