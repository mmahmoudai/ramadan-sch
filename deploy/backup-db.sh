#!/bin/bash
set -euo pipefail

# =============================================================
#  Database Backup Script
#  Creates a MongoDB dump on the server and downloads it locally
# =============================================================

SERVER="root@64.225.117.214"
DB_NAME="ramadan_tracker"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REMOTE_BACKUP_DIR="/tmp/db-backup-${TIMESTAMP}"
LOCAL_BACKUP_DIR="./backups"

echo "=== Database Backup ==="

# 1. Create backup on server
echo "[1/3] Creating MongoDB dump on server..."
ssh "$SERVER" "mongodump --db $DB_NAME --out $REMOTE_BACKUP_DIR"

# 2. Compress on server
echo "[2/3] Compressing backup..."
ssh "$SERVER" "cd /tmp && tar -czf db-backup-${TIMESTAMP}.tar.gz db-backup-${TIMESTAMP}"

# 3. Download to local machine
mkdir -p "$LOCAL_BACKUP_DIR"
echo "[3/3] Downloading backup..."
scp "$SERVER:/tmp/db-backup-${TIMESTAMP}.tar.gz" "$LOCAL_BACKUP_DIR/"

# Cleanup remote temp files
ssh "$SERVER" "rm -rf $REMOTE_BACKUP_DIR /tmp/db-backup-${TIMESTAMP}.tar.gz"

echo ""
echo "=== Backup complete ==="
echo "Saved to: $LOCAL_BACKUP_DIR/db-backup-${TIMESTAMP}.tar.gz"
echo ""
echo "To restore: mongorestore --db $DB_NAME --drop <extracted_folder>/$DB_NAME"
