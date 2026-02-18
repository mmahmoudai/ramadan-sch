# Ramadan Tracker

Bilingual (AR/EN) web app for tracking daily worship, habits, and challenges during Ramadan.

## Project Structure

```
ramadan_tracker/
├── frontend/          # Next.js 14 (App Router) + TypeScript + Tailwind CSS
│   └── src/
│       └── app/       # Next.js app directory
├── backend/           # Express + TypeScript REST API
│   └── src/
│       ├── middleware/ # Auth, error handling
│       └── routes/    # API route handlers
├── shared/            # Shared TypeScript types (used by both frontend & backend)
│   └── src/
│       └── types/     # User, Tracker, Challenge, Family, Report types
├── desgin/            # Original static HTML/CSS/JS prototype
├── PRODUCT_IMPLEMENTATION_PLAN.md
├── TASKS.md
└── WORKTHROUGH.md
```

## Quick Start

### Prerequisites
- Node.js 18+ (LTS)
- PostgreSQL (for production; stubs work without DB)

### Install & Run

```bash
# Install all workspace dependencies
npm install

# Run both frontend (port 3000) and backend (port 4000) concurrently
npm run dev

# Or run individually
npm run dev:frontend   # http://localhost:3000
npm run dev:backend    # http://localhost:4000
```

### Environment Variables

Copy `.env.example` to `.env` at root and fill in values. See also:
- `frontend/.env.local.example`
- `backend/.env.example`

## Tech Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS  |
| Backend  | Express, TypeScript, Zod validation              |
| Auth     | JWT (bcryptjs + jsonwebtoken)                    |
| Database | PostgreSQL (planned)                             |
| Shared   | TypeScript interfaces in `shared/` workspace     |

## API Endpoints (Stubs)

| Method | Path                    | Auth | Status |
|--------|-------------------------|------|--------|
| POST   | /auth/signup            | No   | Stub   |
| POST   | /auth/login             | No   | Stub   |
| POST   | /auth/logout            | No   | Stub   |
| POST   | /auth/password/forgot   | No   | Stub   |
| POST   | /auth/password/reset    | No   | Stub   |
| GET    | /me                     | Yes  | Stub   |
| PATCH  | /me/profile             | Yes  | Stub   |
| PATCH  | /me/settings            | Yes  | Stub   |
| GET    | /entries/:date          | Yes  | Stub   |
| PUT    | /entries/:date          | Yes  | Stub   |
| POST   | /entries/:date/submit   | Yes  | Stub   |
| GET    | /challenges             | Yes  | Stub   |
| POST   | /challenges             | Yes  | Stub   |
| PATCH  | /challenges/:id         | Yes  | Stub   |
| POST   | /challenges/:id/progress| Yes  | Stub   |
| POST   | /families               | Yes  | Stub   |
| POST   | /families/:id/invite    | Yes  | Stub   |
| POST   | /reports                | Yes  | Stub   |
| GET    | /reports/:id            | Yes  | Stub   |
| GET    | /reports/public/:token  | No   | Stub   |
| POST   | /reports/:id/revoke     | Yes  | Stub   |
| GET    | /health                 | No   | Active |

## Build Order (from WORKTHROUGH.md)

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
