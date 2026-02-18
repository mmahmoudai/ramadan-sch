# Ramadan Tracker Platform v1 - Product Implementation Plan

## 1) Document Summary
- Product: Ramadan Tracker web app (consumer + family sharing)
- Version: v1.0 planning baseline
- Date: 2026-02-18
- Primary market language: Arabic (with full English support)
- Calendar model: Hijri-first with Gregorian shown alongside

## 2) Product Goal
Build a bilingual (AR/EN) web app where users track daily worship/habit progress, monitor trends, share reports, and collaborate with family while preserving integrity of daily data through permanent end-of-day locking.

## 3) Confirmed Product Decisions
- Daily entry lock: permanent after local end-of-day in user timezone.
- Timezone: user can use browser/IP auto-detected zone or manually select from timezone list.
- Challenges: multiple daily, weekly, monthly challenges per user.
- Challenge periods: Hijri-based.
- Auth: email/password with persistent login ("keep me signed in") for 45 days.
- Sharing: reports support both public link and private (login-required) access.
- Public report privacy: user can toggle whether profile info (image/bio/personal info) is visible per report.
- Family module: approval-based visibility only. Family members can comment/react; owner can hide/delete comments.
- Reminders: email reminders at 9:00 PM local time.
- Languages: Arabic + English in v1.

## 4) Scope
### In Scope (v1)
- User authentication and account recovery.
- Profile management (image, bio, personal info).
- Daily tracker (based on existing tracker sections).
- Hijri and Gregorian date rendering.
- Permanent lock rule enforcement.
- Dashboard analytics.
- Custom challenge engine (daily/weekly/monthly).
- Family sharing with approval workflow.
- Comments/reactions with owner moderation.
- Public/private reports and share actions (WhatsApp + social media).
- Reminder emails (9:00 PM local).

### Out of Scope (v1)
- Native mobile apps.
- Payments/subscriptions.
- Child accounts/age gates.
- Admin unlock for locked entries.

## 5) Personas
- Primary User: tracks worship/habits/challenges daily, wants accountability and progress history.
- Family Viewer: approved by user to view progress, react, and comment supportively.
- Report Viewer: receives public/private report links.

## 6) Functional Requirements
## 6.1 Auth & Session
- FR-A1: Email/password signup and login.
- FR-A2: "Keep me signed in" extends session validity to 45 days.
- FR-A3: Logout from current device.
- FR-A4: Forgot password / reset password flow.

## 6.2 Profile
- FR-P1: Edit name, bio, personal info fields.
- FR-P2: Upload/change profile image.
- FR-P3: Set language (AR/EN) and timezone.
- FR-P4: Choose timezone source: auto-detect or manual override.

## 6.3 Daily Tracker
- FR-D1: Create one entry per day per user.
- FR-D2: Save tracker sections (checkboxes/text/mood/salah/sunnah/etc.).
- FR-D3: Auto-save draft changes.
- FR-D4: Compute entry lock at local end-of-day.
- FR-D5: Prevent any edits after lock (UI + API hard enforcement).

## 6.4 Calendar
- FR-C1: Display Hijri date prominently.
- FR-C2: Display Gregorian date as secondary.
- FR-C3: Persist Hijri date metadata when entry is created to prevent historical drift.

## 6.5 Challenges
- FR-CH1: Create unlimited custom challenges.
- FR-CH2: Support scopes: daily, weekly, monthly.
- FR-CH3: Evaluate progress by Hijri period.
- FR-CH4: Show challenge completion in dashboard/report.

## 6.6 Dashboard
- FR-DB1: Show daily completion score.
- FR-DB2: Show streaks and trend charts by week/month.
- FR-DB3: Filter by date range and challenge scope.
- FR-DB4: Show family activity (comments/reactions) where relevant.

## 6.7 Family Sharing
- FR-F1: Create family group(s) and invite users.
- FR-F2: Require owner approval before visibility access.
- FR-F3: Family member can react/comment on visible records.
- FR-F4: Owner can hide/delete unwanted comments.

