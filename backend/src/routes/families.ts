import { Router, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { sanitizeStr } from "../utils/sanitize";
import { FamilyGroup } from "../models/FamilyGroup";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { DailyEntry } from "../models/DailyEntry";
import { Challenge } from "../models/Challenge";
import { Report } from "../models/Report";
import { Comment } from "../models/Comment";
import { Reaction } from "../models/Reaction";
import { VisibilityApproval } from "../models/VisibilityApproval";
import { FamilyGift } from "../models/FamilyGift";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { getFieldCategory } from "./dashboard";
import { sendFamilyInviteEmail, sendFamilyInviteConfirmation } from "../utils/mailer";

export const familiesRouter = Router();

const createSchema = z.object({ name: z.string().min(1).max(100).transform(sanitizeStr) });
const feedFilterSchema = z.enum(["all", "entries", "challenges", "reports", "social"]);
type FeedFilter = z.infer<typeof feedFilterSchema>;

type FeedEventType = "entries" | "challenges" | "reports" | "social";

interface FeedEvent {
  id: string;
  type: FeedEventType;
  subtype: string;
  occurredAt: Date;
  actor: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  data: Record<string, unknown>;
}

function parseLimit(raw: unknown): number {
  const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n)) return 20;
  return Math.min(50, Math.max(1, n));
}

function parseCursor(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) {
    throw new AppError(400, "Invalid cursor");
  }
  return dt;
}

function toObjectIds(ids: string[]): mongoose.Types.ObjectId[] {
  return ids.map((id) => new mongoose.Types.ObjectId(id));
}

familiesRouter.get("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.user!.userId);
    const groups = await FamilyGroup.find({
      archivedAt: null,
      $or: [
        { ownerUserId: uid },
        { "members.userId": uid },
      ],
    }).populate("members.userId", "displayName email avatarUrl");
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

familiesRouter.post("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const group = new FamilyGroup({
      ownerUserId: req.user!.userId,
      name: body.name,
      archivedAt: null,
      members: [{ userId: req.user!.userId, role: "owner", status: "active" }],
    });
    await group.save();
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
});

