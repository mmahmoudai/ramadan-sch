import mongoose, { PipelineStage, Types } from "mongoose";
import { Router, Response, NextFunction } from "express";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { DailyEntry } from "../models/DailyEntry";
import { Challenge } from "../models/Challenge";
import { Report } from "../models/Report";
import { AuditLog } from "../models/AuditLog";
import { EmailReminder } from "../models/EmailReminder";
import { FamilyGroup } from "../models/FamilyGroup";
import { RefreshToken } from "../models/RefreshToken";
import { VisibilityApproval } from "../models/VisibilityApproval";
import { Comment } from "../models/Comment";
import { Reaction } from "../models/Reaction";
import { AppError } from "../middleware/errorHandler";
import { formatGregorianDate, parseGregorianDateStrict } from "../utils/hijri";
import { sendPasswordResetEmail } from "../utils/mailer";
import { adminMutationLimiter } from "../middleware/rateLimiter";

export const adminRouter = Router();

// All admin routes require auth + admin role
adminRouter.use(requireAuth, requireAdmin);

const SUPPORTED_LANGUAGES = new Set(["ar", "en", "tr"]);
const SUPPORTED_ROLES = new Set(["user", "admin"]);
const SUPPORTED_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "displayName",
  "email",
  "role",
  "language",
  "entryCount",
  "lastActivityAt",
]);
const TIME_LOCAL_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface DateRangeResult {
  from: string | null;
  to: string | null;
  fromDate?: Date;
  toDateExclusive?: Date;
}

interface DailyCountRow {
  _id: {
    year: number;
    month: number;
    day: number;
  };
  count: number;
}

interface TopUserRow {
  _id: Types.ObjectId;
  entryCount: number;
  lastActivityAt: Date | null;
}

interface TopFamilyRow {
  _id: Types.ObjectId;
  name: string;
  ownerUserId: Types.ObjectId;
  memberCount: number;
  activityCount: number;
}

interface AggregatedUserRow {
  _id: Types.ObjectId;
  email: string;
  displayName: string;
  role: "user" | "admin";
  language: "ar" | "en" | "tr";
  reminderEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  entryCount: number;
  lastActivityAt: Date | null;
}

interface UsersFacetResult {
  metadata: Array<{ total: number }>;
  users: AggregatedUserRow[];
}

interface StatusCountRow {
  _id: string;
  count: number;
}

interface ScopeCountRow {
  _id: "daily" | "weekly" | "monthly";
  count: number;
}

type EditableUserUpdates = Partial<{
  displayName: string;
  bio: string;
  language: "ar" | "en" | "tr";
  timezoneIana: string;
  timezoneSource: "auto" | "manual";
  reminderEnabled: boolean;
  reminderTimeLocal: string;
}>;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function parseDateParam(raw: unknown, key: string): string | null {
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  const value = raw.trim();
  try {
    parseGregorianDateStrict(value);
  } catch {
    throw new AppError(400, `Invalid ${key} date format. Expected YYYY-MM-DD.`);
  }
  return value;
}

function parseDateRange(
  fromRaw: unknown,
  toRaw: unknown,
  fromKey: string,
  toKey: string
): DateRangeResult {
  const from = parseDateParam(fromRaw, fromKey);
  const to = parseDateParam(toRaw, toKey);

  if (from && to && from > to) {
    throw new AppError(400, `\`${fromKey}\` must be less than or equal to \`${toKey}\`.`);
  }

  const result: DateRangeResult = { from, to };
  if (from) {
    result.fromDate = startOfDay(parseGregorianDateStrict(from));
  }
  if (to) {
    result.toDateExclusive = startOfDay(addDays(parseGregorianDateStrict(to), 1));
  }
  return result;
}

function buildDateRangeMatch(fromDate?: Date, toDateExclusive?: Date): Record<string, Date> | undefined {
  const match: Record<string, Date> = {};
  if (fromDate) match.$gte = fromDate;
  if (toDateExclusive) match.$lt = toDateExclusive;
  return Object.keys(match).length > 0 ? match : undefined;
}

function parseEnumParam(raw: unknown, key: string, allowed: Set<string>): string | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const value = raw.trim();
  if (!allowed.has(value)) {
    throw new AppError(400, `Invalid ${key} value.`);
  }
  return value;
}

function parseBooleanParam(raw: unknown, key: string): boolean | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") {
    throw new AppError(400, `Invalid ${key} value. Expected true or false.`);
  }
  const value = raw.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  throw new AppError(400, `Invalid ${key} value. Expected true or false.`);
}

function parsePaginationInt(raw: unknown, fallback: number, min: number, max: number, key: string): number {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value)) throw new AppError(400, `Invalid ${key} value.`);
  return Math.max(min, Math.min(max, value));
}

function parseRequiredReason(raw: unknown): string {
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (reason.length < 3) {
    throw new AppError(400, "Action reason is required and must be at least 3 characters.");
  }
  return reason;
}

function parseOptionalObjectId(raw: unknown, key: string): Types.ObjectId | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string" || !mongoose.isValidObjectId(raw)) {
    throw new AppError(400, `Invalid ${key}.`);
  }
  return new Types.ObjectId(raw);
}

function ensureObjectId(id: string, key: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, `Invalid ${key}.`);
  }
}

async function aggregateDailyCounts(model: any, match: Record<string, unknown>): Promise<Map<string, number>> {
  const rows = (await model.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
  ] as PipelineStage[])) as DailyCountRow[];

  const result = new Map<string, number>();
  for (const row of rows) {
    const year = String(row._id.year).padStart(4, "0");
    const month = String(row._id.month).padStart(2, "0");
    const day = String(row._id.day).padStart(2, "0");
    result.set(`${year}-${month}-${day}`, row.count);
  }
  return result;
}

function buildTrendRange(from: string | null, to: string | null): { start: Date; end: Date } {
  if (from && to) {
    return {
      start: startOfDay(parseGregorianDateStrict(from)),
      end: startOfDay(parseGregorianDateStrict(to)),
    };
  }

  if (from && !to) {
    const start = startOfDay(parseGregorianDateStrict(from));
    return { start, end: startOfDay(addDays(start, 13)) };
  }

  if (!from && to) {
    const end = startOfDay(parseGregorianDateStrict(to));
    return { start: startOfDay(addDays(end, -13)), end };
  }

  const today = startOfDay(new Date());
  return { start: startOfDay(addDays(today, -13)), end: today };
}

function statusCountsToMap(rows: StatusCountRow[]) {
  const output = { pending: 0, approved: 0, rejected: 0 };
  for (const row of rows) {
    if (row._id === "pending" || row._id === "approved" || row._id === "rejected") {
      output[row._id] = row.count;
    }
  }
  return output;
}

async function getUsersMapByIds(ids: Types.ObjectId[]) {
  if (ids.length === 0) return new Map<string, { _id: Types.ObjectId; displayName: string; email: string }>();
  const users = await User.find({ _id: { $in: ids } })
    .select("displayName email")
    .lean<Array<{ _id: Types.ObjectId; displayName: string; email: string }>>();
  return new Map(users.map((u) => [u._id.toString(), u]));
}

