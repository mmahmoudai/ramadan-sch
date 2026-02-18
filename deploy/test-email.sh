#!/bin/bash
echo "=== Testing signup (welcome email) ==="
curl -s -X POST https://api.ramadantracker.club/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"emailtest@ramadantracker.club","password":"testpass123","displayName":"EmailTest"}'
echo ""
echo ""
echo "=== Checking API logs ==="
sleep 3
pm2 logs ramadan-tracker-api --lines 10 --nostream
