import { Router, Response, NextFunction } from "express";
import { DailyEntry } from "../models/DailyEntry";
import { Challenge } from "../models/Challenge";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const today = new Date().toISOString().split("T")[0];

    const todayEntry = await DailyEntry.findOne({ userId, gregorianDate: today });
    const totalEntries = await DailyEntry.countDocuments({ userId });

    const allEntries = await DailyEntry.find({ userId }).sort({ gregorianDate: -1 }).limit(30);

    let completionScores: { date: string; score: number; total: number }[] = [];
    for (const entry of allEntries) {
      const completed = entry.fields.filter((f) => f.completed).length;
      const total = entry.fields.length;
      completionScores.push({
        date: entry.gregorianDate,
        score: total > 0 ? Math.round((completed / total) * 100) : 0,
        total,
      });
    }

    // Streak calculation
    let currentStreak = 0;
    const sortedDates = allEntries.map((e) => e.gregorianDate).sort().reverse();
    for (let i = 0; i < sortedDates.length; i++) {
      const expected = new Date();
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split("T")[0];
      if (sortedDates[i] === expectedStr) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Challenge summary
    const activeChallenges = await Challenge.find({ userId, active: true });
    const challengeSummary = activeChallenges.map((c) => ({
      id: c._id,
      title: c.title,
      scope: c.scope,
      totalProgress: c.progress.length,
      completedCount: c.progress.filter((p) => p.completed).length,
    }));

    // Weekly aggregation (last 4 weeks)
    const weeklyStats: { week: number; avgScore: number; entryCount: number }[] = [];
    for (let w = 0; w < 4; w++) {
      const weekEntries = allEntries.filter((e) => {
        const d = new Date(e.gregorianDate);
        const now = new Date();
        const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= w * 7 && diff < (w + 1) * 7;
      });
      const scores = weekEntries.map((e) => {
        const completed = e.fields.filter((f) => f.completed).length;
        return e.fields.length > 0 ? (completed / e.fields.length) * 100 : 0;
      });
      weeklyStats.push({
        week: w + 1,
        avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        entryCount: weekEntries.length,
      });
    }

    res.json({
      today: {
        date: today,
        hasEntry: !!todayEntry,
        status: todayEntry?.status || null,
        completedFields: todayEntry ? todayEntry.fields.filter((f) => f.completed).length : 0,
        totalFields: todayEntry ? todayEntry.fields.length : 0,
      },
      totalEntries,
      currentStreak,
      completionScores,
      weeklyStats,
      challengeSummary,
    });
  } catch (err) {
    next(err);
  }
});
