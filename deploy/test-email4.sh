#!/bin/bash
pm2 flush ramadan-tracker-api 2>/dev/null
sleep 1
echo "=== Testing signup ==="
curl -s -X POST https://api.ramadantracker.club/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"emailfinal@ramadantracker.club","password":"testpass123","displayName":"FinalTest"}'
echo ""
sleep 6
echo "=== STDOUT ==="
cat /root/.pm2/logs/ramadan-tracker-api-out.log 2>/dev/null
echo ""
echo "=== STDERR ==="
cat /root/.pm2/logs/ramadan-tracker-api-error.log 2>/dev/null
