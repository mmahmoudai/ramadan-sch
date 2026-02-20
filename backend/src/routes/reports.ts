import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Report } from "../models/Report";
import { DailyEntry } from "../models/DailyEntry";
import { User } from "../models/User";
import { VisibilityApproval } from "../models/VisibilityApproval";
import { AuditLog } from "../models/AuditLog";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const reportsRouter = Router();

const createSchema = z.object({
  periodScope: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  visibility: z.enum(["public", "private"]),
  includeProfileInfo: z.boolean().optional().default(false),
});

reportsRouter.get("/public/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await Report.findOne({ publicToken: req.params.token, visibility: "public", revokedAt: null });
    if (!report) throw new AppError(404, "Report not found or revoked");

    const entries = await DailyEntry.find({
      userId: report.ownerUserId,
      gregorianDate: { $gte: report.periodStart, $lte: report.periodEnd },
    }).sort({ gregorianDate: 1 });

    let owner = null;
    if (report.includeProfileInfo) {
      owner = await User.findById(report.ownerUserId).select("displayName bio avatarUrl");
    }

    report.accessLog.push({ viewerUserId: null, accessType: "public", accessedAt: new Date() });
    await report.save();

    res.json({ report, entries, owner });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/mine", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reports = await Report.find({ ownerUserId: req.user!.userId }).sort({ createdAt: -1 });
    res.json({ reports });
  } catch (err) {
    next(err);
  }
});

reportsRouter.post("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const report = new Report({
      ownerUserId: req.user!.userId,
      ...body,
    });
    await report.save();
    res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) throw new AppError(404, "Report not found");

    const isOwner = report.ownerUserId.toString() === req.user!.userId;
    if (!isOwner) {
      const approval = await VisibilityApproval.findOne({
        ownerUserId: report.ownerUserId,
        viewerUserId: req.user!.userId,
        scope: "reports",
        status: "approved",
      });
      if (!approval) throw new AppError(403, "Access denied");
    }

    const entries = await DailyEntry.find({
      userId: report.ownerUserId,
      gregorianDate: { $gte: report.periodStart, $lte: report.periodEnd },
    }).sort({ gregorianDate: 1 });

    let owner = null;
    if (report.includeProfileInfo || isOwner) {
      owner = await User.findById(report.ownerUserId).select("displayName bio avatarUrl");
    }

    report.accessLog.push({ viewerUserId: req.user!.userId as any, accessType: "private", accessedAt: new Date() });
    await report.save();

    res.json({ report, entries, owner });
  } catch (err) {
    next(err);
  }
});

reportsRouter.post("/:id/revoke", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, ownerUserId: req.user!.userId });
    if (!report) throw new AppError(404, "Report not found");

    report.revokedAt = new Date();
    await report.save();

    await AuditLog.create({ actorUserId: req.user!.userId, action: "report_revoke", targetType: "report", targetId: report._id.toString() });

    res.json({ message: "Public link revoked", report });
  } catch (err) {
    next(err);
  }
});

reportsRouter.delete("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await Report.findOneAndDelete({ _id: req.params.id, ownerUserId: req.user!.userId });
    if (!report) throw new AppError(404, "Report not found");

    await AuditLog.create({ actorUserId: req.user!.userId, action: "report_delete", targetType: "report", targetId: req.params.id });

    res.json({ message: "Report deleted" });
  } catch (err) {
    next(err);
  }
});

reportsRouter.post("/:id/share-link", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, ownerUserId: req.user!.userId });
    if (!report) throw new AppError(404, "Report not found");

    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    let link: string;

    if (report.visibility === "public" && report.publicToken && !report.revokedAt) {
      link = `${baseUrl}/reports/public/${report.publicToken}`;
    } else {
      link = `${baseUrl}/reports/${report._id}`;
    }

    res.json({ link, visibility: report.visibility });
  } catch (err) {
    next(err);
  }
});
