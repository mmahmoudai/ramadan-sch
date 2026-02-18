import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "./errorHandler";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

export interface AuthPayload {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError(401, "Authentication required"));
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    return next(new AppError(401, "Invalid or expired token"));
  }
}
