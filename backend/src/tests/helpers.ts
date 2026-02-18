import express from "express";
import cors from "cors";
import { authRouter } from "../routes/auth";
import { profileRouter } from "../routes/profile";
import { entriesRouter } from "../routes/entries";
import { challengesRouter } from "../routes/challenges";
import { familiesRouter } from "../routes/families";
import { reportsRouter } from "../routes/reports";
import { dashboardRouter } from "../routes/dashboard";
import { commentsRouter } from "../routes/comments";
import { visibilityRouter } from "../routes/visibility";
import { reminderRouter } from "../routes/reminders";
import { errorHandler } from "../middleware/errorHandler";

export function createApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/me", profileRouter);
  app.use("/entries", entriesRouter);
  app.use("/challenges", challengesRouter);
  app.use("/families", familiesRouter);
  app.use("/reports", reportsRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/comments", commentsRouter);
  app.use("/visibility", visibilityRouter);
  app.use("/reminders", reminderRouter);

  app.use(errorHandler);
  return app;
}

export async function createTestUser(app: ReturnType<typeof createApp>, overrides: Record<string, any> = {}) {
  const supertest = (await import("supertest")).default;
  const data = {
    email: overrides.email || `test${Date.now()}@example.com`,
    password: overrides.password || "password123",
    displayName: overrides.displayName || "Test User",
  };

  const res = await supertest(app)
    .post("/auth/signup")
    .send(data)
    .expect(201);

  return {
    ...data,
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    userId: res.body.user.id,
  };
}