## 6.8 Reports & Sharing
- FR-R1: Generate progress report (daily/weekly/monthly/custom range).
- FR-R2: Share as public tokenized link.
- FR-R3: Share as private link requiring login and permission.
- FR-R4: Per-report toggle: include/exclude profile details.
- FR-R5: One-click share actions for WhatsApp and social platforms.
- FR-R6: Revoke public links.

## 6.9 Notifications
- FR-N1: Reminder emails sent at 9:00 PM local timezone.
- FR-N2: Reminder only if current day is incomplete.
- FR-N3: User can enable/disable reminders.

## 7) Non-Functional Requirements
- NFR-1: API availability target 99.9%.
- NFR-2: P95 API latency < 350ms for core tracker actions.
- NFR-3: Encrypted data in transit and at rest.
- NFR-4: Role/permission checks on every protected endpoint.
- NFR-5: Audit logs for moderation and share-link revocations.
- NFR-6: Full RTL/LTR support and accessibility (keyboard + contrast + labels).

## 8) Recommended Architecture
- Frontend: Next.js (App Router), TypeScript, i18n (AR/EN), RTL support.
- Backend: Next.js API routes or NestJS service layer.
- Database: PostgreSQL.
- Auth: Email/password with secure refresh token rotation.
- Storage: Object storage for profile images.
- Job Worker: Scheduler/queue for reminder emails and periodic report precomputation.
- Email: Transactional email provider (e.g., Resend/SES/Postmark).

## 9) Data Model (v1)
## 9.1 Core Tables
- `users`
  - id (uuid pk), email (unique), password_hash, created_at
- `profiles`
  - user_id (pk/fk), display_name, bio, avatar_url, personal_info_json, updated_at
- `user_settings`
  - user_id (pk/fk), language (`ar`/`en`), timezone_iana, timezone_source (`auto`/`manual`), reminder_enabled, reminder_time_local (`21:00`)

## 9.2 Tracking
- `daily_entries`
  - id, user_id, gregorian_date, hijri_year, hijri_month, hijri_day, timezone_snapshot, lock_at_utc, status (`open`/`locked`), created_at
  - unique(user_id, gregorian_date)
- `daily_entry_fields`
  - id, daily_entry_id, field_key, field_type, value_json, completed_bool, updated_at

## 9.3 Challenges
- `challenges`
  - id, user_id, title, description, scope (`daily`/`weekly`/`monthly`), active, created_at
- `challenge_periods`
  - id, challenge_id, hijri_year, hijri_month (nullable), hijri_week_index (nullable), start_date_gregorian, end_date_gregorian
- `challenge_progress`
  - id, challenge_period_id, date_gregorian, progress_value, notes, completed

## 9.4 Family & Social
- `family_groups`
  - id, owner_user_id, name, created_at
- `family_members`
  - id, family_group_id, user_id, role (`owner`/`member`), status (`invited`/`active`)
- `visibility_approvals`
  - id, owner_user_id, viewer_user_id, scope (`dashboard`/`reports`), status (`pending`/`approved`/`rejected`)
- `comments`
  - id, owner_user_id, author_user_id, target_type, target_id, body, hidden_by_owner, deleted_by_owner, created_at
- `reactions`
  - id, owner_user_id, author_user_id, target_type, target_id, reaction_type, created_at

## 9.5 Reporting & Sharing
- `reports`
  - id, owner_user_id, period_scope, period_start, period_end, visibility (`public`/`private`), include_profile_info, public_token (nullable), revoked_at (nullable), created_at
- `report_access_log`
  - id, report_id, viewer_user_id (nullable), access_type (`public`/`private`), accessed_at

## 9.6 Notifications & Audit
- `email_reminders`
  - id, user_id, send_at_utc, status (`queued`/`sent`/`skipped`/`failed`), reason
