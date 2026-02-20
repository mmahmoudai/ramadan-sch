import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { sanitizeStr } from "../utils/sanitize";
import { Comment } from "../models/Comment";
import { Reaction } from "../models/Reaction";
import { VisibilityApproval } from "../models/VisibilityApproval";
import { AuditLog } from "../models/AuditLog";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const commentsRouter = Router();

const ALLOWED_TARGET_TYPES = ["entry", "challenge", "report", "family"] as const;
const ALLOWED_REACTION_TYPES = ["like", "love", "pray", "star", "fire"] as const;

const commentSchema = z.object({
  ownerUserId: z.string().min(1).max(100),
  targetType: z.enum(ALLOWED_TARGET_TYPES),
  targetId: z.string().min(1).max(100),
  body: z.string().min(1).max(1000).transform(sanitizeStr),
});

const reactionSchema = z.object({
  ownerUserId: z.string().min(1).max(100),
  targetType: z.enum(ALLOWED_TARGET_TYPES),
  targetId: z.string().min(1).max(100),
  reactionType: z.enum(ALLOWED_REACTION_TYPES),
});

function getVisibilityScopeForTarget(targetType: string): "dashboard" | "reports" {
  const normalized = targetType.toLowerCase();
  return normalized.includes("report") ? "reports" : "dashboard";
}

commentsRouter.get("/:targetType/:targetId", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const targetType = z.enum(ALLOWED_TARGET_TYPES).parse(req.params.targetType);
    const targetId = z.string().min(1).max(100).parse(req.params.targetId);
    const comments = await Comment.find({
      targetType,
      targetId,
      deletedByOwner: false,
    }).populate("authorUserId", "displayName avatarUrl").sort({ createdAt: -1 });

    const filtered = comments.map((c) => ({
      ...c.toObject(),
      body: c.hiddenByOwner ? "[hidden by owner]" : c.body,
    }));

    res.json({ comments: filtered });
  } catch (err) {
    next(err);
  }
});

commentsRouter.post("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = commentSchema.parse(req.body);

    if (body.ownerUserId !== req.user!.userId) {
      const scope = getVisibilityScopeForTarget(body.targetType);
      const approval = await VisibilityApproval.findOne({
        ownerUserId: body.ownerUserId,
        viewerUserId: req.user!.userId,
        scope,
        status: "approved",
      });
      if (!approval) throw new AppError(403, `Not approved to comment on this user's ${scope} content`);
    }

    const comment = new Comment({
      ownerUserId: body.ownerUserId,
      authorUserId: req.user!.userId,
      targetType: body.targetType,
      targetId: body.targetId,
      body: body.body,
    });
    await comment.save();
    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
});

commentsRouter.patch("/:id/hide", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.id, ownerUserId: req.user!.userId });
    if (!comment) throw new AppError(404, "Comment not found or not owner");

    comment.hiddenByOwner = !comment.hiddenByOwner;
    await comment.save();

    await AuditLog.create({ actorUserId: req.user!.userId, action: comment.hiddenByOwner ? "comment_hide" : "comment_unhide", targetType: "comment", targetId: comment._id.toString() });

    res.json({ comment });
  } catch (err) {
    next(err);
  }
});

commentsRouter.delete("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.id, ownerUserId: req.user!.userId });
    if (!comment) throw new AppError(404, "Comment not found or not owner");

    comment.deletedByOwner = true;
    await comment.save();

    await AuditLog.create({ actorUserId: req.user!.userId, action: "comment_delete", targetType: "comment", targetId: comment._id.toString() });

    res.json({ message: "Comment deleted" });
  } catch (err) {
    next(err);
  }
});

// Reactions
commentsRouter.post("/reactions", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = reactionSchema.parse(req.body);

    if (body.ownerUserId !== req.user!.userId) {
      const scope = getVisibilityScopeForTarget(body.targetType);
      const approval = await VisibilityApproval.findOne({
        ownerUserId: body.ownerUserId,
        viewerUserId: req.user!.userId,
        scope,
        status: "approved",
      });
      if (!approval) throw new AppError(403, `Not approved to react on this user's ${scope} content`);
    }

    const existing = await Reaction.findOne({
      authorUserId: req.user!.userId,
      targetType: body.targetType,
      targetId: body.targetId,
      reactionType: body.reactionType,
    });

    if (existing) {
      await existing.deleteOne();
      return res.json({ message: "Reaction removed" });
    }

    const reaction = new Reaction({
      ownerUserId: body.ownerUserId,
      authorUserId: req.user!.userId,
      targetType: body.targetType,
      targetId: body.targetId,
      reactionType: body.reactionType,
    });
    await reaction.save();
    res.status(201).json({ reaction });
  } catch (err) {
    next(err);
  }
});

commentsRouter.get("/reactions/:targetType/:targetId", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const targetType = z.enum(ALLOWED_TARGET_TYPES).parse(req.params.targetType);
    const targetId = z.string().min(1).max(100).parse(req.params.targetId);
    const reactions = await Reaction.find({ targetType, targetId }).populate("authorUserId", "displayName avatarUrl");
    res.json({ reactions });
  } catch (err) {
    next(err);
  }
});