familiesRouter.get("/:id/feed", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsedFilter = feedFilterSchema.safeParse(req.query.filter ?? "all");
    if (!parsedFilter.success) {
      throw new AppError(400, "Invalid feed filter");
    }
    const filter = parsedFilter.data as FeedFilter;
    const limit = parseLimit(req.query.limit);
    const cursor = parseCursor(req.query.cursor);
    const scanLimit = Math.min(200, Math.max(40, limit * 5));

    const group = await FamilyGroup.findOne({ _id: req.params.id, archivedAt: null });
    if (!group) throw new AppError(404, "Family group not found");

    const requesterId = req.user!.userId;
    const isOwner = group.ownerUserId.toString() === requesterId;
    const isActiveMember = group.members.some(
      (m) => m.userId.toString() === requesterId && m.status === "active"
    );
    if (!isOwner && !isActiveMember) {
      throw new AppError(403, "Access denied");
    }

    const activeMemberIdSet = new Set<string>();
    activeMemberIdSet.add(group.ownerUserId.toString());
    for (const member of group.members) {
      if (member.status === "active") {
        activeMemberIdSet.add(member.userId.toString());
      }
    }
    const activeMemberIds = Array.from(activeMemberIdSet);

    const users = await User.find({
      _id: { $in: toObjectIds(activeMemberIds) },
    }).select("displayName avatarUrl");
    const userMap = new Map(
      users.map((u) => [
        u._id.toString(),
        {
          id: u._id.toString(),
          displayName: u.displayName || "User",
          avatarUrl: u.avatarUrl || null,
        },
      ])
    );

    const approvals = await VisibilityApproval.find({
      ownerUserId: { $in: toObjectIds(activeMemberIds.filter((id) => id !== requesterId)) },
      viewerUserId: new mongoose.Types.ObjectId(requesterId),
      status: "approved",
    }).select("ownerUserId scope");

    const dashboardAllowed = new Set<string>([requesterId]);
    const reportsAllowed = new Set<string>([requesterId]);
    for (const approval of approvals) {
      const ownerId = approval.ownerUserId.toString();
      if (approval.scope === "dashboard") {
        dashboardAllowed.add(ownerId);
      }
      if (approval.scope === "reports") {
        reportsAllowed.add(ownerId);
      }
    }

    const eventBuckets: FeedEvent[] = [];
    const includeEntries = filter === "all" || filter === "entries";
    const includeChallenges = filter === "all" || filter === "challenges";
    const includeReports = filter === "all" || filter === "reports";
    const includeSocial = filter === "all" || filter === "social";

    if (includeEntries) {
      const entries = await DailyEntry.find({
        userId: { $in: toObjectIds(Array.from(dashboardAllowed)) },
        ...(cursor ? { updatedAt: { $lt: cursor } } : {}),
      })
        .sort({ updatedAt: -1 })
        .limit(scanLimit)
        .lean();

      for (const entry of entries) {
        const actorId = entry.userId.toString();
        const completedFields = entry.fields.filter((f) => f.completed).length;
        eventBuckets.push({
          id: `entry:${entry._id.toString()}`,
          type: "entries",
          subtype: "entry_updated",
          occurredAt: new Date(entry.updatedAt),
          actor: userMap.get(actorId) || { id: actorId, displayName: "User", avatarUrl: null },
          data: {
            gregorianDate: entry.gregorianDate,
            status: entry.status,
            completedFields,
            totalFields: entry.fields.length,
          },
        });
      }
    }

    if (includeChallenges) {
      const challenges = await Challenge.find({
        userId: { $in: toObjectIds(Array.from(dashboardAllowed)) },
        ...(cursor ? { updatedAt: { $lt: cursor } } : {}),
      })
        .sort({ updatedAt: -1 })
        .limit(scanLimit)
        .lean();

      for (const challenge of challenges) {
        const actorId = challenge.userId.toString();
        eventBuckets.push({
          id: `challenge:${challenge._id.toString()}`,
          type: "challenges",
          subtype: "challenge_updated",
          occurredAt: new Date(challenge.updatedAt),
          actor: userMap.get(actorId) || { id: actorId, displayName: "User", avatarUrl: null },
          data: {
            title: challenge.title,
            scope: challenge.scope,
            active: challenge.active,
            progressCount: challenge.progress.length,
          },
        });
      }
    }

    if (includeReports) {
      const reports = await Report.find({
        ownerUserId: { $in: toObjectIds(Array.from(reportsAllowed)) },
        ...(cursor ? { createdAt: { $lt: cursor } } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(scanLimit)
        .lean();

      for (const report of reports) {
        const actorId = report.ownerUserId.toString();
        eventBuckets.push({
          id: `report:${report._id.toString()}`,
          type: "reports",
          subtype: "report_created",
          occurredAt: new Date(report.createdAt),
          actor: userMap.get(actorId) || { id: actorId, displayName: "User", avatarUrl: null },
          data: {
            periodScope: report.periodScope,
            periodStart: report.periodStart,
            periodEnd: report.periodEnd,
            visibility: report.visibility,
          },
        });
      }
    }

    if (includeSocial) {
      const comments = await Comment.find({
        ownerUserId: { $in: toObjectIds(Array.from(dashboardAllowed)) },
        authorUserId: { $in: toObjectIds(activeMemberIds) },
        deletedByOwner: false,
        ...(cursor ? { createdAt: { $lt: cursor } } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(scanLimit)
        .lean();

      for (const comment of comments) {
        const actorId = comment.authorUserId.toString();
        eventBuckets.push({
          id: `comment:${comment._id.toString()}`,
          type: "social",
          subtype: "comment_created",
          occurredAt: new Date(comment.createdAt),
          actor: userMap.get(actorId) || { id: actorId, displayName: "User", avatarUrl: null },
          data: {
            ownerUserId: comment.ownerUserId.toString(),
            targetType: comment.targetType,
            targetId: comment.targetId.toString(),
            body: comment.hiddenByOwner ? "[hidden by owner]" : comment.body,
          },
        });
      }

      const reactions = await Reaction.find({
        ownerUserId: { $in: toObjectIds(Array.from(dashboardAllowed)) },
        authorUserId: { $in: toObjectIds(activeMemberIds) },
        ...(cursor ? { createdAt: { $lt: cursor } } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(scanLimit)
        .lean();

      for (const reaction of reactions) {
        const actorId = reaction.authorUserId.toString();
        eventBuckets.push({
          id: `reaction:${reaction._id.toString()}`,
          type: "social",
          subtype: "reaction_created",
          occurredAt: new Date(reaction.createdAt),
          actor: userMap.get(actorId) || { id: actorId, displayName: "User", avatarUrl: null },
          data: {
            ownerUserId: reaction.ownerUserId.toString(),
            targetType: reaction.targetType,
            targetId: reaction.targetId.toString(),
            reactionType: reaction.reactionType,
          },
        });
      }
    }

    eventBuckets.sort((a, b) => {
      const timeDiff = b.occurredAt.getTime() - a.occurredAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id < b.id ? 1 : -1;
    });

    const hasMore = eventBuckets.length > limit;
    const page = eventBuckets.slice(0, limit);
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].occurredAt.toISOString() : null;

    res.json({
      events: page.map((e) => ({
        ...e,
        occurredAt: e.occurredAt.toISOString(),
      })),
      nextCursor,
      hasMore,
      filter,
    });
  } catch (err) {
    next(err);
  }
});

familiesRouter.post("/:id/invite", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rawEmail = req.body?.email;
    if (typeof rawEmail !== "string" || !rawEmail.trim()) throw new AppError(400, "Email required");
    const email = rawEmail.toLowerCase().trim().slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, "Invalid email address");

    const group = await FamilyGroup.findOne({ _id: req.params.id, ownerUserId: req.user!.userId, archivedAt: null });
    if (!group) throw new AppError(404, "Family group not found or not owner");

    const invitee = await User.findOne({ email: { $eq: email } });
    if (!invitee) throw new AppError(404, "User not found with that email");

    const already = group.members.find((m) => m.userId.toString() === invitee._id.toString());
    if (already) throw new AppError(409, "User already in group");

    group.members.push({ userId: invitee._id, role: "member", status: "invited", joinedAt: new Date() });
    await group.save();

    await AuditLog.create({ actorUserId: req.user!.userId, action: "family_invite", targetType: "family_group", targetId: group._id.toString(), metadata: { inviteeId: invitee._id } });

    // Send emails to both invitee and inviter (fire-and-forget)
    const inviter = await User.findById(req.user!.userId);
    const inviterName = inviter?.displayName || "Someone";
    sendFamilyInviteEmail(invitee.email, invitee.displayName, inviterName, group.name)
      .catch((e) => console.error("[MAIL] Family invite email failed:", e));
    if (inviter) {
      sendFamilyInviteConfirmation(inviter.email, inviter.displayName, invitee.displayName, group.name)
        .catch((e) => console.error("[MAIL] Family invite confirmation failed:", e));
    }

    res.json({ group });
  } catch (err) {
    next(err);
  }
});

familiesRouter.post("/:id/accept", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const group = await FamilyGroup.findOne({ _id: req.params.id, archivedAt: null });
    if (!group) throw new AppError(404, "Family group not found");

    const member = group.members.find((m) => m.userId.toString() === req.user!.userId && m.status === "invited");
    if (!member) throw new AppError(404, "No pending invitation");

    member.status = "active";
    member.joinedAt = new Date();
    await group.save();
    res.json({ group });
  } catch (err) {
    next(err);
  }
});

familiesRouter.post("/:id/leave", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const group = await FamilyGroup.findOne({ _id: req.params.id, archivedAt: null });
    if (!group) throw new AppError(404, "Family group not found");
    if (group.ownerUserId.toString() === req.user!.userId) throw new AppError(400, "Owner cannot leave; delete group instead");

    group.members = group.members.filter((m) => m.userId.toString() !== req.user!.userId) as typeof group.members;
    await group.save();
    res.json({ message: "Left group" });
  } catch (err) {
    next(err);
  }
});