// GET /admin/stats — overview stats
adminRouter.get("/stats", async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers,
      totalAdmins,
      totalEntries,
      totalChallenges,
      totalReports,
      totalFamilies,
      totalReminders,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "admin" }),
      DailyEntry.countDocuments(),
      Challenge.countDocuments(),
      Report.countDocuments(),
      FamilyGroup.countDocuments(),
      EmailReminder.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5).select("email displayName role createdAt"),
    ]);

    res.json({
      totalUsers,
      totalAdmins,
      totalEntries,
      totalChallenges,
      totalReports,
      totalFamilies,
      totalReminders,
      recentUsers,
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/overview — filtered admin analytics
adminRouter.get("/overview", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const range = parseDateRange(req.query.from, req.query.to, "from", "to");
    const role = parseEnumParam(req.query.role, "role", SUPPORTED_ROLES) as "user" | "admin" | undefined;
    const language = parseEnumParam(req.query.language, "language", SUPPORTED_LANGUAGES) as
      | "ar"
      | "en"
      | "tr"
      | undefined;

    const baseUserFilter: Record<string, unknown> = {};
    if (role) baseUserFilter.role = role;
    if (language) baseUserFilter.language = language;

    const scopedUserIds = role || language
      ? (
          await User.find(baseUserFilter)
            .select("_id")
            .lean<Array<{ _id: Types.ObjectId }>>()
        ).map((row) => row._id)
      : null;

    const userIdScope = scopedUserIds ? { $in: scopedUserIds } : undefined;
    const dateRangeMatch = buildDateRangeMatch(range.fromDate, range.toDateExclusive);

    const entriesMatch: Record<string, unknown> = {};
    const challengesMatch: Record<string, unknown> = {};
    const reportsMatch: Record<string, unknown> = {};
    const commentsMatch: Record<string, unknown> = {};
    const reactionsMatch: Record<string, unknown> = {};
    const familiesMatch: Record<string, unknown> = {};

    if (dateRangeMatch) {
      entriesMatch.createdAt = dateRangeMatch;
      challengesMatch.createdAt = dateRangeMatch;
      reportsMatch.createdAt = dateRangeMatch;
      commentsMatch.createdAt = dateRangeMatch;
      reactionsMatch.createdAt = dateRangeMatch;
      familiesMatch.createdAt = dateRangeMatch;
    }
    if (userIdScope) {
      entriesMatch.userId = userIdScope;
      challengesMatch.userId = userIdScope;
      reportsMatch.ownerUserId = userIdScope;
      commentsMatch.ownerUserId = userIdScope;
      reactionsMatch.ownerUserId = userIdScope;
      familiesMatch.ownerUserId = userIdScope;
    }

    const activeWindowStart = range.fromDate || startOfDay(addDays(new Date(), -29));
    const activeWindowEndExclusive = range.toDateExclusive || startOfDay(addDays(new Date(), 1));
    const activeWindowMatch = buildDateRangeMatch(activeWindowStart, activeWindowEndExclusive)!;
    const activeEntriesMatch: Record<string, unknown> = { createdAt: activeWindowMatch };
    if (userIdScope) activeEntriesMatch.userId = userIdScope;

    const trendRange = buildTrendRange(range.from, range.to);
    const trendRangeMatch = buildDateRangeMatch(trendRange.start, startOfDay(addDays(trendRange.end, 1)))!;
    const userTrendMatch: Record<string, unknown> = { ...baseUserFilter, createdAt: trendRangeMatch };
    const entryTrendMatch: Record<string, unknown> = { createdAt: trendRangeMatch };
    const challengeTrendMatch: Record<string, unknown> = { createdAt: trendRangeMatch };
    const reportTrendMatch: Record<string, unknown> = { createdAt: trendRangeMatch };
    if (userIdScope) {
      entryTrendMatch.userId = userIdScope;
      challengeTrendMatch.userId = userIdScope;
      reportTrendMatch.ownerUserId = userIdScope;
    }

    const familyLookupPipeline: Array<Record<string, unknown>> = [
      { $match: { $expr: { $in: ["$userId", "$$memberIds"] } } },
      { $match: { createdAt: activeWindowMatch } },
      { $count: "count" },
    ];

    const familyActivityPipeline: Array<Record<string, unknown>> = [];
    if (userIdScope) {
      familyActivityPipeline.push({ $match: { ownerUserId: userIdScope } });
    }
    familyActivityPipeline.push(
      {
        $addFields: {
          memberIds: "$members.userId",
          memberCount: { $size: { $ifNull: ["$members", []] } },
        },
      },
      {
        $lookup: {
          from: "dailyentries",
          let: { memberIds: "$memberIds" },
          pipeline: familyLookupPipeline as unknown as PipelineStage[],
          as: "entryStats",
        },
      },
      {
        $addFields: {
          activityCount: { $ifNull: [{ $arrayElemAt: ["$entryStats.count", 0] }, 0] },
        },
      },
      { $sort: { activityCount: -1, memberCount: -1, createdAt: -1 } },
      { $limit: 5 },
      { $project: { name: 1, ownerUserId: 1, memberCount: 1, activityCount: 1 } }
    );

    const [
      totalUsers,
      totalAdmins,
      newUsers,
      totalEntries,
      totalChallenges,
      totalReports,
      totalFamilies,
      totalComments,
      totalReactions,
      activeUserIds,
      userTrendMap,
      entryTrendMap,
      challengeTrendMap,
      reportTrendMap,
      topUserRows,
      topFamilyRows,
    ] = await Promise.all([
      User.countDocuments(baseUserFilter),
      User.countDocuments({ ...baseUserFilter, role: "admin" }),
      dateRangeMatch ? User.countDocuments({ ...baseUserFilter, createdAt: dateRangeMatch }) : User.countDocuments(baseUserFilter),
      DailyEntry.countDocuments(entriesMatch),
      Challenge.countDocuments(challengesMatch),
      Report.countDocuments(reportsMatch),
      FamilyGroup.countDocuments(familiesMatch),
      Comment.countDocuments(commentsMatch),
      Reaction.countDocuments(reactionsMatch),
      DailyEntry.distinct("userId", activeEntriesMatch),
      aggregateDailyCounts(User, userTrendMatch),
      aggregateDailyCounts(DailyEntry, entryTrendMatch),
      aggregateDailyCounts(Challenge, challengeTrendMatch),
      aggregateDailyCounts(Report, reportTrendMatch),
      DailyEntry.aggregate<TopUserRow>([
        { $match: activeEntriesMatch },
        {
          $group: {
            _id: "$userId",
            entryCount: { $sum: 1 },
            lastActivityAt: { $max: "$updatedAt" },
          },
        },
        { $sort: { entryCount: -1, lastActivityAt: -1 } },
        { $limit: 5 },
      ]),
      FamilyGroup.aggregate<TopFamilyRow>(familyActivityPipeline as unknown as PipelineStage[]),
    ]);

    const topUserInfo = await User.find({
      _id: { $in: topUserRows.map((row) => row._id) },
    })
      .select("displayName email")
      .lean<Array<{ _id: Types.ObjectId; displayName: string; email: string }>>();
    const topUserInfoMap = new Map(topUserInfo.map((u) => [u._id.toString(), u]));

    const topFamilyOwnerInfo = await User.find({
      _id: { $in: topFamilyRows.map((row) => row.ownerUserId) },
    })
      .select("displayName email")
      .lean<Array<{ _id: Types.ObjectId; displayName: string; email: string }>>();
    const familyOwnerMap = new Map(topFamilyOwnerInfo.map((u) => [u._id.toString(), u]));

    const trend: Array<{
      date: string;
      users: number;
      entries: number;
      challenges: number;
      reports: number;
    }> = [];
    for (let cursor = new Date(trendRange.start); cursor <= trendRange.end; cursor = addDays(cursor, 1)) {
      const key = formatGregorianDate(cursor);
      trend.push({
        date: key,
        users: userTrendMap.get(key) || 0,
        entries: entryTrendMap.get(key) || 0,
        challenges: challengeTrendMap.get(key) || 0,
        reports: reportTrendMap.get(key) || 0,
      });
    }

    res.json({
      range: {
        from: range.from,
        to: range.to,
        isFiltered: Boolean(range.from || range.to),
      },
      filters: {
        role: role || null,
        language: language || null,
      },
      kpis: {
        totalUsers,
        totalAdmins,
        newUsers,
        activeUsers: activeUserIds.length,
        totalEntries,
        totalChallenges,
        totalReports,
        totalFamilies,
        totalComments,
        totalReactions,
      },
      trend,
      topActiveUsers: topUserRows.map((row) => {
        const info = topUserInfoMap.get(row._id.toString());
        return {
          userId: row._id.toString(),
          displayName: info?.displayName || "Unknown",
          email: info?.email || "",
          entryCount: row.entryCount,
          lastActivityAt: row.lastActivityAt,
        };
      }),
      topActiveFamilies: topFamilyRows.map((row) => {
        const owner = familyOwnerMap.get(row.ownerUserId.toString());
        return {
          familyId: row._id.toString(),
          name: row.name,
          ownerUserId: row.ownerUserId.toString(),
          ownerDisplayName: owner?.displayName || "Unknown",
          ownerEmail: owner?.email || "",
          memberCount: row.memberCount,
          activityCount: row.activityCount,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/users — list all users with advanced filters and pagination
adminRouter.get("/users", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parsePaginationInt(req.query.page, 1, 1, 10000, "page");
    const limit = parsePaginationInt(req.query.limit, 20, 1, 100, "limit");
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const role = parseEnumParam(req.query.role, "role", SUPPORTED_ROLES) as "user" | "admin" | undefined;
    const language = parseEnumParam(req.query.language, "language", SUPPORTED_LANGUAGES) as
      | "ar"
      | "en"
      | "tr"
      | undefined;
    const reminderEnabled = parseBooleanParam(req.query.reminderEnabled, "reminderEnabled");
    const joinedRange = parseDateRange(req.query.joinedFrom, req.query.joinedTo, "joinedFrom", "joinedTo");
    const activeRange = parseDateRange(req.query.lastActiveFrom, req.query.lastActiveTo, "lastActiveFrom", "lastActiveTo");

    const sortByRaw = typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
    const sortBy = SUPPORTED_SORT_FIELDS.has(sortByRaw) ? sortByRaw : "createdAt";
    const sortOrderRaw = typeof req.query.sortOrder === "string" ? req.query.sortOrder : "desc";
    const sortOrder: 1 | -1 = sortOrderRaw === "asc" ? 1 : -1;

    const userFilter: Record<string, unknown> = {};
    if (search) {
      userFilter.$or = [
        { email: { $regex: search, $options: "i" } },
        { displayName: { $regex: search, $options: "i" } },
      ];
    }
    if (role) userFilter.role = role;
    if (language) userFilter.language = language;
    if (reminderEnabled !== undefined) userFilter.reminderEnabled = reminderEnabled;
    const joinedDateMatch = buildDateRangeMatch(joinedRange.fromDate, joinedRange.toDateExclusive);
    if (joinedDateMatch) {
      userFilter.createdAt = joinedDateMatch;
    }

    const activityDateMatch = buildDateRangeMatch(activeRange.fromDate, activeRange.toDateExclusive);
    const sortObject: Record<string, 1 | -1> = { [sortBy]: sortOrder };
    if (sortBy !== "createdAt") {
      sortObject.createdAt = -1;
    }

    const pipeline: PipelineStage[] = [
      { $match: userFilter },
      {
        $lookup: {
          from: "dailyentries",
          let: { userId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", "$$userId"] } } },
            {
              $group: {
                _id: null,
                entryCount: { $sum: 1 },
                lastActivityAt: { $max: "$updatedAt" },
              },
            },
          ],
          as: "entryStats",
        },
      },
      {
        $addFields: {
          entryCount: { $ifNull: [{ $arrayElemAt: ["$entryStats.entryCount", 0] }, 0] },
          lastActivityAt: { $ifNull: [{ $arrayElemAt: ["$entryStats.lastActivityAt", 0] }, null] },
        },
      },
    ];

    if (activityDateMatch) {
      pipeline.push({ $match: { lastActivityAt: activityDateMatch } });
    }

    pipeline.push(
      { $sort: sortObject },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          users: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                email: 1,
                displayName: 1,
                role: 1,
                language: 1,
                reminderEnabled: 1,
                createdAt: 1,
                updatedAt: 1,
                entryCount: 1,
                lastActivityAt: 1,
              },
            },
          ],
        },
      }
    );

    const [result] = await User.aggregate<UsersFacetResult>(pipeline);
    const total = result?.metadata?.[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const users = (result?.users || []).map((u) => ({
      id: u._id.toString(),
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      language: u.language,
      reminderEnabled: u.reminderEnabled,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      entryCount: u.entryCount,
      lastActivityAt: u.lastActivityAt,
    }));

    res.json({
      users,
      total,
      page,
      totalPages,
      filters: {
        search: search || null,
        role: role || null,
        language: language || null,
        reminderEnabled: reminderEnabled ?? null,
        joinedFrom: joinedRange.from,
        joinedTo: joinedRange.to,
        lastActiveFrom: activeRange.from,
        lastActiveTo: activeRange.to,
        sortBy,
        sortOrder: sortOrder === 1 ? "asc" : "desc",
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/users/:id — user detail and linked aggregates
adminRouter.get("/users/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "user id");
    const userId = new Types.ObjectId(req.params.id);

    const user = await User.findById(userId)
      .select("email displayName role language bio avatarUrl timezoneIana timezoneSource reminderEnabled reminderTimeLocal createdAt updatedAt")
      .lean<{
        _id: Types.ObjectId;
        email: string;
        displayName: string;
        role: "user" | "admin";
        language: "ar" | "en" | "tr";
        bio: string;
        avatarUrl: string | null;
        timezoneIana: string;
        timezoneSource: "auto" | "manual";
        reminderEnabled: boolean;
        reminderTimeLocal: string;
        createdAt: Date;
        updatedAt: Date;
      } | null>();

    if (!user) throw new AppError(404, "User not found");

    const [
      entryCount,
      challengeCount,
      reportCount,
      familyOwnedCount,
      familyMembershipsRaw,
      refreshSessionCount,
      commentCount,
      reactionCount,
      latestEntry,
      recentEntries,
      recentChallenges,
      recentReportsRaw,
      entryStatusCounts,
      challengeScopeCounts,
      activeChallengeCount,
      inactiveChallengeCount,
      ownerVisibilityCounts,
      viewerVisibilityCounts,
    ] = await Promise.all([
      DailyEntry.countDocuments({ userId }),
      Challenge.countDocuments({ userId }),
      Report.countDocuments({ ownerUserId: userId }),
      FamilyGroup.countDocuments({ ownerUserId: userId }),
      FamilyGroup.find({ "members.userId": userId })
        .select("name ownerUserId members createdAt")
        .lean<
          Array<{
            _id: Types.ObjectId;
            name: string;
            ownerUserId: Types.ObjectId;
            members: Array<{
              userId: Types.ObjectId;
              role: "owner" | "member";
              status: "invited" | "active";
              joinedAt: Date;
            }>;
            createdAt: Date;
          }>
        >(),
      RefreshToken.countDocuments({ userId }),
      Comment.countDocuments({ authorUserId: userId }),
      Reaction.countDocuments({ authorUserId: userId }),
      DailyEntry.findOne({ userId }).sort({ updatedAt: -1 }).select("gregorianDate updatedAt"),
      DailyEntry.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("gregorianDate status updatedAt"),
      Challenge.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("title scope active updatedAt"),
      Report.find({ ownerUserId: userId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("periodScope periodStart periodEnd visibility includeProfileInfo revokedAt accessLog updatedAt"),
      DailyEntry.aggregate<StatusCountRow>([
        { $match: { userId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Challenge.aggregate<ScopeCountRow>([
        { $match: { userId } },
        { $group: { _id: "$scope", count: { $sum: 1 } } },
      ]),
      Challenge.countDocuments({ userId, active: true }),
      Challenge.countDocuments({ userId, active: false }),
      VisibilityApproval.aggregate<StatusCountRow>([
        { $match: { ownerUserId: userId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      VisibilityApproval.aggregate<StatusCountRow>([
        { $match: { viewerUserId: userId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const ownerIds = Array.from(
      new Set(
        familyMembershipsRaw
          .map((family) => family.ownerUserId.toString())
          .filter((id) => mongoose.isValidObjectId(id))
      )
    ).map((id) => new Types.ObjectId(id));

    const ownerUsers = ownerIds.length
      ? await User.find({ _id: { $in: ownerIds } })
          .select("displayName email")
          .lean<Array<{ _id: Types.ObjectId; displayName: string; email: string }>>()
      : [];
    const ownerMap = new Map(ownerUsers.map((owner) => [owner._id.toString(), owner]));

    const familyMemberships = familyMembershipsRaw.map((family) => {
      const member = family.members.find((entry) => entry.userId.toString() === userId.toString());
      const owner = ownerMap.get(family.ownerUserId.toString());
      return {
        familyId: family._id.toString(),
        name: family.name,
        ownerUserId: family.ownerUserId.toString(),
        ownerDisplayName: owner?.displayName || "Unknown",
        ownerEmail: owner?.email || "",
        role: member?.role || "member",
        status: member?.status || "invited",
        joinedAt: member?.joinedAt || family.createdAt,
        memberCount: family.members.length,
      };
    });

    const entryStatus = { open: 0, locked: 0 };
    for (const row of entryStatusCounts) {
      if (row._id === "open" || row._id === "locked") {
        entryStatus[row._id] = row.count;
      }
    }

    const challengeScopes = { daily: 0, weekly: 0, monthly: 0 };
    for (const row of challengeScopeCounts) {
      if (row._id === "daily" || row._id === "weekly" || row._id === "monthly") {
        challengeScopes[row._id] = row.count;
      }
    }

    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        language: user.language,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        timezoneIana: user.timezoneIana,
        timezoneSource: user.timezoneSource,
        reminderEnabled: user.reminderEnabled,
        reminderTimeLocal: user.reminderTimeLocal,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      metrics: {
        entryCount,
        challengeCount,
        activeChallengeCount,
        inactiveChallengeCount,
        reportCount,
        familyOwnedCount,
        familyMembershipCount: familyMemberships.length,
        refreshSessionCount,
        commentCount,
        reactionCount,
        lastActivityAt: latestEntry?.updatedAt || null,
      },
      entryStatus,
      challengeScopes,
      visibilityApprovals: {
        asOwner: statusCountsToMap(ownerVisibilityCounts),
        asViewer: statusCountsToMap(viewerVisibilityCounts),
      },
      familyMemberships,
      recent: {
        entries: recentEntries.map((entry) => ({
          id: entry._id.toString(),
          gregorianDate: entry.gregorianDate,
          status: entry.status,
          updatedAt: entry.updatedAt,
        })),
        challenges: recentChallenges.map((challenge) => ({
          id: challenge._id.toString(),
          title: challenge.title,
          scope: challenge.scope,
          active: challenge.active,
          updatedAt: challenge.updatedAt,
        })),
        reports: recentReportsRaw.map((report) => ({
          id: report._id.toString(),
          periodScope: report.periodScope,
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          visibility: report.visibility,
          includeProfileInfo: report.includeProfileInfo,
          revokedAt: report.revokedAt,
          accessCount: report.accessLog.length,
          updatedAt: report.updatedAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/families — list family groups with filters
adminRouter.get("/families", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parsePaginationInt(req.query.page, 1, 1, 10000, "page");
    const limit = parsePaginationInt(req.query.limit, 20, 1, 100, "limit");
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const ownerId = parseOptionalObjectId(req.query.ownerUserId, "ownerUserId");
    const archived = parseBooleanParam(req.query.archived, "archived");
    const createdRange = parseDateRange(req.query.from, req.query.to, "from", "to");

    const filter: Record<string, unknown> = {};
    if (search) filter.name = { $regex: search, $options: "i" };
    if (ownerId) filter.ownerUserId = ownerId;
    if (archived === true) filter.archivedAt = { $ne: null };
    if (archived === false) filter.archivedAt = null;
    const createdMatch = buildDateRangeMatch(createdRange.fromDate, createdRange.toDateExclusive);
    if (createdMatch) filter.createdAt = createdMatch;

    const [groups, total] = await Promise.all([
      FamilyGroup.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<
          Array<{
            _id: Types.ObjectId;
            ownerUserId: Types.ObjectId;
            name: string;
            archivedAt: Date | null;
            members: Array<{
              userId: Types.ObjectId;
              role: "owner" | "member";
              status: "invited" | "active";
              joinedAt: Date;
            }>;
            createdAt: Date;
            updatedAt: Date;
          }>
        >(),
      FamilyGroup.countDocuments(filter),
    ]);

    const ownerMap = await getUsersMapByIds(
      Array.from(new Set(groups.map((group) => group.ownerUserId.toString()))).map((id) => new Types.ObjectId(id))
    );

    res.json({
      families: groups.map((group) => {
        const owner = ownerMap.get(group.ownerUserId.toString());
        const activeMembers = group.members.filter((member) => member.status === "active").length;
        const invitedMembers = group.members.filter((member) => member.status === "invited").length;
        return {
          id: group._id.toString(),
          name: group.name,
          ownerUserId: group.ownerUserId.toString(),
          ownerDisplayName: owner?.displayName || "Unknown",
          ownerEmail: owner?.email || "",
          memberCount: group.members.length,
          activeMembers,
          invitedMembers,
          archivedAt: group.archivedAt,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        };
      }),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/families/:id — family detail with members and activity summary
adminRouter.get("/families/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "family id");
    const family = await FamilyGroup.findById(req.params.id).lean<{
      _id: Types.ObjectId;
      ownerUserId: Types.ObjectId;
      name: string;
      archivedAt: Date | null;
      members: Array<{
        userId: Types.ObjectId;
        role: "owner" | "member";
        status: "invited" | "active";
        joinedAt: Date;
      }>;
      createdAt: Date;
      updatedAt: Date;
    } | null>();
    if (!family) throw new AppError(404, "Family group not found");

    const memberIdStrings = Array.from(new Set(family.members.map((member) => member.userId.toString())));
    if (!memberIdStrings.includes(family.ownerUserId.toString())) {
      memberIdStrings.unshift(family.ownerUserId.toString());
    }
    const memberIds = memberIdStrings.map((id) => new Types.ObjectId(id));
    const userMap = await getUsersMapByIds(memberIds);

    const [entryCount, challengeCount, reportCount, approvalCounts, recentEntries, recentChallenges, recentReports] =
      await Promise.all([
        DailyEntry.countDocuments({ userId: { $in: memberIds } }),
        Challenge.countDocuments({ userId: { $in: memberIds } }),
        Report.countDocuments({ ownerUserId: { $in: memberIds } }),
        VisibilityApproval.aggregate<StatusCountRow>([
          { $match: { ownerUserId: { $in: memberIds } } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        DailyEntry.find({ userId: { $in: memberIds } })
          .sort({ updatedAt: -1 })
          .limit(8)
          .select("userId gregorianDate status updatedAt")
          .lean<Array<{ _id: Types.ObjectId; userId: Types.ObjectId; gregorianDate: string; status: string; updatedAt: Date }>>(),
        Challenge.find({ userId: { $in: memberIds } })
          .sort({ updatedAt: -1 })
          .limit(8)
          .select("userId title scope active updatedAt")
          .lean<
            Array<{ _id: Types.ObjectId; userId: Types.ObjectId; title: string; scope: string; active: boolean; updatedAt: Date }>
          >(),
        Report.find({ ownerUserId: { $in: memberIds } })
          .sort({ createdAt: -1 })
          .limit(8)
          .select("ownerUserId periodScope periodStart periodEnd visibility createdAt")
          .lean<
            Array<{
              _id: Types.ObjectId;
              ownerUserId: Types.ObjectId;
              periodScope: string;
              periodStart: string;
              periodEnd: string;
              visibility: "public" | "private";
              createdAt: Date;
            }>
          >(),
      ]);

    const owner = userMap.get(family.ownerUserId.toString());
    const members = family.members.map((member) => {
      const user = userMap.get(member.userId.toString());
      return {
        userId: member.userId.toString(),
        displayName: user?.displayName || "Unknown",
        email: user?.email || "",
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt,
      };
    });

    res.json({
      family: {
        id: family._id.toString(),
        name: family.name,
        ownerUserId: family.ownerUserId.toString(),
        ownerDisplayName: owner?.displayName || "Unknown",
        ownerEmail: owner?.email || "",
        archivedAt: family.archivedAt,
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
      },
      members,
      metrics: {
        memberCount: family.members.length,
        activeMembers: family.members.filter((member) => member.status === "active").length,
        invitedMembers: family.members.filter((member) => member.status === "invited").length,
        entryCount,
        challengeCount,
        reportCount,
      },
      visibilityApprovals: statusCountsToMap(approvalCounts),
      recent: {
        entries: recentEntries.map((entry) => ({
          id: entry._id.toString(),
          userId: entry.userId.toString(),
          displayName: userMap.get(entry.userId.toString())?.displayName || "Unknown",
          gregorianDate: entry.gregorianDate,
          status: entry.status,
          updatedAt: entry.updatedAt,
        })),
        challenges: recentChallenges.map((challenge) => ({
          id: challenge._id.toString(),
          userId: challenge.userId.toString(),
          displayName: userMap.get(challenge.userId.toString())?.displayName || "Unknown",
          title: challenge.title,
          scope: challenge.scope,
          active: challenge.active,
          updatedAt: challenge.updatedAt,
        })),
        reports: recentReports.map((report) => ({
          id: report._id.toString(),
          ownerUserId: report.ownerUserId.toString(),
          ownerDisplayName: userMap.get(report.ownerUserId.toString())?.displayName || "Unknown",
          periodScope: report.periodScope,
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          visibility: report.visibility,
          createdAt: report.createdAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/families/:id/remove-member — remove member from family
adminRouter.post("/families/:id/remove-member", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "family id");
    const payload = (req.body || {}) as Record<string, unknown>;
    const reason = parseRequiredReason(payload.reason);
    const memberUserId = parseOptionalObjectId(payload.memberUserId, "memberUserId");
    if (!memberUserId) throw new AppError(400, "memberUserId is required");

    const family = await FamilyGroup.findById(req.params.id);
    if (!family) throw new AppError(404, "Family group not found");

    const memberIndex = family.members.findIndex((member) => member.userId.toString() === memberUserId.toString());
    if (memberIndex === -1) throw new AppError(404, "Member not found in family");
    const member = family.members[memberIndex];
    if (member.role === "owner" || family.ownerUserId.toString() === memberUserId.toString()) {
      throw new AppError(400, "Cannot remove owner. Transfer ownership first.");
    }

    const beforeCount = family.members.length;
    family.members.splice(memberIndex, 1);
    await family.save();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_family_remove_member",
      targetType: "family_group",
      targetId: family._id.toString(),
      metadata: {
        memberUserId: memberUserId.toString(),
        reason,
        beforeMemberCount: beforeCount,
        afterMemberCount: family.members.length,
      },
    });

    res.json({ message: "Member removed", familyId: family._id.toString(), memberUserId: memberUserId.toString() });
  } catch (err) {
    next(err);
  }
});

// POST /admin/families/:id/transfer-ownership — transfer owner to active member
adminRouter.post("/families/:id/transfer-ownership", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "family id");
    const payload = (req.body || {}) as Record<string, unknown>;
    const reason = parseRequiredReason(payload.reason);
    const newOwnerUserId = parseOptionalObjectId(payload.newOwnerUserId, "newOwnerUserId");
    if (!newOwnerUserId) throw new AppError(400, "newOwnerUserId is required");

    const family = await FamilyGroup.findById(req.params.id);
    if (!family) throw new AppError(404, "Family group not found");

    const currentOwnerId = family.ownerUserId.toString();
    if (currentOwnerId === newOwnerUserId.toString()) {
      throw new AppError(400, "User is already the owner");
    }

    const targetMember = family.members.find((member) => member.userId.toString() === newOwnerUserId.toString());
    if (!targetMember || targetMember.status !== "active") {
      throw new AppError(400, "New owner must be an active family member");
    }

    for (const member of family.members) {
      if (member.userId.toString() === currentOwnerId) member.role = "member";
      if (member.userId.toString() === newOwnerUserId.toString()) {
        member.role = "owner";
        member.status = "active";
      }
    }
    family.ownerUserId = newOwnerUserId;
    await family.save();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_family_transfer_ownership",
      targetType: "family_group",
      targetId: family._id.toString(),
      metadata: {
        reason,
        previousOwnerUserId: currentOwnerId,
        newOwnerUserId: newOwnerUserId.toString(),
      },
    });

    res.json({
      message: "Family ownership transferred",
      familyId: family._id.toString(),
      previousOwnerUserId: currentOwnerId,
      newOwnerUserId: newOwnerUserId.toString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/families/:id/archive — archive family group
adminRouter.post("/families/:id/archive", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "family id");
    const reason = parseRequiredReason((req.body || {}).reason);
    const family = await FamilyGroup.findById(req.params.id);
    if (!family) throw new AppError(404, "Family group not found");
    if (family.archivedAt) {
      return res.json({ message: "Family already archived", familyId: family._id.toString(), archivedAt: family.archivedAt });
    }

    family.archivedAt = new Date();
    await family.save();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_family_archive",
      targetType: "family_group",
      targetId: family._id.toString(),
      metadata: { reason, archivedAt: family.archivedAt },
    });

    res.json({ message: "Family archived", familyId: family._id.toString(), archivedAt: family.archivedAt });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/families/:id — delete family group
adminRouter.delete("/families/:id", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "family id");
    const reason = parseRequiredReason((req.body || {}).reason);
    const family = await FamilyGroup.findById(req.params.id);
    if (!family) throw new AppError(404, "Family group not found");

    const snapshot = {
      name: family.name,
      ownerUserId: family.ownerUserId.toString(),
      memberCount: family.members.length,
      archivedAt: family.archivedAt,
    };
    await family.deleteOne();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_family_delete",
      targetType: "family_group",
      targetId: req.params.id,
      metadata: { reason, before: snapshot },
    });

    res.json({ message: "Family deleted", familyId: req.params.id });
  } catch (err) {
    next(err);
  }
});

// GET /admin/entries — explorer for daily entries
adminRouter.get("/entries", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parsePaginationInt(req.query.page, 1, 1, 10000, "page");
    const limit = parsePaginationInt(req.query.limit, 20, 1, 100, "limit");
    const userId = parseOptionalObjectId(req.query.userId, "userId");
    const status = parseEnumParam(req.query.status, "status", new Set(["open", "locked"])) as "open" | "locked" | undefined;
    const dateRange = parseDateRange(req.query.from, req.query.to, "from", "to");

    const filter: Record<string, unknown> = {};
    if (userId) filter.userId = userId;
    if (status) filter.status = status;
    if (dateRange.from || dateRange.to) {
      const gregorianDateRange: Record<string, string> = {};
      if (dateRange.from) gregorianDateRange.$gte = dateRange.from;
      if (dateRange.to) gregorianDateRange.$lte = dateRange.to;
      filter.gregorianDate = gregorianDateRange;
    }

    const [entries, total] = await Promise.all([
      DailyEntry.find(filter)
        .sort({ gregorianDate: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<
          Array<{
            _id: Types.ObjectId;
            userId: Types.ObjectId;
            gregorianDate: string;
            hijriYear: number;
            hijriMonth: number;
            hijriDay: number;
            status: "open" | "locked";
            fields: Array<{ completed: boolean }>;
            createdAt: Date;
            updatedAt: Date;
          }>
        >(),
      DailyEntry.countDocuments(filter),
    ]);

    const userMap = await getUsersMapByIds(
      Array.from(new Set(entries.map((entry) => entry.userId.toString()))).map((id) => new Types.ObjectId(id))
    );

    res.json({
      entries: entries.map((entry) => ({
        id: entry._id.toString(),
        userId: entry.userId.toString(),
        userDisplayName: userMap.get(entry.userId.toString())?.displayName || "Unknown",
        userEmail: userMap.get(entry.userId.toString())?.email || "",
        gregorianDate: entry.gregorianDate,
        hijri: {
          year: entry.hijriYear,
          month: entry.hijriMonth,
          day: entry.hijriDay,
        },
        status: entry.status,
        completedFields: entry.fields.filter((field) => field.completed).length,
        totalFields: entry.fields.length,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/entries/:id — entry detail
adminRouter.get("/entries/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "entry id");
    const entry = await DailyEntry.findById(req.params.id).lean();
    if (!entry) throw new AppError(404, "Entry not found");

    const [user, commentCount, reactionCount] = await Promise.all([
      User.findById(entry.userId).select("displayName email").lean<{ _id: Types.ObjectId; displayName: string; email: string } | null>(),
      Comment.countDocuments({
        ownerUserId: entry.userId,
        targetType: "daily_entry",
        targetId: entry._id,
      }),
      Reaction.countDocuments({
        ownerUserId: entry.userId,
        targetType: "daily_entry",
        targetId: entry._id,
      }),
    ]);

    res.json({
      entry: {
        id: entry._id.toString(),
        userId: entry.userId.toString(),
        userDisplayName: user?.displayName || "Unknown",
        userEmail: user?.email || "",
        gregorianDate: entry.gregorianDate,
        hijriYear: entry.hijriYear,
        hijriMonth: entry.hijriMonth,
        hijriDay: entry.hijriDay,
        timezoneSnapshot: entry.timezoneSnapshot,
        lockAtUtc: entry.lockAtUtc,
        status: entry.status,
        fields: entry.fields,
        social: { commentCount, reactionCount },
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/challenges — explorer for challenges
adminRouter.get("/challenges", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parsePaginationInt(req.query.page, 1, 1, 10000, "page");
    const limit = parsePaginationInt(req.query.limit, 20, 1, 100, "limit");
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const userId = parseOptionalObjectId(req.query.userId, "userId");
    const scope = parseEnumParam(req.query.scope, "scope", new Set(["daily", "weekly", "monthly"])) as
      | "daily"
      | "weekly"
      | "monthly"
      | undefined;
    const active = parseBooleanParam(req.query.active, "active");

    const filter: Record<string, unknown> = {};
    if (userId) filter.userId = userId;
    if (scope) filter.scope = scope;
    if (active !== undefined) filter.active = active;
    if (search) filter.title = { $regex: search, $options: "i" };

    const [challenges, total] = await Promise.all([
      Challenge.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<
          Array<{
            _id: Types.ObjectId;
            userId: Types.ObjectId;
            title: string;
            scope: "daily" | "weekly" | "monthly";
            active: boolean;
            progress: Array<{ completed: boolean }>;
            createdAt: Date;
            updatedAt: Date;
          }>
        >(),
      Challenge.countDocuments(filter),
    ]);

    const userMap = await getUsersMapByIds(
      Array.from(new Set(challenges.map((challenge) => challenge.userId.toString()))).map((id) => new Types.ObjectId(id))
    );

    res.json({
      challenges: challenges.map((challenge) => ({
        id: challenge._id.toString(),
        userId: challenge.userId.toString(),
        userDisplayName: userMap.get(challenge.userId.toString())?.displayName || "Unknown",
        userEmail: userMap.get(challenge.userId.toString())?.email || "",
        title: challenge.title,
        scope: challenge.scope,
        active: challenge.active,
        progressCount: challenge.progress.length,
        completedCount: challenge.progress.filter((progress) => progress.completed).length,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/challenges/:id — challenge detail
adminRouter.get("/challenges/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "challenge id");
    const challenge = await Challenge.findById(req.params.id).lean();
    if (!challenge) throw new AppError(404, "Challenge not found");

    const user = await User.findById(challenge.userId)
      .select("displayName email")
      .lean<{ _id: Types.ObjectId; displayName: string; email: string } | null>();

    const recentProgress = [...challenge.progress]
      .sort((a, b) => (a.dateGregorian < b.dateGregorian ? 1 : -1))
      .slice(0, 20);

    res.json({
      challenge: {
        id: challenge._id.toString(),
        userId: challenge.userId.toString(),
        userDisplayName: user?.displayName || "Unknown",
        userEmail: user?.email || "",
        title: challenge.title,
        description: challenge.description,
        scope: challenge.scope,
        active: challenge.active,
        periodsCount: challenge.periods.length,
        progressCount: challenge.progress.length,
        completedCount: challenge.progress.filter((progress) => progress.completed).length,
        recentProgress,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/challenges/:id/archive — archive challenge
adminRouter.post("/challenges/:id/archive", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "challenge id");
    const reason = parseRequiredReason((req.body || {}).reason);
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) throw new AppError(404, "Challenge not found");
    const before = { active: challenge.active };

    challenge.active = false;
    await challenge.save();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_challenge_archive",
      targetType: "challenge",
      targetId: challenge._id.toString(),
      metadata: { reason, before, after: { active: challenge.active } },
    });

    res.json({ message: "Challenge archived", id: challenge._id.toString(), active: challenge.active });
  } catch (err) {
    next(err);
  }
});

// POST /admin/challenges/:id/reactivate — reactivate challenge
adminRouter.post("/challenges/:id/reactivate", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "challenge id");
    const reason = parseRequiredReason((req.body || {}).reason);
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) throw new AppError(404, "Challenge not found");
    const before = { active: challenge.active };

    challenge.active = true;
    await challenge.save();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_challenge_reactivate",
      targetType: "challenge",
      targetId: challenge._id.toString(),
      metadata: { reason, before, after: { active: challenge.active } },
    });

    res.json({ message: "Challenge reactivated", id: challenge._id.toString(), active: challenge.active });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/challenges/:id — delete challenge
adminRouter.delete("/challenges/:id", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "challenge id");
    const reason = parseRequiredReason((req.body || {}).reason);
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) throw new AppError(404, "Challenge not found");

    const snapshot = {
      title: challenge.title,
      userId: challenge.userId.toString(),
      scope: challenge.scope,
      active: challenge.active,
      progressCount: challenge.progress.length,
    };
    await challenge.deleteOne();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_challenge_delete",
      targetType: "challenge",
      targetId: req.params.id,
      metadata: { reason, before: snapshot },
    });

    res.json({ message: "Challenge deleted", id: req.params.id });
  } catch (err) {
    next(err);
  }
});

// GET /admin/reports — explorer for reports
adminRouter.get("/reports", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parsePaginationInt(req.query.page, 1, 1, 10000, "page");
    const limit = parsePaginationInt(req.query.limit, 20, 1, 100, "limit");
    const ownerUserId = parseOptionalObjectId(req.query.ownerUserId, "ownerUserId");
    const visibility = parseEnumParam(req.query.visibility, "visibility", new Set(["public", "private"])) as
      | "public"
      | "private"
      | undefined;
    const revoked = parseBooleanParam(req.query.revoked, "revoked");
    const createdRange = parseDateRange(req.query.from, req.query.to, "from", "to");

    const filter: Record<string, unknown> = {};
    if (ownerUserId) filter.ownerUserId = ownerUserId;
    if (visibility) filter.visibility = visibility;
    if (revoked === true) filter.revokedAt = { $ne: null };
    if (revoked === false) filter.revokedAt = null;
    const createdMatch = buildDateRangeMatch(createdRange.fromDate, createdRange.toDateExclusive);
    if (createdMatch) filter.createdAt = createdMatch;

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<
          Array<{
            _id: Types.ObjectId;
            ownerUserId: Types.ObjectId;
            periodScope: string;
            periodStart: string;
            periodEnd: string;
            visibility: "public" | "private";
            includeProfileInfo: boolean;
            publicToken: string | null;
            revokedAt: Date | null;
            accessLog: Array<{ accessedAt: Date }>;
            createdAt: Date;
            updatedAt: Date;
          }>
        >(),
      Report.countDocuments(filter),
    ]);

    const ownerMap = await getUsersMapByIds(
      Array.from(new Set(reports.map((report) => report.ownerUserId.toString()))).map((id) => new Types.ObjectId(id))
    );

    res.json({
      reports: reports.map((report) => ({
        id: report._id.toString(),
        ownerUserId: report.ownerUserId.toString(),
        ownerDisplayName: ownerMap.get(report.ownerUserId.toString())?.displayName || "Unknown",
        ownerEmail: ownerMap.get(report.ownerUserId.toString())?.email || "",
        periodScope: report.periodScope,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        visibility: report.visibility,
        includeProfileInfo: report.includeProfileInfo,
        hasPublicToken: Boolean(report.publicToken),
        revokedAt: report.revokedAt,
        accessCount: report.accessLog.length,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/reports/:id — report detail
adminRouter.get("/reports/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "report id");
    const report = await Report.findById(req.params.id).lean();
    if (!report) throw new AppError(404, "Report not found");

    const [owner, entriesCount] = await Promise.all([
      User.findById(report.ownerUserId)
        .select("displayName email")
        .lean<{ _id: Types.ObjectId; displayName: string; email: string } | null>(),
      DailyEntry.countDocuments({
        userId: report.ownerUserId,
        gregorianDate: { $gte: report.periodStart, $lte: report.periodEnd },
      }),
    ]);

    const recentAccess = [...report.accessLog]
      .sort((a, b) => b.accessedAt.getTime() - a.accessedAt.getTime())
      .slice(0, 25);

    res.json({
      report: {
        id: report._id.toString(),
        ownerUserId: report.ownerUserId.toString(),
        ownerDisplayName: owner?.displayName || "Unknown",
        ownerEmail: owner?.email || "",
        periodScope: report.periodScope,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        visibility: report.visibility,
        includeProfileInfo: report.includeProfileInfo,
        publicToken: report.publicToken,
        revokedAt: report.revokedAt,
        accessCount: report.accessLog.length,
        entriesCount,
        recentAccess,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/reports/:id/revoke-public — revoke public access
adminRouter.post("/reports/:id/revoke-public", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "report id");
    const reason = parseRequiredReason((req.body || {}).reason);
    const report = await Report.findById(req.params.id);
    if (!report) throw new AppError(404, "Report not found");

    const before = { visibility: report.visibility, revokedAt: report.revokedAt };
    report.revokedAt = new Date();
    report.visibility = "private";
    await report.save();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_report_revoke_public",
      targetType: "report",
      targetId: report._id.toString(),
      metadata: {
        reason,
        before,
        after: { visibility: report.visibility, revokedAt: report.revokedAt },
      },
    });

    res.json({ message: "Public access revoked", id: report._id.toString(), visibility: report.visibility, revokedAt: report.revokedAt });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/reports/:id/access-policy — toggle report visibility/profile inclusion
adminRouter.patch("/reports/:id/access-policy", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "report id");
    const payload = (req.body || {}) as Record<string, unknown>;
    const reason = parseRequiredReason(payload.reason);
    const visibility = parseEnumParam(payload.visibility, "visibility", new Set(["public", "private"])) as
      | "public"
      | "private"
      | undefined;
    if (!visibility) throw new AppError(400, "visibility is required");
    const includeProfileInfo = parseBooleanParam(payload.includeProfileInfo, "includeProfileInfo");

    const report = await Report.findById(req.params.id);
    if (!report) throw new AppError(404, "Report not found");

    const before = {
      visibility: report.visibility,
      includeProfileInfo: report.includeProfileInfo,
      revokedAt: report.revokedAt,
      hasPublicToken: Boolean(report.publicToken),
    };

    report.visibility = visibility;
    if (includeProfileInfo !== undefined) {
      report.includeProfileInfo = includeProfileInfo;
    }
    if (visibility === "public") {
      if (!report.publicToken) report.publicToken = uuidv4();
      report.revokedAt = null;
    } else {
      report.revokedAt = report.revokedAt || new Date();
    }
    await report.save();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_report_access_policy_update",
      targetType: "report",
      targetId: report._id.toString(),
      metadata: {
        reason,
        before,
        after: {
          visibility: report.visibility,
          includeProfileInfo: report.includeProfileInfo,
          revokedAt: report.revokedAt,
          hasPublicToken: Boolean(report.publicToken),
        },
      },
    });

    res.json({
      message: "Report access policy updated",
      report: {
        id: report._id.toString(),
        visibility: report.visibility,
        includeProfileInfo: report.includeProfileInfo,
        revokedAt: report.revokedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/reports/:id — delete report
adminRouter.delete("/reports/:id", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "report id");
    const reason = parseRequiredReason((req.body || {}).reason);
    const report = await Report.findById(req.params.id);
    if (!report) throw new AppError(404, "Report not found");

    const snapshot = {
      ownerUserId: report.ownerUserId.toString(),
      visibility: report.visibility,
      periodScope: report.periodScope,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      accessCount: report.accessLog.length,
    };
    await report.deleteOne();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_report_delete",
      targetType: "report",
      targetId: req.params.id,
      metadata: { reason, before: snapshot },
    });

    res.json({ message: "Report deleted", id: req.params.id });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/users/:id — edit admin-managed user fields
adminRouter.patch("/users/:id", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "user id");
    const payload = (req.body || {}) as Record<string, unknown>;
    const reason = parseRequiredReason(payload.reason);
    const updates: EditableUserUpdates = {};

    if (Object.prototype.hasOwnProperty.call(payload, "displayName")) {
      if (typeof payload.displayName !== "string") throw new AppError(400, "displayName must be a string");
      const value = payload.displayName.trim();
      if (value.length < 1 || value.length > 100) {
        throw new AppError(400, "displayName must be between 1 and 100 characters");
      }
      updates.displayName = value;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bio")) {
      if (typeof payload.bio !== "string") throw new AppError(400, "bio must be a string");
      if (payload.bio.length > 500) throw new AppError(400, "bio must be 500 characters or less");
      updates.bio = payload.bio;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "language")) {
      if (typeof payload.language !== "string" || !SUPPORTED_LANGUAGES.has(payload.language)) {
        throw new AppError(400, "language must be one of: ar, en, tr");
      }
      updates.language = payload.language as "ar" | "en" | "tr";
    }

    if (Object.prototype.hasOwnProperty.call(payload, "timezoneIana")) {
      if (typeof payload.timezoneIana !== "string") throw new AppError(400, "timezoneIana must be a string");
      const value = payload.timezoneIana.trim();
      if (!value) throw new AppError(400, "timezoneIana cannot be empty");
      updates.timezoneIana = value;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "timezoneSource")) {
      if (payload.timezoneSource !== "auto" && payload.timezoneSource !== "manual") {
        throw new AppError(400, "timezoneSource must be 'auto' or 'manual'");
      }
      updates.timezoneSource = payload.timezoneSource;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "reminderEnabled")) {
      if (typeof payload.reminderEnabled !== "boolean") {
        throw new AppError(400, "reminderEnabled must be a boolean");
      }
      updates.reminderEnabled = payload.reminderEnabled;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "reminderTimeLocal")) {
      if (typeof payload.reminderTimeLocal !== "string" || !TIME_LOCAL_RE.test(payload.reminderTimeLocal)) {
        throw new AppError(400, "reminderTimeLocal must be HH:MM (24-hour)");
      }
      updates.reminderTimeLocal = payload.reminderTimeLocal;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError(400, "No editable fields provided");
    }

    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, "User not found");

    const before = {
      displayName: user.displayName,
      bio: user.bio,
      language: user.language,
      timezoneIana: user.timezoneIana,
      timezoneSource: user.timezoneSource,
      reminderEnabled: user.reminderEnabled,
      reminderTimeLocal: user.reminderTimeLocal,
    };

    if (updates.displayName !== undefined) user.displayName = updates.displayName;
    if (updates.bio !== undefined) user.bio = updates.bio;
    if (updates.language !== undefined) user.language = updates.language;
    if (updates.timezoneIana !== undefined) user.timezoneIana = updates.timezoneIana;
    if (updates.timezoneSource !== undefined) user.timezoneSource = updates.timezoneSource;
    if (updates.reminderEnabled !== undefined) user.reminderEnabled = updates.reminderEnabled;
    if (updates.reminderTimeLocal !== undefined) user.reminderTimeLocal = updates.reminderTimeLocal;
    await user.save();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_user_update",
      targetType: "user",
      targetId: user._id.toString(),
      metadata: {
        updatedFields: Object.keys(updates),
        before,
        after: {
          displayName: user.displayName,
          bio: user.bio,
          language: user.language,
          timezoneIana: user.timezoneIana,
          timezoneSource: user.timezoneSource,
          reminderEnabled: user.reminderEnabled,
          reminderTimeLocal: user.reminderTimeLocal,
        },
        reason,
      },
    });

    res.json({
      message: "User updated successfully",
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        language: user.language,
        bio: user.bio,
        timezoneIana: user.timezoneIana,
        timezoneSource: user.timezoneSource,
        reminderEnabled: user.reminderEnabled,
        reminderTimeLocal: user.reminderTimeLocal,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/users/:id/revoke-sessions — force logout all user sessions
adminRouter.post("/users/:id/revoke-sessions", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "user id");
    const reason = parseRequiredReason((req.body || {}).reason);
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, "User not found");

    const deleted = await RefreshToken.deleteMany({ userId: user._id });
    const revokedCount = deleted.deletedCount || 0;

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_revoke_sessions",
      targetType: "user",
      targetId: user._id.toString(),
      metadata: { revokedCount, reason },
    });

    res.json({
      message: `Revoked ${revokedCount} session(s) for ${user.email}`,
      revokedCount,
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/users/:id/reset-password-trigger — issue password reset token and email
adminRouter.post("/users/:id/reset-password-trigger", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "user id");
    const payload = (req.body || {}) as Record<string, unknown>;
    const reason = parseRequiredReason(payload.reason);
    const forceLogout = payload.forceLogout === undefined ? true : parseBooleanParam(payload.forceLogout, "forceLogout");

    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, "User not found");

    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = expiresAt;
    await user.save();

    if (forceLogout) {
      await RefreshToken.deleteMany({ userId: user._id });
    }

    sendPasswordResetEmail(user.email, user.displayName, token).catch((e) =>
      console.error("[MAIL] Admin password reset email failed:", e)
    );

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_trigger_password_reset",
      targetType: "user",
      targetId: user._id.toString(),
      metadata: {
        reason,
        forceLogout,
        resetExpiresAt: expiresAt,
      },
    });

    res.json({
      message: `Password reset email queued for ${user.email}`,
      forceLogout,
      resetExpiresAt: expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/users/:id/role — change user role
adminRouter.patch("/users/:id/role", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "user id");
    const { role, reason: reasonRaw } = req.body || {};
    const reason = parseRequiredReason(reasonRaw);
    if (!["user", "admin"].includes(role)) {
      throw new AppError(400, "Role must be 'user' or 'admin'");
    }

    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, "User not found");

    // Prevent removing own admin role
    if (user._id.toString() === req.user!.userId && role !== "admin") {
      throw new AppError(400, "Cannot remove your own admin role");
    }

    user.role = role;
    await user.save();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_role_change",
      targetType: "user",
      targetId: user._id.toString(),
      metadata: { newRole: role, reason },
    });

    res.json({ message: `User role updated to ${role}`, user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/users/:id — delete a user and all their data
adminRouter.delete("/users/:id", adminMutationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.id, "user id");
    const reason = parseRequiredReason((req.body || {}).reason);
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, "User not found");

    // Prevent self-deletion
    if (user._id.toString() === req.user!.userId) {
      throw new AppError(400, "Cannot delete your own account from admin panel");
    }

    // Delete all user-linked data and cleanup references to avoid orphans
    await Promise.all([
      DailyEntry.deleteMany({ userId: user._id }),
      Challenge.deleteMany({ userId: user._id }),
      Report.deleteMany({ ownerUserId: user._id }),
      EmailReminder.deleteMany({ userId: user._id }),
      RefreshToken.deleteMany({ userId: user._id }),
      VisibilityApproval.deleteMany({
        $or: [{ ownerUserId: user._id }, { viewerUserId: user._id }],
      }),
      Comment.deleteMany({
        $or: [{ ownerUserId: user._id }, { authorUserId: user._id }],
      }),
      Reaction.deleteMany({
        $or: [{ ownerUserId: user._id }, { authorUserId: user._id }],
      }),
      FamilyGroup.deleteMany({ ownerUserId: user._id }),
      FamilyGroup.updateMany(
        { "members.userId": user._id },
        { $pull: { members: { userId: user._id } } }
      ),
      Report.updateMany(
        { "accessLog.viewerUserId": user._id },
        { $pull: { accessLog: { viewerUserId: user._id } } }
      ),
      AuditLog.deleteMany({
        $or: [
          { actorUserId: user._id },
          { targetType: "user", targetId: user._id.toString() },
        ],
      }),
    ]);

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_delete_user",
      targetType: "user",
      targetId: user._id.toString(),
      metadata: { email: user.email, reason },
    });

    await user.deleteOne();

    res.json({ message: `User ${user.email} and all their data deleted` });
  } catch (err) {
    next(err);
  }
});

// GET /admin/audit — recent audit logs
adminRouter.get("/audit", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ logs });
  } catch (err) {
    next(err);
  }
});
