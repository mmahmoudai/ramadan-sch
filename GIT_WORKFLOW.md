# Git Branching Workflow

## Branches

| Branch | Purpose | Deploys to |
|--------|---------|------------|
| `master` | Production-ready code | `ramadantracker.club` (live) |
| `develop` | Integration branch for testing | Local / staging only |
| `feature/*` | Individual features | Never deployed directly |

## Daily Development

```bash
# Always work on develop (or a feature branch off develop)
git checkout develop

# For a new feature:
git checkout -b feature/my-feature

# When feature is done, merge back to develop:
git checkout develop
git merge feature/my-feature
git push origin develop

# Delete the feature branch:
git branch -d feature/my-feature
```

## Deploying to Production

Only when `develop` is tested and stable:

```bash
# Option 1: Use the merge script (recommended)
bash deploy/merge-to-master.sh
bash deploy/deploy-production.sh

# Option 2: Manual
git checkout master
git merge develop
git push origin master
bash deploy/deploy-production.sh
```

## Staging Environment

Staging runs the `develop` branch on the same server with separate ports and database:

| | Production | Staging |
|---|---|---|
| **Frontend** | `ramadantracker.club` (port 3000) | `staging.ramadantracker.club` (port 3001) |
| **API** | `api.ramadantracker.club` (port 4000) | `api-staging.ramadantracker.club` (port 4001) |
| **Database** | `ramadan_tracker` | `ramadan_tracker_staging` |
| **Branch** | `master` | `develop` |
| **PM2 names** | `ramadan-tracker-api`, `ramadan-tracker-frontend` | `staging-api`, `staging-frontend` |

Deploy to staging:
```bash
bash deploy/deploy-staging.sh
```

## Database Backup

Download a full backup of the production database:
```bash
bash deploy/backup-db.sh
```
Backups are saved to `./backups/` (gitignored).

## Rules

1. **Never push directly to `master`** — always merge from `develop`
2. **Never deploy untested code** — test on `develop` first
3. **Server always stays on `master`** — the deploy script enforces this
4. **If production breaks** — revert the merge on `master` and redeploy:
   ```bash
   git checkout master
   git revert HEAD
   git push origin master
   bash deploy/deploy-production.sh
   ```
