import { Router, Response, NextFunction } from "express";
import { EmailReminder } from "../models/EmailReminder";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const reminderRouter = Router();

reminderRouter.get("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reminders = await EmailReminder.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(30);
    res.json({ reminders });
  } catch (err) {
    next(err);
  }
});

reminderRouter.get("/stats", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const total = await EmailReminder.countDocuments({ userId: req.user!.userId });
    const sent = await EmailReminder.countDocuments({ userId: req.user!.userId, status: "sent" });
    const skipped = await EmailReminder.countDocuments({ userId: req.user!.userId, status: "skipped" });
    const failed = await EmailReminder.countDocuments({ userId: req.user!.userId, status: "failed" });
    res.json({ total, sent, skipped, failed });
  } catch (err) {
    next(err);
  }
});
