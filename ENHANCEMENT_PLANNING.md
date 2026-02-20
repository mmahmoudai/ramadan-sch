# Enhancement Planning Baseline (develop)

This document captures the current implementation state and a practical enhancement roadmap for the next feature cycle.

## 1) Current System Snapshot

### Stack
- Frontend: Next.js 14 (App Router), TypeScript, Tailwind
- Backend: Express + TypeScript + Mongoose
- Database: MongoDB
- Auth: JWT access token + refresh token model
- i18n: English, Arabic, Turkish
- Tests: Vitest unit/integration (backend)

### Core modules already in place
- Auth + session: `backend/src/routes/auth.ts`
- Profile/settings + avatar upload: `backend/src/routes/profile.ts`
- Daily tracker + lock logic: `backend/src/routes/entries.ts`
- Challenges: `backend/src/routes/challenges.ts`
- Dashboard summary: `backend/src/routes/dashboard.ts`
- Family/invitations: `backend/src/routes/families.ts`
- Comments/reactions: `backend/src/routes/comments.ts`
- Reports/public+private share: `backend/src/routes/reports.ts`
- Visibility approvals: `backend/src/routes/visibility.ts`
- Reminder cron: `backend/src/jobs/reminderCron.ts`
- Admin panel endpoints: `backend/src/routes/admin.ts`

## 2) High-Impact Gaps Found

### Product/feature gaps
- No reset password frontend page despite backend endpoint + email link (`/reset-password` missing).
- Challenge period logic uses Gregorian epoch math, not Hijri period generation.
- Dashboard lacks date filtering controls.
- Family activity feed is not implemented.
- Social share actions (WhatsApp/social) are missing.

### Security/authorization gaps
- Comment/reaction permission check does not filter by approval scope (`dashboard` vs `reports`).
- Admin delete removes only part of user-related data (orphan risk in comments/reactions/visibility/family membership/audit).
- Fallback JWT secret is permissive for production if env vars are missing.

### Quality/ops gaps
- CI pipeline is missing (lint/test/build gate).
- No E2E tests for key user flows.
- Some shared types are out of sync with backend/frontend contracts.

## 3) Priority Enhancement Backlog

Priority order is based on user impact + risk reduction.

1. Password reset flow completion (P0)
- Add `frontend/src/app/reset-password/page.tsx`.
- Wire token + new password submit to `POST /auth/password/reset`.
- Add localized success/error UX.

2. Visibility scope enforcement fix (P0)
- In comments/reactions routes, enforce `scope: "dashboard"` for dashboard content.
- Add integration tests for scope mismatch denial.

3. Admin hard-delete completeness (P0)
- Delete related records: refresh tokens, approvals, comments, reactions, family membership, audit where needed.
- Add regression test for data cleanup.

4. Hijri challenge periods (P1)
- Replace current `periodIndex` calculation with deterministic Hijri period mapping.
- Persist generated period metadata for daily/weekly/monthly.

5. Dashboard filters + richer analytics (P1)
- Add `from`/`to` query support.
- Return filtered aggregates from API.
- Add corresponding UI controls.

6. Anti-spam controls for social interactions (P1)
- Add route-level rate limits for comment/reaction creation.
- Optional dedupe window for repeated bodies/reactions.

7. CI + E2E foundation (P1)
- Add workflow: lint + tests + build.
- Add Playwright smoke paths: signup/login, tracker save+lock, report access, family invite.

## 4) Recommended Next New Feature

### Feature: Family Activity Feed (Recommended)

Reason:
- Already listed as pending in project tasks.
- Builds directly on existing models (family, comments, reactions, entries, challenges).
- High user engagement value with moderate implementation risk.

### Proposed scope (v1)
- Feed endpoint for approved family members.
- Show activity cards:
  - daily entry completion summary
  - challenge progress updates
  - new report published
  - comments/reactions events
- Filters: `all`, `entries`, `challenges`, `reports`, `social`.
- Pagination/cursor support.

