#!/bin/bash
echo "=== Testing signup (welcome email) ==="
curl -s -X POST https://api.ramadantracker.club/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"emailtest3@ramadantracker.club","password":"testpass123","displayName":"EmailTest3"}'
echo ""
echo ""
echo "=== Waiting 5s for async email ==="
sleep 5
echo "=== PM2 logs ==="
pm2 logs ramadan-tracker-api --lines 15 --nostream
