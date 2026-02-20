import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { z } from "zod";
import { User } from "../models/User";
import { RefreshToken } from "../models/RefreshToken";
import { AuditLog } from "../models/AuditLog";
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from "../utils/tokens";
import { AppError } from "../middleware/errorHandler";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../utils/mailer";
import { detectTimezoneFromIp, getClientIp } from "../utils/timezoneDetector";
import { loginLimiter, signupLimiter, forgotPasswordLimiter } from "../middleware/rateLimiter";

export const authRouter = Router();

// Strip HTML/script tags from strings to prevent XSS stored in DB
function stripTags(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

// Ensure a value is a plain string (not object — prevents NoSQL injection via $gt/$ne etc.)
function assertString(val: unknown, field: string): string {
  if (typeof val !== "string") throw new AppError(400, `Invalid value for ${field}`);
  return val;
}

const signupSchema = z.object({
  email: z.string().email().max(254).transform((e) => e.toLowerCase().trim()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  displayName: z
    .string()
    .min(1, "Display name required")
    .max(60, "Display name too long")
    .transform(stripTags),
});

const loginSchema = z.object({
  email: z.string().email().max(254).transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1).max(128),
  keepSignedIn: z.boolean().optional().default(false),
});

const forgotSchema = z.object({
  email: z.string().email().max(254).transform((e) => e.toLowerCase().trim()),
});

const resetSchema = z.object({
  token: z.string().min(1).max(200).regex(/^[a-f0-9]+$/, "Invalid token format"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

authRouter.post("/signup", signupLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = signupSchema.parse(req.body);
    const existing = await User.findOne({ email: { $eq: body.email } });
    if (existing) throw new AppError(409, "Email already registered");

    // Detect timezone from IP for new users
    const clientIp = getClientIp(req);
    const timezoneInfo = await detectTimezoneFromIp(clientIp);

    const user = new User({
      email: body.email,
      passwordHash: body.password,
      displayName: body.displayName,
      timezoneIana: timezoneInfo.timezone,
      timezoneSource: "auto",
    });
    await user.save();

    console.log(`[TIMEZONE] Auto-detected timezone for new user ${user.email}: ${timezoneInfo.timezone} (IP: ${timezoneInfo.ip})`);

    const accessToken = generateAccessToken({ userId: user._id.toString(), email: user.email, role: user.role });
    const refreshTokenStr = generateRefreshToken();
    await RefreshToken.create({
      userId: user._id,
      token: refreshTokenStr,
      expiresAt: getRefreshTokenExpiry(),
    });

    await AuditLog.create({ actorUserId: user._id, action: "signup", targetType: "user", targetId: user._id.toString() });

    // Send welcome email (fire-and-forget)
    sendWelcomeEmail(user.email, user.displayName).catch((e) => console.error("[MAIL] Welcome email failed:", e));

    res.status(201).json({
      accessToken,
      refreshToken: refreshTokenStr,
      user: { 
        id: user._id, 
        email: user.email, 
        displayName: user.displayName, 
        role: user.role,
        timezoneIana: user.timezoneIana,
        timezoneSource: user.timezoneSource
      },
    });
  } catch (err) {
    next(err);
  }
});

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

authRouter.post("/login", loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await User.findOne({ email: { $eq: body.email } });
    // Always use the same error to prevent email enumeration
    if (!user) throw new AppError(401, "Invalid email or password");

    // Account lockout check
    if (user.isLocked()) {
      const minutesLeft = Math.ceil(((user.lockUntil as Date).getTime() - Date.now()) / 60000);
      throw new AppError(423, `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`);
    }

    const valid = await user.comparePassword(body.password);
    if (!valid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.loginAttempts = 0;
        await user.save();
        throw new AppError(423, "Too many failed attempts. Account locked for 30 minutes.");
      }
      await user.save();
      throw new AppError(401, "Invalid email or password");
    }

    // Successful login — reset lockout counters
    if (user.loginAttempts > 0 || user.lockUntil) {
      user.loginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    // Auto-detect timezone if not set manually
    if (!user.timezoneIana || user.timezoneSource === "auto") {
      const clientIp = getClientIp(req);
      const timezoneInfo = await detectTimezoneFromIp(clientIp);
      
      // Only update if timezone is different
      if (user.timezoneIana !== timezoneInfo.timezone) {
        user.timezoneIana = timezoneInfo.timezone;
        user.timezoneSource = "auto";
        await user.save();
        console.log(`[TIMEZONE] Auto-detected timezone for user ${user.email}: ${timezoneInfo.timezone} (IP: ${timezoneInfo.ip})`);
      }
    }

    const accessToken = generateAccessToken({ userId: user._id.toString(), email: user.email, role: user.role });
    const refreshTokenStr = generateRefreshToken();
    const expiresAt = body.keepSignedIn
      ? new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    await RefreshToken.create({ userId: user._id, token: refreshTokenStr, expiresAt });

    await AuditLog.create({ actorUserId: user._id, action: "login", targetType: "user", targetId: user._id.toString(), metadata: { keepSignedIn: body.keepSignedIn } });

    res.json({
      accessToken,
      refreshToken: refreshTokenStr,
      user: { 
        id: user._id, 
        email: user.email, 
        displayName: user.displayName, 
        role: user.role,
        timezoneIana: user.timezoneIana,
        timezoneSource: user.timezoneSource
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : null;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: { $eq: refreshToken } });
    }
    res.json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = assertString(req.body?.refreshToken, "refreshToken");
    if (!refreshToken) throw new AppError(400, "Refresh token required");

    const stored = await RefreshToken.findOne({ token: { $eq: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await stored.deleteOne();
      throw new AppError(401, "Invalid or expired refresh token");
    }

    const user = await User.findById(stored.userId);
    if (!user) throw new AppError(401, "User not found");

    await stored.deleteOne();

    const newAccessToken = generateAccessToken({ userId: user._id.toString(), email: user.email, role: user.role });
    const newRefreshTokenStr = generateRefreshToken();
    await RefreshToken.create({ userId: user._id, token: newRefreshTokenStr, expiresAt: getRefreshTokenExpiry() });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshTokenStr });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/password/forgot", forgotPasswordLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotSchema.parse(req.body);

    const user = await User.findOne({ email: { $eq: email } });
    if (!user) {
      return res.json({ message: "If an account exists, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    // Send password reset email
    sendPasswordResetEmail(user.email, user.displayName, token).catch((e) => console.error("[MAIL] Password reset email failed:", e));

    await AuditLog.create({ actorUserId: user._id, action: "password_reset_request", targetType: "user", targetId: user._id.toString() });

    res.json({ message: "If an account exists, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/password/reset", forgotPasswordLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = resetSchema.parse(req.body);

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: { $eq: hashedToken },
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) throw new AppError(400, "Invalid or expired reset token");

    user.passwordHash = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    await RefreshToken.deleteMany({ userId: user._id });

    await AuditLog.create({ actorUserId: user._id, action: "password_reset_complete", targetType: "user", targetId: user._id.toString() });

    res.json({ message: "Password reset successful" });
  } catch (err) {
    next(err);
  }
});
