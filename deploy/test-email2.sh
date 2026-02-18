#!/bin/bash
echo "=== Testing signup (welcome email) ==="
curl -s -X POST https://api.ramadantracker.club/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"emailtest2@ramadantracker.club","password":"testpass123","displayName":"EmailTest2"}'
echo ""
echo ""
echo "=== Waiting 5s for async email ==="
sleep 5
echo "=== API stdout logs ==="
cat /root/.pm2/logs/ramadan-tracker-api-out.log
echo ""
echo "=== API error logs ==="
cat /root/.pm2/logs/ramadan-tracker-api-error.log
