import { Router, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { sanitizeStr } from "../utils/sanitize";
import { User } from "../models/User";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

// Magic bytes for allowed image types (prevents disguised file uploads)
const IMAGE_MAGIC: Array<{ bytes: number[]; offset: number; mime: string }> = [
  { bytes: [0xff, 0xd8, 0xff], offset: 0, mime: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0, mime: "image/png" },
  { bytes: [0x47, 0x49, 0x46], offset: 0, mime: "image/gif" },
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mime: "image/webp" },
];

function isAllowedImageMagic(filePath: string): boolean {
  try {
    const buf = Buffer.alloc(12);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    return IMAGE_MAGIC.some(({ bytes, offset }) =>
      bytes.every((b, i) => buf[offset + i] === b)
    );
  } catch {
    return false;
  }
}

export const profileRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/"),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const profileUpdateSchema = z.object({
  displayName: z.string().min(1).max(60).transform(sanitizeStr).optional(),
  bio: z.string().max(300).transform(sanitizeStr).optional(),
});

const settingsUpdateSchema = z.object({
  language: z.enum(["ar", "en", "tr"]).optional(),
  timezoneIana: z.string().min(1).max(100).transform(sanitizeStr).optional(),
  timezoneSource: z.enum(["auto", "manual"]).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderTimeLocal: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM").optional(),
});

profileRouter.get("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user!.userId).select("-passwordHash -resetPasswordToken -resetPasswordExpires");
    if (!user) throw new AppError(404, "User not found");
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

profileRouter.patch("/profile", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = profileUpdateSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(req.user!.userId, { $set: body }, { new: true }).select("-passwordHash -resetPasswordToken -resetPasswordExpires");
    if (!user) throw new AppError(404, "User not found");
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

profileRouter.post("/avatar", requireAuth, upload.single("avatar"), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError(400, "No file uploaded");

    // Validate actual file content via magic bytes — reject disguised executables
    if (!isAllowedImageMagic(req.file.path)) {
      fs.unlinkSync(req.file.path);
      throw new AppError(400, "Invalid image file");
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(req.user!.userId, { avatarUrl }, { new: true }).select("-passwordHash -resetPasswordToken -resetPasswordExpires");
    if (!user) throw new AppError(404, "User not found");
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

profileRouter.patch("/settings", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = settingsUpdateSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(req.user!.userId, { $set: body }, { new: true }).select("-passwordHash -resetPasswordToken -resetPasswordExpires");
    if (!user) throw new AppError(404, "User not found");
    res.json({ user });
  } catch (err) {
    next(err);
  }
});
