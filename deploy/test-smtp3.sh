#!/bin/bash
cd /var/www/ramadan-tracker

echo "=== Testing port 465 (forced TLS) ==="
node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: 'live.smtp.mailtrap.io',
  port: 465,
  secure: true,
  auth: { user: 'apismtp@mailtrap.io', pass: 'b31f5d572820c184ee9d251c792758f0' }
});
t.sendMail({
  from: '\"Ramadan Tracker\" <noreply@ramadantracker.club>',
  to: 'admin@ramadantracker.club',
  subject: 'SMTP Test Port 465',
  html: '<h1>Test email works on port 465!</h1>'
}).then(r => { console.log('SUCCESS:', JSON.stringify(r)); process.exit(0); })
  .catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"

echo ""
echo "=== Testing port 25 ==="
node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: 'live.smtp.mailtrap.io',
  port: 25,
  secure: false,
  auth: { user: 'apismtp@mailtrap.io', pass: 'b31f5d572820c184ee9d251c792758f0' }
});
t.sendMail({
  from: '\"Ramadan Tracker\" <noreply@ramadantracker.club>',
  to: 'admin@ramadantracker.club',
  subject: 'SMTP Test Port 25',
  html: '<h1>Test email works on port 25!</h1>'
}).then(r => { console.log('SUCCESS:', JSON.stringify(r)); process.exit(0); })
  .catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"
