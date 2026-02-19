#!/bin/bash
set -euo pipefail

# =============================================================
#  Production Deploy Script — only deploys from 'master' branch
# =============================================================

SERVER="root@64.225.117.214"
REMOTE_DIR="/var/www/ramadan-tracker"

echo "=== Production Deploy ==="

# 1. Verify server is on master
BRANCH=$(ssh "$SERVER" "cd $REMOTE_DIR && git branch --show-current")
if [ "$BRANCH" != "master" ]; then
  echo "ERROR: Server is on branch '$BRANCH', expected 'master'. Aborting."
  exit 1
fi

echo "[1/5] Server is on master ✓"

# 2. Pull latest master
ssh "$SERVER" "cd $REMOTE_DIR && git pull origin master"
echo "[2/5] Pulled latest master ✓"

# 3. Install backend dependencies & build
ssh "$SERVER" "cd $REMOTE_DIR/backend && npm ci --omit=dev && npm run build"
echo "[3/5] Backend built ✓"

# 4. Install frontend dependencies & build
ssh "$SERVER" "cd $REMOTE_DIR/frontend && npm ci && npm run build"
echo "[4/5] Frontend built ✓"

# 5. Restart services
ssh "$SERVER" "pm2 restart ramadan-tracker-api ramadan-tracker-frontend"
echo "[5/5] PM2 processes restarted ✓"

echo ""
echo "=== Deploy complete ==="
echo "Site: https://ramadantracker.club"
echo "API:  https://api.ramadantracker.club"