- `audit_logs`
  - id, actor_user_id, action, target_type, target_id, metadata_json, created_at

## 10) Key Business Logic
## 10.1 Permanent Lock Rule
- On every write request:
  1. Load entry with `timezone_snapshot`.
  2. Compute `entry_day_end` in that timezone.
  3. If now > `entry_day_end`, reject with `423 Locked`.
- No admin/manual unlock endpoint in v1.

## 10.2 Timezone Integrity
- `timezone_snapshot` is frozen per daily entry at creation time.
- If user changes timezone later, old entries remain tied to original snapshot.

## 10.3 Hijri Integrity
- Hijri date is stored with entry and challenge period records.
- Conversion source must be deterministic (single library/provider) to avoid inconsistent history.

## 11) API Surface (High Level)
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/password/forgot`
- `POST /auth/password/reset`
- `GET /me`
- `PATCH /me/profile`
- `PATCH /me/settings`
- `GET /entries/:date`
- `PUT /entries/:date`
- `POST /entries/:date/submit`
- `GET /dashboard/summary`
- `GET /challenges`
- `POST /challenges`
- `PATCH /challenges/:id`
- `POST /challenges/:id/progress`
- `POST /families`
- `POST /families/:id/invite`
- `POST /visibility/approvals/:id/respond`
- `POST /comments`
- `PATCH /comments/:id/hide`
- `DELETE /comments/:id`
- `POST /reports`
- `POST /reports/:id/revoke`
- `GET /reports/public/:token`
- `GET /reports/:id` (private)
- `POST /reports/:id/share-link`

## 12) Security & Privacy Controls
- Password hashing with Argon2/bcrypt (strong cost settings).
- Short-lived access token + rotating refresh token.
- CSRF protection for browser form actions.
- Rate limiting for auth and comment endpoints.
- Strict authorization on private reports and family visibility.
- Signed URLs for private avatar access if needed.
- Public report token must be revocable and high entropy.

## 13) Observability
- Structured logs with request id and user id (where available).
- Metrics: login success rate, lock rejection count, reminder delivery rate, report share open rate.
- Alerts for auth anomaly spikes and job queue failures.

## 14) QA Strategy
- Unit tests for lock logic, challenge period logic, and visibility rules.
- Integration tests for auth/session/report access.
- E2E tests for:
  - signup/login
  - daily tracking + lock transition at day boundary
  - family approval + comments moderation
  - report share public/private behavior
  - bilingual UI and RTL rendering

## 15) Rollout Plan
## Sprint 1 (Foundation)
- Repo setup, environments, auth baseline, i18n shells.

## Sprint 2 (Profile + Settings)
- Profile edit, image upload, timezone/language settings.

## Sprint 3 (Tracker + Lock)
- Daily entry persistence + permanent lock backend enforcement.

## Sprint 4 (Challenges + Dashboard)
- Multi-scope custom challenges and progress analytics.

## Sprint 5 (Family Social)
- Approval workflow, comments/reactions, moderation.

## Sprint 6 (Reports + Sharing + Notifications)
- Public/private reports, share links, reminder emails, release hardening.

## 16) Launch Readiness (Definition of Done)
- All P0/P1 acceptance criteria met.
- Lock rule verified at timezone boundaries.
- Security checks and penetration checklist passed.
- Backups tested and restore drill complete.
- Monitoring and alerts active.
- Arabic and English UX tested in production-like environment.

## 17) Risks and Mitigations
- Risk: Hijri conversion inconsistencies.
  - Mitigation: lock one conversion source and persist converted values.
- Risk: Timezone edge cases (DST changes, timezone edits).
  - Mitigation: snapshot timezone per entry and test DST dates.
- Risk: Public link misuse.
  - Mitigation: revoke control, optional expiry, access logging.
- Risk: Abusive comments.
  - Mitigation: owner moderation tools + rate limit + audit trails.