const giftSchema = z.object({
  toUserId: z.string().min(1).max(100),
  type: z.enum(["gift", "badge", "certificate"]),
  icon: z.string().min(1).max(10).transform(sanitizeStr),
  title: z.string().min(1).max(100).transform(sanitizeStr),
  message: z.string().max(500).optional().default("").transform(sanitizeStr),
});

familiesRouter.get("/:id/stats", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const group = await FamilyGroup.findOne({ _id: req.params.id, archivedAt: null });
    if (!group) throw new AppError(404, "Family group not found");

    const requesterId = req.user!.userId;
    const isOwner = group.ownerUserId.toString() === requesterId;
    const isActiveMember = group.members.some(
      (m) => m.userId.toString() === requesterId && m.status === "active"
    );
    if (!isOwner && !isActiveMember) throw new AppError(403, "Access denied");

    const activeMemberIds = group.members
      .filter((m) => m.status === "active")
      .map((m) => m.userId);

    const users = await User.find({ _id: { $in: activeMemberIds } })
      .select("displayName email avatarUrl");
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const memberStats = await Promise.all(
      activeMemberIds.map(async (memberId) => {
        const uid = memberId.toString();
        const user = userMap.get(uid);
        const member = group.members.find((m) => m.userId.toString() === uid);

        const [entries, challenges, giftsReceived] = await Promise.all([
          DailyEntry.find({ userId: memberId })
            .select("gregorianDate fields.fieldKey fields.completed")
            .lean(),
          Challenge.find({ userId: memberId })
            .select("active progress.completed")
            .lean(),
          FamilyGift.countDocuments({ familyId: group._id, toUserId: memberId }),
        ]);

        const totalEntries = entries.length;
        const completedFields = entries.reduce(
          (sum, e) => sum + e.fields.filter((f) => f.completed).length, 0
        );
        const totalFields = entries.reduce((sum, e) => sum + e.fields.length, 0);
        const completionRate = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

        // Calculate streak using string-based date set (consistent with dashboard)
        const dateSet = new Set(entries.map((e) => e.gregorianDate));
        let streak = 0;
        const cursor = new Date();
        for (let i = 0; i < 366; i++) {
          const d = new Date(cursor);
          d.setDate(cursor.getDate() - i);
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          if (!dateSet.has(ds)) break;
          streak++;
        }

        const activeChallenges = challenges.filter((c) => c.active).length;
        const completedProgressEntries = challenges.reduce(
          (sum, c) => sum + c.progress.filter((p) => p.completed).length, 0
        );
        const totalProgress = challenges.reduce((sum, c) => sum + c.progress.length, 0);

        // Points system
        const points =
          totalEntries * 10 +
          completedFields * 2 +
          completedProgressEntries * 25 +
          streak * 5 +
          giftsReceived * 3;

        return {
          userId: uid,
          displayName: user?.displayName || "User",
          email: user?.email || "",
          avatarUrl: user?.avatarUrl || null,
          role: member?.role || "member",
          joinedAt: member?.joinedAt || null,
          stats: {
            totalEntries,
            completedFields,
            totalFields,
            completionRate,
            streak,
            activeChallenges,
            totalChallenges: challenges.length,
            completedProgressEntries,
            totalProgress,
            giftsReceived,
            points,
          },
        };
      })
    );

    // Family-level aggregates
    const familyStats = {
      totalMembers: activeMemberIds.length,
      totalEntries: memberStats.reduce((s, m) => s + m.stats.totalEntries, 0),
      avgCompletionRate: memberStats.length > 0
        ? Math.round(memberStats.reduce((s, m) => s + m.stats.completionRate, 0) / memberStats.length)
        : 0,
      totalChallenges: memberStats.reduce((s, m) => s + m.stats.totalChallenges, 0),
      totalPoints: memberStats.reduce((s, m) => s + m.stats.points, 0),
      longestStreak: Math.max(0, ...memberStats.map((m) => m.stats.streak)),
    };

    res.json({ familyStats, memberStats });
  } catch (err) {
    next(err);
  }
});

