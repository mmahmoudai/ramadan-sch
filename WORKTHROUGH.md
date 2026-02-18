# Ramadan Tracker v1 - Implementation Walkthrough

This file explains how to execute the product plan end-to-end in a practical sequence.

## 1) Preparation
## 1.1 Prerequisites
- Node.js LTS
- PostgreSQL (or managed Postgres/Supabase)
- Object storage bucket for profile images
- Email provider account for reminders

## 1.2 Repo Setup
1. Create project skeleton (frontend + backend + shared types).
2. Add `.env.example` with required variables.
3. Configure CI for lint/test/build/migrations.

## 2) Build Order (Do Not Reorder)
1. Auth/session
2. Profile/settings
3. Calendar engine (Hijri-first)
4. Daily tracker + lock enforcement
5. Challenge system
6. Dashboard analytics
7. Family sharing + comments/reactions
8. Reports + share links
9. Reminder emails
10. Hardening, QA, and launch

## 3) Step-by-Step Delivery
## Step A - Authentication
1. Implement signup/login/logout.
2. Add password reset.
3. Add persistent session mode for 45 days.
4. Verify with integration tests.

Acceptance:
- User can login/logout.
- "Keep me signed in" survives browser restart.

## Step B - Profile and Settings
1. Build profile edit screen.
2. Upload avatar to storage.
3. Add language selector (AR/EN).
4. Add timezone source selector:
   - auto-detect from browser/IP
   - manual timezone list

Acceptance:
- Profile fields and avatar persist.
- Timezone setting saved and reused.

## Step C - Hijri/Gregorian Date Layer
1. Add one deterministic Hijri conversion provider.
2. On new daily entry:
   - compute Hijri date
   - store Hijri + Gregorian fields in DB
3. Render Hijri primary in UI.

Acceptance:
- Every entry has stable Hijri metadata.

## Step D - Daily Tracker with Permanent Lock
1. Implement one daily entry per user per date.
2. Save all tracker fields (checkboxes/text/mood/salah/etc.).
3. Compute `lock_at_utc` using entry timezone snapshot.
4. Block all updates after lock in backend.

Reference logic:
```ts
if (nowUtc > entry.lock_at_utc) {
  throw new HttpError(423, "Entry is permanently locked");
}
```

Acceptance:
- Entry editable before day end.
- Entry never editable after local day end.

## Step E - Challenge Engine
1. Create challenge CRUD with scopes: daily/weekly/monthly.
2. Allow multiple active challenges.
3. Generate periods based on Hijri model.
4. Track progress and completion.

Acceptance:
- User can create multiple challenge types simultaneously.
- Progress aggregates correctly by Hijri periods.

## Step F - Dashboard
1. Build completion score summary.
2. Add streak metrics.
3. Add charts for Hijri week/month.
4. Add challenge performance widgets.

Acceptance:
- Dashboard data matches stored entries/challenge progress.

## Step G - Family Sharing with Approval
1. Create family groups and invites.
2. Require owner approval for visibility.
3. Build comments and reactions.
4. Add owner moderation controls: hide/delete comments.

Acceptance:
- No family member sees data before approval.
- Owner moderation actions apply immediately.

## Step H - Reports and Sharing
1. Generate report records for selected ranges.
2. Add public token links.
3. Add private links requiring login and permission.
4. Add per-report privacy toggle for profile details.
5. Add revoke public link action.

Acceptance:
- Public/private access control is correct.
- Profile visibility toggle works per report.

## Step I - Reminder Emails (9:00 PM local)
1. Scheduler runs periodically.
2. For each user with reminders enabled:
   - compute local current time
   - send reminder at 9:00 PM local only if day incomplete
3. Log `sent/skipped/failed`.

Acceptance:
- Reminders respect user timezone and completion state.

## 4) Database Migration Sequence
1. Baseline tables: users/profiles/settings.
2. Tracking tables: daily_entries/daily_entry_fields.
3. Challenge tables.
4. Family + visibility + social tables.
5. Report tables.
6. Reminder + audit tables.

Rule:
- Never change lock behavior with destructive migration.
- Add backward-compatible migrations only.

## 5) API Delivery Sequence
1. Auth APIs
2. Profile/settings APIs
3. Daily entry APIs
4. Challenge APIs
5. Dashboard summary APIs
6. Family/visibility APIs
7. Comment/reaction APIs
8. Reports/share APIs
9. Reminder admin/ops APIs

## 6) QA Walkthrough
## 6.1 Critical Journeys
1. New user registers -> sets timezone -> creates entry -> locks after day end.
2. User creates daily/weekly/monthly challenges -> tracks progress -> sees dashboard updates.
3. User invites family member -> approves access -> member comments -> owner hides comment.
4. User creates public report with profile hidden -> link opens without profile details.
5. User creates private report -> unauthenticated user blocked.
6. Reminder delivered at exactly 9:00 PM local when entry incomplete.

## 6.2 Edge Cases
- User changes timezone after creating entries.
- Daylight savings transition dates.
- Hijri month rollover.
- Revoked public link re-access attempt.
- Deleted/hide comment behavior in cached UIs.

## 7) Production Rollout
1. Deploy to staging.
2. Execute UAT checklist in AR and EN.
3. Validate logs/metrics/alerts.
4. Run rollback drill.
5. Deploy to production behind feature flags.
6. Gradually enable modules:
   - tracker first
   - dashboard/challenges second
   - family/reports/reminders last

## 8) Post-Launch Monitoring (First 14 Days)
- Track login errors and auth drop-offs.
- Track lock rejection anomalies.
- Track reminder send failure rate.
- Track report link access and abuse attempts.
- Track moderation actions and comment abuse patterns.

## 9) Handover Outputs
- Updated architecture diagram.
- Final schema and migration history.
- Endpoint documentation.
- QA report with pass/fail evidence.
- Operational runbook for support team.

