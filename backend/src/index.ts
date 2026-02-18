import express from "express";
import cors from "cors";
import helmet from "helmet";
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL || "http://localhost:3000"
    : true,
  credentials: true,
}));
app.use(express.json());
app.use(generalLimiter);
app.use("/uploads", express.static("uploads"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
