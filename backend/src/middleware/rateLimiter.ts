import rateLimit from "express-rate-limit";

// General auth limiter (signup, refresh, logout)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for login — prevent brute force
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: "Too many login attempts, please try again in 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failed attempts
});

// Strict limiter for signup — prevent mass account creation
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: "Too many accounts created from this IP, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict limiter for forgot-password — prevent email enumeration/spam
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: "Too many password reset requests, please try again in an hour" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: { error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminMutationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,
  message: { error: "Too many admin actions, please retry shortly" },
  standardHeaders: true,
  legacyHeaders: false,
});
