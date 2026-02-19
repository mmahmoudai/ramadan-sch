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
