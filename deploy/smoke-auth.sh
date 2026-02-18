#!/bin/bash
set -euo pipefail

LOGIN_RES=$(curl -s -X POST https://api.ramadantracker.club/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ramadantracker.club","password":"admin123"}')

echo "LOGIN_RES=$LOGIN_RES"

TOKEN=$(echo "$LOGIN_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")

if [ -z "$TOKEN" ]; then
  echo "No token returned"
  exit 1
fi

ENTRY_RES=$(curl -s -H "Authorization: Bearer $TOKEN" https://api.ramadantracker.club/entries/2026-02-18)
echo "ENTRY_RES=$ENTRY_RES"
