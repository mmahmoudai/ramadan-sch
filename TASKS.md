# Ramadan Tracker v1 - Execution Tasks

## Task Status Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- Priority: `P0` critical, `P1` high, `P2` medium

## 0) Foundation Setup
- [x] `P0` Create mono-repo/project structure for frontend + backend.
- [x] `P0` Separate frontend (Next.js) and backend (Express) into own directories.
- [x] `P0` Create shared types package for cross-project TypeScript interfaces.
- [x] `P0` Scaffold API route stubs for all planned endpoints.
- [x] `P0` Add .env.example, .gitignore, and README with project structure docs.
- [x] `P0` Switch database to MongoDB/Mongoose (local).
- [x] `P0` Create all Mongoose models (User, RefreshToken, DailyEntry, Challenge, FamilyGroup, VisibilityApproval, Comment, Reaction, Report, AuditLog, EmailReminder).
- [ ] `P0` Set up CI pipeline (lint, test, build, migration checks).
- [ ] `P1` Add code quality tooling (ESLint, Prettier, TypeScript strict mode).
- [ ] `P1` Add base observability (request logs + error tracking).

## 1) Authentication & Session
- [x] `P0` Implement email/password signup.
- [x] `P0` Implement login/logout flows.
- [x] `P0` Implement forgot/reset password flow.
- [x] `P0` Implement 45-day persistent session ("keep me signed in").
- [x] `P0` Implement token refresh endpoint.
- [x] `P1` Add login brute-force rate limiting.
- [x] `P1` Add session revocation endpoint.
- [x] `P0` Build login/signup/forgot-password frontend pages.
- [ ] `P1` Add auth E2E tests.

## 2) Profile & User Settings
- [x] `P0` Build profile screen (name, bio, personal info).
- [x] `P0` Implement avatar upload + storage + retrieval.
- [x] `P0` Add language toggle (Arabic/English).
- [x] `P0` Add timezone source option (auto/manual) and timezone selector.
- [x] `P0` Build settings frontend page.
- [x] `P1` Add profile validation and sanitization (Zod schemas).
- [ ] `P1` Add profile API integration tests.

## 3) Calendar & Date Engine
- [x] `P0` Integrate Hijri conversion (custom algorithm in utils/hijri.ts).
- [x] `P0` Implement Hijri-first date rendering with Gregorian secondary.
- [x] `P0` Persist Hijri metadata on entry creation.
- [ ] `P1` Add boundary tests for month/year transitions in Hijri calendar.

## 4) Daily Tracker Core
- [x] `P0` Define tracker schema for all sections (ibadah, salah, sunnah, mood, notes, habits).
- [x] `P0` Implement create/read/update for daily entries.
- [x] `P0` Implement auto-save behavior.
- [x] `P0` Add immutable lock logic at local end-of-day (backend enforced).
- [x] `P0` Return `423 Locked` for post-lock writes.
- [x] `P1` Add lock-state UX banner and disabled controls.
- [x] `P0` Build full tracker frontend page (ibadah, challenges, habits, salah, gratitude, mood, sunnah, quran, hadith).
- [ ] `P1` Add tests for lock behavior across timezone edge cases.

## 5) Challenge Engine
- [x] `P0` Add challenge creation for `daily`, `weekly`, `monthly`.
- [x] `P0` Allow multiple active challenges per user.
- [x] `P1` Add challenge progress updates and completion logic.
- [x] `P1` Add challenge archive/deactivate flow.
- [x] `P0` Build challenges frontend page.
- [ ] `P0` Build Hijri-based period generation for challenge scopes.
- [ ] `P1` Add challenge reporting aggregation.

## 6) Dashboard Analytics
- [x] `P0` Build personal dashboard summary cards.
- [x] `P0` Add completion trend charts by Hijri week/month.
- [x] `P1` Add streak and consistency metrics.
- [x] `P1` Add challenge progress widgets.
- [x] `P0` Build dashboard frontend page.
- [ ] `P1` Add dashboard date filters.

## 7) Family Sharing & Visibility Approvals
- [x] `P0` Implement family group create/invite/join.
- [x] `P0` Implement approval-based visibility (pending/approved/rejected).
- [x] `P0` Enforce visibility rules in APIs and UI.
- [x] `P0` Build family frontend page.
- [x] `P1` Add audit logs for approval changes.
- [ ] `P1` Build family activity feed.

## 8) Comments & Reactions
- [x] `P0` Implement reactions on shared items.
- [x] `P0` Implement comments on shared items.
- [x] `P0` Allow owner to hide comments.
- [x] `P0` Allow owner to delete comments.
- [x] `P1` Add moderation event logging.
- [ ] `P1` Add anti-spam limits for comments/reactions.

## 9) Reports & Sharing
- [x] `P0` Build report generator for daily/weekly/monthly/custom ranges.
- [x] `P0` Add `public` share mode with tokenized URL.
- [x] `P0` Add `private` share mode requiring login + permission.
- [x] `P0` Add per-report toggle: include profile info.
- [x] `P1` Add revoke public link function.
- [x] `P1` Add access logs for report views.
- [x] `P0` Build reports frontend page.
- [ ] `P1` Add WhatsApp/social share actions.

## 10) Reminder Emails
- [x] `P0` Build reminder scheduler at 9:00 PM local time (cron every 15 min).
- [x] `P0` Trigger reminders only for incomplete day entries.
- [x] `P1` Add reminder templates for Arabic and English.
- [x] `P1` Add bounce/error handling for failed emails.
- [x] `P1` Add reminder delivery metrics dashboard (in Settings page).

## 11) Bilingual UX (AR/EN)
- [x] `P0` Implement localization framework and message catalogs (i18n.ts).
- [x] `P0` Support RTL and LTR layouts (globals.css + layout dir attribute).
- [x] `P1` Translate all user-facing strings in tracker/dashboard/report/family modules.
- [x] `P1` Validate layout in Arabic on mobile and desktop (AR/EN toggle in Navbar).

## 12) Security & Compliance
- [x] `P0` Enforce authorization checks on all protected endpoints (requireAuth middleware).
- [x] `P0` Add secure password hashing (bcrypt 12 rounds) and token storage.
- [x] `P0` Add CSRF/CORS/security headers (helmet + cors config).
- [x] `P1` Add rate limiting on auth routes + general API.
- [x] `P0` Add Zod validation on all API inputs.
- [ ] `P1` Complete security checklist and threat model review.

## 13) QA & Release
- [x] `P0` Unit tests for lock logic (5 tests) and challenge model (5 tests).
- [x] `P0` Integration tests for auth (10), tracker (7), report (9) APIs — 36/36 passing.
- [ ] `P0` E2E tests for core journeys.
- [ ] `P1` Performance test dashboard and report endpoints.
- [ ] `P1` Staging UAT pass with Arabic and English.
- [ ] `P0` Production deployment and rollback plan validated.

## Milestone Acceptance Gates
## Gate A (Auth/Profile Ready)
- [x] Signup/login/reset works.
- [x] 45-day session works.
- [x] Profile + avatar + settings saved.

## Gate B (Tracker Integrity Ready)
- [x] Daily tracker fully persisted.
- [x] Permanent lock enforced by backend.
- [x] No post-lock update path exists.

## Gate C (Sharing Ready)
- [x] Approval-based family visibility works.
- [x] Comment/reaction moderation works.
- [x] Public/private report access rules verified.

## Gate D (Launch Ready)
- [x] Reminder emails at 9:00 PM local confirmed.
- [x] AR/EN and RTL quality approved.
- [ ] Monitoring, alerts, and backups validated.
