#!/bin/bash
cd /var/www/ramadan-tracker
echo "Testing port 2525..."
node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: 'live.smtp.mailtrap.io',
  port: 2525,
  secure: false,
  auth: { user: 'apismtp@mailtrap.io', pass: 'b31f5d572820c184ee9d251c792758f0' }
});
t.sendMail({
  from: '\"Ramadan Tracker\" <noreply@ramadantracker.club>',
  to: 'admin@ramadantracker.club',
  subject: 'SMTP Test Port 2525',
  html: '<h1>Test email works on port 2525!</h1>'
}).then(r => { console.log('SUCCESS:', r); process.exit(0); })
  .catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"
