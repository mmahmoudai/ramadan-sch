#!/bin/bash
set -euo pipefail

# =============================================================
#  Merge develop → master safely, then deploy to production
# =============================================================

echo "=== Merge develop → master ==="

# 1. Ensure we're on develop and it's clean
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "develop" ]; then
  echo "ERROR: You must be on 'develop' branch. Currently on '$BRANCH'."
  exit 1
fi

DIRTY=$(git status --porcelain)
if [ -n "$DIRTY" ]; then
  echo "ERROR: Working tree is dirty. Commit or stash changes first."
  exit 1
fi

echo "[1/5] On develop, working tree clean ✓"

# 2. Pull latest develop
git pull origin develop
echo "[2/5] develop is up to date ✓"

# 3. Switch to master and pull
git checkout master
git pull origin master
echo "[3/5] master is up to date ✓"

# 4. Merge develop into master (fast-forward preferred)
git merge develop --no-edit
echo "[4/5] develop merged into master ✓"

# 5. Push master
git push origin master
echo "[5/5] master pushed ✓"

# Switch back to develop
git checkout develop

echo ""
echo "=== Merge complete ==="
echo "master is now up to date with develop."
echo ""
echo "To deploy, run:  bash deploy/deploy-production.sh"
