import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { VisibilityApproval } from "../models/VisibilityApproval";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const visibilityRouter = Router();

const requestSchema = z.object({
  ownerUserId: z.string(),
  scope: z.enum(["dashboard", "reports"]),
});

visibilityRouter.get("/approvals", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const asOwner = await VisibilityApproval.find({ ownerUserId: req.user!.userId })
      .populate("viewerUserId", "displayName email avatarUrl");
    const asViewer = await VisibilityApproval.find({ viewerUserId: req.user!.userId })
      .populate("ownerUserId", "displayName email avatarUrl");
    res.json({ asOwner, asViewer });
  } catch (err) {
    next(err);
  }
});

visibilityRouter.post("/request", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = requestSchema.parse(req.body);
    if (body.ownerUserId === req.user!.userId) throw new AppError(400, "Cannot request access to yourself");

    const existing = await VisibilityApproval.findOne({
      ownerUserId: body.ownerUserId,
      viewerUserId: req.user!.userId,
      scope: body.scope,
    });
    if (existing) throw new AppError(409, "Request already exists");

    const approval = new VisibilityApproval({
      ownerUserId: body.ownerUserId,
      viewerUserId: req.user!.userId,
      scope: body.scope,
      status: "pending",
    });
    await approval.save();
    res.status(201).json({ approval });
  } catch (err) {
    next(err);
  }
});

const respondSchema = z.object({
  action: z.enum(["approved", "rejected"]),
});

visibilityRouter.post("/approvals/:id/respond", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { action } = respondSchema.parse(req.body);

    const approval = await VisibilityApproval.findOne({ _id: req.params.id, ownerUserId: req.user!.userId });
    if (!approval) throw new AppError(404, "Approval not found or not owner");

    approval.status = action;
    await approval.save();

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: `visibility_${action}`,
      targetType: "visibility_approval",
      targetId: approval._id.toString(),
      metadata: { viewerUserId: approval.viewerUserId, scope: approval.scope },
    });

    res.json({ approval });
  } catch (err) {
    next(err);
  }
});

visibilityRouter.delete("/approvals/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const approval = await VisibilityApproval.findOneAndDelete({
      _id: req.params.id,
      $or: [{ ownerUserId: req.user!.userId }, { viewerUserId: req.user!.userId }],
    });
    if (!approval) throw new AppError(404, "Approval not found");
    res.json({ message: "Approval removed" });
  } catch (err) {
    next(err);
  }
});