### Backend changes
- New route: `GET /families/:id/feed`.
- New query service to aggregate feed events from existing collections.
- Enforce membership + visibility approval checks.
- Optional denormalized feed model for performance if needed later.

### Frontend changes
- New feed panel in `frontend/src/app/family/page.tsx` or nested component.
- Event cards with relative time + actor + action.
- Simple filter pills + load more.

### Tests
- Integration: authorized member can fetch feed.
- Integration: non-member denied.
- Integration: viewer without approval cannot see restricted events.
- UI smoke: feed renders and paginates.

### Acceptance criteria
- Family member sees latest approved activities.
- Unauthorized users cannot access feed data.
- Feed loads under target latency for normal dataset.

## 5) Delivery Plan (3 Sprints)

### Sprint 1 (Stability + Security)
- Password reset frontend page
- Visibility scope enforcement
- Admin hard-delete completeness
- Regression tests for all above

### Sprint 2 (Core enhancement)
- Family Activity Feed API + UI
- Feed filters + pagination
- Integration test coverage

### Sprint 3 (Quality hardening)
- Hijri challenge period implementation
- Dashboard date filters
- CI workflow + first E2E suite

## 6) Definition of Done for Next Cycle
- All new endpoints covered by integration tests.
- No auth/visibility regression in feed and social paths.
- CI passes on every PR.
- Arabic/English/Turkish UI text included for all new screens.
- Release notes updated with migration and rollback steps.

## 7) Sprint 4 Proposal: Admin Command Center

### Goal
Upgrade the current admin area from basic user listing into a full management console with filters, analytics, and entity-level controls for users, families, entries, challenges, reports, and moderation.

### Current admin baseline (already shipped)
- `GET /admin/stats`
- `GET /admin/users`
- `PATCH /admin/users/:id/role`
- `DELETE /admin/users/:id`
- `GET /admin/audit`
- UI page: `frontend/src/app/admin/page.tsx`

### Planned capabilities

#### A) Overview dashboard + filters
- Global filters: date range (`from`, `to`), language, role, status.
- KPI cards: user growth, active users, entries, challenges, reports, families, moderation actions.
- Trend charts (daily/weekly buckets) with comparison to previous period.
- Top lists: most active users, most active families, high-report activity.

#### B) Full user management
- Extended users list filters (search, role, language, reminders, join date, last activity).
- User detail endpoint with linked aggregates:
  - profile + settings
  - family memberships and approvals
  - entry/challenge/report counts
  - moderation and audit timeline
- Admin edit actions:
  - update profile/settings fields
  - role and reminder toggle
  - force logout/session revoke
  - controlled reset-password trigger

#### C) Family management
- Families list with owner/member counts and activity metrics.
- Family detail with members, invites, approvals, and recent feed snapshots.
- Admin actions: remove member, transfer ownership, archive/delete group, cleanup orphaned invites.

#### D) Entries and challenge management
- Admin entries explorer with filters: user/date/locked/quality flags.
- Read-first entry inspection view with optional audited corrections.
- Admin challenges explorer with filters: scope/status/progress/date.
- Admin actions: archive/reactivate/delete challenge with reason tracking.

#### E) Reports management
- Admin reports explorer with filters: owner/date/share mode/access volume.
- Report detail inspection with access log and visibility mode.
- Admin actions: revoke public token, force private mode, delete report with reason.

#### F) Compliance and safety
- Mandatory audit reason for destructive or privilege-changing admin actions.
- Expanded audit log metadata for before/after snapshots.
- Route-level rate limits on admin mutating endpoints.
- Integration and E2E coverage for all new admin paths.

### Delivery split
- Sprint 4A: admin overview + advanced user management.
- Sprint 4B: family/entries/challenges management + hardening + E2E.

### Acceptance criteria
- Admin can filter and inspect the whole system from one dashboard.
- Admin can view/edit users and manage linked family/entries/challenges.
- Every mutating admin action writes an auditable event with actor + reason.
- Non-admin users are blocked from all admin endpoints and pages.
