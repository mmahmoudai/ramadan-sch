#!/bin/bash
set -euo pipefail

DB_NAME="ramadan_tracker"
BACKUP_DIR="/var/backups/ramadan-db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEST="${BACKUP_DIR}/${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

mongodump --db "$DB_NAME" --out "$DEST" --quiet
tar -czf "${DEST}.tar.gz" -C "$BACKUP_DIR" "$TIMESTAMP"
rm -rf "$DEST"

# Keep only last 14 daily backups
ls -1t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm --

echo "[$(date)] Backup complete: ${DEST}.tar.gz"
