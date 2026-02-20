import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import { authRouter } from "./routes/auth";
import { profileRouter } from "./routes/profile";
import { entriesRouter } from "./routes/entries";
import { challengesRouter } from "./routes/challenges";
import { familiesRouter } from "./routes/families";
import { reportsRouter } from "./routes/reports";
import { dashboardRouter } from "./routes/dashboard";
import { commentsRouter } from "./routes/comments";
import { visibilityRouter } from "./routes/visibility";
import { reminderRouter } from "./routes/reminders";
import { adminRouter } from "./routes/admin";
import { errorHandler } from "./middleware/errorHandler";
import { authLimiter, generalLimiter } from "./middleware/rateLimiter";
import { startReminderCron } from "./jobs/reminderCron";
import { getConfig } from "./models/AppConfig";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Hard-fail if JWT_SECRET is missing or using the insecure default in production
if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-secret-change-in-production") {
    console.error("[FATAL] JWT_SECRET is not set or is using the insecure default. Refusing to start.");
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 4000;

const FRONTEND_ORIGIN = process.env.FRONTEND_URL || "http://localhost:3000";

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", FRONTEND_ORIGIN],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: "deny" },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
}));

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? FRONTEND_ORIGIN
    : true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Tight global body limit — individual routes can override downward
app.use(express.json({ limit: "50kb" }));
app.use(mongoSanitize({ replaceWith: "_" }));
app.use(generalLimiter);
app.use("/uploads", express.static("uploads"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Public: returns which languages are enabled — used by frontend before auth
app.get("/config/languages", async (_req, res, next) => {
  try {
    const enabledLanguages = await getConfig("enabledLanguages", ["en", "ar", "tr"]);
    res.json({ enabledLanguages });
  } catch (err) {
    next(err);
  }
});

app.use("/auth", authLimiter, authRouter);
app.use("/me", profileRouter);
app.use("/entries", entriesRouter);
app.use("/challenges", challengesRouter);
app.use("/families", familiesRouter);
app.use("/reports", reportsRouter);
app.use("/dashboard", dashboardRouter);
app.use("/comments", commentsRouter);
app.use("/visibility", visibilityRouter);
app.use("/reminders", reminderRouter);
app.use("/admin", adminRouter);

app.use(errorHandler);

async function start() {
  await connectDB();
  startReminderCron();
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
