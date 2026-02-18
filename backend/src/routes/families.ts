import { Router, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { FamilyGroup } from "../models/FamilyGroup";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const familiesRouter = Router();

const createSchema = z.object({ name: z.string().min(1).max(100) });

familiesRouter.get("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.user!.userId);
    const groups = await FamilyGroup.find({
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
      members: [{ userId: req.user!.userId, role: "owner", status: "active" }],
    });
    await group.save();
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
});

familiesRouter.post("/:id/invite", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError(400, "Email required");

    const group = await FamilyGroup.findOne({ _id: req.params.id, ownerUserId: req.user!.userId });
    if (!group) throw new AppError(404, "Family group not found or not owner");

    const invitee = await User.findOne({ email });
    if (!invitee) throw new AppError(404, "User not found with that email");

    const already = group.members.find((m) => m.userId.toString() === invitee._id.toString());
    if (already) throw new AppError(409, "User already in group");

    group.members.push({ userId: invitee._id, role: "member", status: "invited", joinedAt: new Date() });
    await group.save();

    await AuditLog.create({ actorUserId: req.user!.userId, action: "family_invite", targetType: "family_group", targetId: group._id.toString(), metadata: { inviteeId: invitee._id } });

    res.json({ group });
  } catch (err) {
    next(err);
  }
});

familiesRouter.post("/:id/accept", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const group = await FamilyGroup.findById(req.params.id);
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
    const group = await FamilyGroup.findById(req.params.id);
    if (!group) throw new AppError(404, "Family group not found");
    if (group.ownerUserId.toString() === req.user!.userId) throw new AppError(400, "Owner cannot leave; delete group instead");

    group.members = group.members.filter((m) => m.userId.toString() !== req.user!.userId) as typeof group.members;
    await group.save();
    res.json({ message: "Left group" });
  } catch (err) {
    next(err);
  }
});

familiesRouter.delete("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const group = await FamilyGroup.findOneAndDelete({ _id: req.params.id, ownerUserId: req.user!.userId });
    if (!group) throw new AppError(404, "Family group not found or not owner");
    res.json({ message: "Family group deleted" });
  } catch (err) {
    next(err);
  }
});
