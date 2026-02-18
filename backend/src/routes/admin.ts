import { Router, Response, NextFunction } from "express";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { DailyEntry } from "../models/DailyEntry";
import { Challenge } from "../models/Challenge";
import { Report } from "../models/Report";
import { AuditLog } from "../models/AuditLog";
import { EmailReminder } from "../models/EmailReminder";
import { FamilyGroup } from "../models/FamilyGroup";
import { AppError } from "../middleware/errorHandler";

export const adminRouter = Router();

// All admin routes require auth + admin role
adminRouter.use(requireAuth, requireAdmin);

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

// GET /admin/users — list all users with pagination
adminRouter.get("/users", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || "";
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { displayName: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("email displayName role language createdAt updatedAt reminderEnabled"),
      User.countDocuments(filter),
    ]);

    // Get entry counts per user
    const userIds = users.map((u) => u._id);
    const entryCounts = await DailyEntry.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]);
    const entryMap = new Map(entryCounts.map((e: any) => [e._id.toString(), e.count]));

    const usersWithStats = users.map((u) => ({
      id: u._id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      language: u.language,
      reminderEnabled: u.reminderEnabled,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      entryCount: entryMap.get(u._id.toString()) || 0,
    }));

    res.json({
      users: usersWithStats,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/users/:id/role — change user role
adminRouter.patch("/users/:id/role", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body;
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
      metadata: { newRole: role },
    });

    res.json({ message: `User role updated to ${role}`, user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/users/:id — delete a user and all their data
adminRouter.delete("/users/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, "User not found");

    // Prevent self-deletion
    if (user._id.toString() === req.user!.userId) {
      throw new AppError(400, "Cannot delete your own account from admin panel");
    }

    // Delete all user data
    await Promise.all([
      DailyEntry.deleteMany({ userId: user._id }),
      Challenge.deleteMany({ userId: user._id }),
      Report.deleteMany({ ownerUserId: user._id }),
      EmailReminder.deleteMany({ userId: user._id }),
    ]);

    await AuditLog.create({
      actorUserId: req.user!.userId,
      action: "admin_delete_user",
      targetType: "user",
      targetId: user._id.toString(),
      metadata: { email: user.email },
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
