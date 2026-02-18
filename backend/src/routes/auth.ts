import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { z } from "zod";
import { User } from "../models/User";
import { RefreshToken } from "../models/RefreshToken";
import { AuditLog } from "../models/AuditLog";
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from "../utils/tokens";
import { AppError } from "../middleware/errorHandler";

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  keepSignedIn: z.boolean().optional().default(false),
});

authRouter.post("/signup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = signupSchema.parse(req.body);
    const existing = await User.findOne({ email: body.email });
    if (existing) throw new AppError(409, "Email already registered");

    const user = new User({
      email: body.email,
      passwordHash: body.password,
      displayName: body.displayName,
    });
    await user.save();

    const accessToken = generateAccessToken({ userId: user._id.toString(), email: user.email });
    const refreshTokenStr = generateRefreshToken();
    await RefreshToken.create({
      userId: user._id,
      token: refreshTokenStr,
      expiresAt: getRefreshTokenExpiry(),
    });

    await AuditLog.create({ actorUserId: user._id, action: "signup", targetType: "user", targetId: user._id.toString() });

    res.status(201).json({
      accessToken,
      refreshToken: refreshTokenStr,
      user: { id: user._id, email: user.email, displayName: user.displayName },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await User.findOne({ email: body.email });
    if (!user) throw new AppError(401, "Invalid email or password");

    const valid = await user.comparePassword(body.password);
    if (!valid) throw new AppError(401, "Invalid email or password");

    const accessToken = generateAccessToken({ userId: user._id.toString(), email: user.email });
    const refreshTokenStr = generateRefreshToken();
    const expiresAt = body.keepSignedIn
      ? new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    await RefreshToken.create({ userId: user._id, token: refreshTokenStr, expiresAt });

    await AuditLog.create({ actorUserId: user._id, action: "login", targetType: "user", targetId: user._id.toString(), metadata: { keepSignedIn: body.keepSignedIn } });

    res.json({
      accessToken,
      refreshToken: refreshTokenStr,
      user: { id: user._id, email: user.email, displayName: user.displayName },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }
    res.json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError(400, "Refresh token required");

    const stored = await RefreshToken.findOne({ token: refreshToken });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await stored.deleteOne();
      throw new AppError(401, "Invalid or expired refresh token");
    }

    const user = await User.findById(stored.userId);
    if (!user) throw new AppError(401, "User not found");

    await stored.deleteOne();

    const newAccessToken = generateAccessToken({ userId: user._id.toString(), email: user.email });
    const newRefreshTokenStr = generateRefreshToken();
    await RefreshToken.create({ userId: user._id, token: newRefreshTokenStr, expiresAt: getRefreshTokenExpiry() });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshTokenStr });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/password/forgot", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError(400, "Email required");

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: "If an account exists, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    // In production, send email with reset link containing `token`
    console.log(`[DEV] Password reset token for ${email}: ${token}`);

    await AuditLog.create({ actorUserId: user._id, action: "password_reset_request", targetType: "user", targetId: user._id.toString() });

    res.json({ message: "If an account exists, a reset link has been sent.", devToken: token });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/password/reset", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) throw new AppError(400, "Token and new password required");
    if (newPassword.length < 8) throw new AppError(400, "Password must be at least 8 characters");

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
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