familiesRouter.get("/:id/gifts", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const group = await FamilyGroup.findOne({ _id: req.params.id, archivedAt: null });
    if (!group) throw new AppError(404, "Family group not found");

    const requesterId = req.user!.userId;
    const isOwner = group.ownerUserId.toString() === requesterId;
    const isActiveMember = group.members.some(
      (m) => m.userId.toString() === requesterId && m.status === "active"
    );
    if (!isOwner && !isActiveMember) throw new AppError(403, "Access denied");

    const gifts = await FamilyGift.find({ familyId: group._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("fromUserId", "displayName avatarUrl")
      .populate("toUserId", "displayName avatarUrl")
      .lean();

    res.json({ gifts });
  } catch (err) {
    next(err);
  }
});

familiesRouter.post("/:id/gifts", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = giftSchema.parse(req.body);
    const group = await FamilyGroup.findOne({ _id: req.params.id, archivedAt: null });
    if (!group) throw new AppError(404, "Family group not found");

    const requesterId = req.user!.userId;
    const isOwner = group.ownerUserId.toString() === requesterId;
    const isActiveMember = group.members.some(
      (m) => m.userId.toString() === requesterId && m.status === "active"
    );
    if (!isOwner && !isActiveMember) throw new AppError(403, "Access denied");

    const recipientIsMember = group.members.some(
      (m) => m.userId.toString() === body.toUserId && m.status === "active"
    );
    if (!recipientIsMember) throw new AppError(400, "Recipient is not an active member of this family");

    if (body.toUserId === requesterId) throw new AppError(400, "Cannot send a gift to yourself");

    const gift = await FamilyGift.create({
      familyId: group._id,
      fromUserId: requesterId,
      toUserId: body.toUserId,
      type: body.type,
      icon: body.icon,
      title: body.title,
      message: body.message,
    });

    const populated = await FamilyGift.findById(gift._id)
      .populate("fromUserId", "displayName avatarUrl")
      .populate("toUserId", "displayName avatarUrl");

    res.status(201).json({ gift: populated });
  } catch (err) {
    next(err);
  }
});

familiesRouter.delete("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const group = await FamilyGroup.findOneAndDelete({ _id: req.params.id, ownerUserId: req.user!.userId, archivedAt: null });
    if (!group) throw new AppError(404, "Family group not found or not owner");
    res.json({ message: "Family group deleted" });
  } catch (err) {
    next(err);
  }
});
