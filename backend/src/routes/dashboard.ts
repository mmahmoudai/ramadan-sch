import { Router, Response, NextFunction } from "express";
import { DailyEntry } from "../models/DailyEntry";
import { Challenge } from "../models/Challenge";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { formatGregorianDate, parseGregorianDateStrict } from "../utils/hijri";

export const dashboardRouter = Router();

const SALAH_PREFIXES = new Set(["fajr", "dhuhr", "asr", "maghrib", "isha"]);

export function getFieldCategory(fieldKey: string): string {
  const prefix = fieldKey.split("_")[0] || "other";
  if (SALAH_PREFIXES.has(prefix)) return "salah";
  if (fieldKey === "daily_challenge") return "challenge";
  if (fieldKey === "quran_tracker") return "quran";
  if (fieldKey === "hadith_day") return "hadith";
  // Direct category prefixes that match exactly
  // sawm_, dua_, akhlaq_, sadaqah_, ibadah_, habit_, sunnah_ all resolve correctly via prefix
  return prefix;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

dashboardRouter.get("/summary", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const from = typeof req.query.from === "string" && req.query.from.trim() ? req.query.from.trim() : undefined;
    const to = typeof req.query.to === "string" && req.query.to.trim() ? req.query.to.trim() : undefined;
    // Client sends its local date to avoid UTC vs local timezone mismatch
    const clientToday = typeof req.query.today === "string" && req.query.today.trim() ? req.query.today.trim() : undefined;

    try {
      if (from) parseGregorianDateStrict(from);
      if (to) parseGregorianDateStrict(to);
      if (clientToday) parseGregorianDateStrict(clientToday);
    } catch {
      throw new AppError(400, "Invalid date format. Expected YYYY-MM-DD.");
    }
    if (from && to && from > to) {
      throw new AppError(400, "`from` must be less than or equal to `to`.");
    }

    // Use client-supplied local date as reference; fall back to server UTC only if not provided
    const defaultReferenceDate = clientToday || formatGregorianDate(new Date());
    const referenceDate = to || defaultReferenceDate;

    const entriesFilter: Record<string, unknown> = { userId };
    if (from || to) {
      const dateFilter: Record<string, string> = {};
      if (from) dateFilter.$gte = from;
      if (to) dateFilter.$lte = to;
      entriesFilter.gregorianDate = dateFilter;
    }

    // Only fetch fields we actually need — avoids pulling large unused subdoc data
    const entryProjection = "gregorianDate fields.fieldKey fields.fieldType fields.completed";

    const allEntriesQuery = DailyEntry
      .find(entriesFilter)
      .select(entryProjection)
      .sort({ gregorianDate: -1 })
      .lean();
    if (!from && !to) {
      allEntriesQuery.limit(30);
    }

    // Run all DB queries in parallel
    const [referenceEntry, totalEntries, allEntries, activeChallenges] = await Promise.all([
      DailyEntry.findOne({ userId, gregorianDate: referenceDate }).select(entryProjection).lean(),
      DailyEntry.countDocuments(entriesFilter),
      allEntriesQuery,
      Challenge.find({ userId, active: true }).select("title scope progress active").lean(),
    ]);

    const completionScores: { date: string; score: number; completed: number; total: number }[] = [];
    const categoryMap: Record<string, { total: number; completed: number }> = {};
    const fieldMap: Record<string, { total: number; completed: number; fieldType: string }> = {};
    let totalCompletedItems = 0;
    let totalItemsOverall = 0;

    for (const entry of allEntries) {
      const completed = entry.fields.filter((f) => f.completed).length;
      const total = entry.fields.length;
      totalCompletedItems += completed;
      totalItemsOverall += total;
      completionScores.push({
        date: entry.gregorianDate,
        score: total > 0 ? Math.round((completed / total) * 100) : 0,
        completed,
        total,
      });

      for (const field of entry.fields) {
        const cat = getFieldCategory(field.fieldKey);
        if (!categoryMap[cat]) categoryMap[cat] = { total: 0, completed: 0 };
        categoryMap[cat].total++;
        if (field.completed) categoryMap[cat].completed++;

        if (field.fieldType === "checkbox") {
          if (!fieldMap[field.fieldKey]) fieldMap[field.fieldKey] = { total: 0, completed: 0, fieldType: field.fieldType };
          fieldMap[field.fieldKey].total++;
          if (field.completed) fieldMap[field.fieldKey].completed++;
        }
      }
    }

    const categoryBreakdown = Object.entries(categoryMap)
      .map(([category, val]) => ({
        category,
        total: val.total,
        completed: val.completed,
        rate: val.total > 0 ? Math.round((val.completed / val.total) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate);

    const fieldHighlights = Object.entries(fieldMap)
      .map(([fieldKey, val]) => ({
        fieldKey,
        total: val.total,
        completed: val.completed,
        rate: val.total > 0 ? Math.round((val.completed / val.total) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10);

    const bestDay = completionScores.length > 0
      ? completionScores.reduce((best, cur) => cur.score > best.score ? cur : best, completionScores[0])
      : null;
    const worstDay = completionScores.length > 0
      ? completionScores.reduce((worst, cur) => cur.score < worst.score ? cur : worst, completionScores[0])
      : null;
    const avgScore = completionScores.length > 0
      ? Math.round(completionScores.reduce((s, c) => s + c.score, 0) / completionScores.length)
      : 0;
    const perfectDays = completionScores.filter((s) => s.score === 100).length;

    // Build a date→score lookup once — used by both streak and weekly stats
    const dateSet = new Set(allEntries.map((e) => e.gregorianDate));
    const dateScoreMap = new Map(completionScores.map((s) => [s.date, s.score]));

    // Streak: walk backwards from referenceDate using string arithmetic (no repeated formatGregorianDate)
    let currentStreak = 0;
    let streakCursor = parseGregorianDateStrict(referenceDate);
    const lowerBound = from ? parseGregorianDateStrict(from) : null;
    for (let i = 0; i < 366; i++) {
      const cursorDate = formatGregorianDate(streakCursor);
      if (!dateSet.has(cursorDate)) break;
      currentStreak++;
      const nextCursor = addDays(streakCursor, -1);
      if (lowerBound && nextCursor < lowerBound) break;
      streakCursor = nextCursor;
    }

    // Challenge summary — single-pass filter per challenge
    const challengeSummary = activeChallenges.map((c) => {
      let totalProgress = 0;
      let completedCount = 0;
      for (const p of c.progress) {
        if (from && p.dateGregorian < from) continue;
        if (to && p.dateGregorian > to) continue;
        totalProgress++;
        if (p.completed) completedCount++;
      }
      return { id: c._id, title: c.title, scope: c.scope, totalProgress, completedCount };
    });

    // Weekly aggregation: use pre-built dateScoreMap — O(n) total instead of O(4n)
    const referenceDateValue = parseGregorianDateStrict(referenceDate);
    const weeklyStats: { week: number; avgScore: number; entryCount: number; startDate: string; endDate: string }[] = [];
    for (let w = 0; w < 4; w++) {
      const windowEnd = addDays(referenceDateValue, -(w * 7));
      const windowStart = addDays(windowEnd, -6);
      const windowStartDate = formatGregorianDate(windowStart);
      const windowEndDate = formatGregorianDate(windowEnd);

      let scoreSum = 0;
      let count = 0;
      for (const [date, score] of dateScoreMap) {
        if (date >= windowStartDate && date <= windowEndDate) {
          scoreSum += score;
          count++;
        }
      }

      weeklyStats.push({
        week: w + 1,
        avgScore: count > 0 ? Math.round(scoreSum / count) : 0,
        entryCount: count,
        startDate: windowStartDate,
        endDate: windowEndDate,
      });
    }

    res.json({
      range: {
        from: from || null,
        to: to || null,
        isFiltered: Boolean(from || to),
      },
      today: {
        date: referenceDate,
        hasEntry: !!referenceEntry,
        status: referenceEntry?.status || null,
        completedFields: referenceEntry ? referenceEntry.fields.filter((f) => f.completed).length : 0,
        totalFields: referenceEntry ? referenceEntry.fields.length : 0,
      },
      totalEntries,
      currentStreak,
      completionScores,
      weeklyStats,
      challengeSummary,
      categoryBreakdown,
      fieldHighlights,
      bestDay,
      worstDay,
      avgScore,
      perfectDays,
      totalCompletedItems,
      totalItemsOverall,
    });
  } catch (err) {
    next(err);
  }
});
