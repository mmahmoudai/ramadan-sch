#!/bin/bash
set -euo pipefail

# =============================================================
#  Staging Deploy Script — deploys 'develop' branch to staging
# =============================================================

SERVER="root@64.225.117.214"
REMOTE_DIR="/var/www/ramadan-tracker-staging"

echo "=== Staging Deploy ==="

# 1. Verify staging is on develop
BRANCH=$(ssh "$SERVER" "cd $REMOTE_DIR && git branch --show-current")
if [ "$BRANCH" != "develop" ]; then
  echo "ERROR: Staging is on branch '$BRANCH', expected 'develop'. Aborting."
  exit 1
fi
echo "[1/5] Staging is on develop ✓"

# 2. Pull latest develop
ssh "$SERVER" "cd $REMOTE_DIR && git pull origin develop"
echo "[2/5] Pulled latest develop ✓"

# 3. Build backend
ssh "$SERVER" "cd $REMOTE_DIR/backend && npm install && npm run build"
echo "[3/5] Backend built ✓"

# 4. Build frontend
ssh "$SERVER" "cd $REMOTE_DIR/frontend && npm install && npm run build"
echo "[4/5] Frontend built ✓"

# 5. Restart staging services
ssh "$SERVER" "pm2 restart staging-api staging-frontend"
echo "[5/5] Staging PM2 processes restarted ✓"

echo ""
echo "=== Staging deploy complete ==="
echo "Frontend: https://staging.ramadantracker.club"
echo "API:      https://api-staging.ramadantracker.club"
