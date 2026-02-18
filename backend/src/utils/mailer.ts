import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "live.smtp.mailtrap.io",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "apismtp@mailtrap.io",
    pass: process.env.SMTP_PASS || "",
  },
});

const FROM = process.env.EMAIL_FROM || "noreply@ramadantracker.club";
const FRONTEND = process.env.FRONTEND_URL || "https://ramadantracker.club";

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <tr><td style="background:linear-gradient(135deg,#1a5632,#2d7a4a);padding:28px 32px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:24px;">☪ Ramadan Tracker</h1>
  </td></tr>
  <tr><td style="padding:32px;">
    ${body}
  </td></tr>
  <tr><td style="padding:16px 32px;background:#f9f7f4;text-align:center;font-size:12px;color:#999;">
    <a href="${FRONTEND}" style="color:#1a5632;text-decoration:none;">ramadantracker.club</a> &mdash; Track your Ramadan journey
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendWelcomeEmail(email: string, displayName: string): Promise<void> {
  const html = wrap(`
    <h2 style="color:#1a5632;margin-top:0;">Assalamu Alaikum, ${displayName}! 🌙</h2>
    <p style="font-size:15px;color:#333;line-height:1.6;">
      Welcome to <strong>Ramadan Tracker</strong>! Your account has been created successfully.
    </p>
    <p style="font-size:15px;color:#333;line-height:1.6;">Here's what you can do:</p>
    <ul style="font-size:14px;color:#444;line-height:1.8;">
      <li><strong>Track Daily Worship</strong> &mdash; Salah, Quran, Dhikr, Charity & more</li>
      <li><strong>Build Habits</strong> &mdash; Set personal challenges and track progress</li>
      <li><strong>Family Sharing</strong> &mdash; Invite your family to encourage each other</li>
      <li><strong>Reports & Dashboard</strong> &mdash; Visualise your spiritual journey</li>
    </ul>
    <div style="text-align:center;margin:28px 0;">
      <a href="${FRONTEND}/tracker" style="display:inline-block;background:#1a5632;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Start Tracking →</a>
    </div>
    <p style="font-size:14px;color:#888;">Ramadan Kareem! رمضان كريم</p>
  `);

  await transporter.sendMail({
    from: `"Ramadan Tracker" <${FROM}>`,
    to: email,
    subject: "Welcome to Ramadan Tracker! 🌙",
    html,
  });
  console.log(`[MAIL] Welcome email sent to ${email}`);
}

export async function sendFamilyInviteEmail(
  inviteeEmail: string,
  inviteeName: string,
  inviterName: string,
  groupName: string,
): Promise<void> {
  const html = wrap(`
    <h2 style="color:#1a5632;margin-top:0;">Family Invitation 👨‍👩‍👧‍👦</h2>
    <p style="font-size:15px;color:#333;line-height:1.6;">
      Assalamu Alaikum <strong>${inviteeName}</strong>,
    </p>
    <p style="font-size:15px;color:#333;line-height:1.6;">
      <strong>${inviterName}</strong> has invited you to join the family group
      "<strong>${groupName}</strong>" on Ramadan Tracker.
    </p>
    <p style="font-size:15px;color:#333;line-height:1.6;">
      Accept the invitation to share your progress and encourage each other during Ramadan!
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${FRONTEND}/family" style="display:inline-block;background:#1a5632;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">View Invitation →</a>
    </div>
  `);

  await transporter.sendMail({
    from: `"Ramadan Tracker" <${FROM}>`,
    to: inviteeEmail,
    subject: `${inviterName} invited you to "${groupName}" on Ramadan Tracker`,
    html,
  });
  console.log(`[MAIL] Family invite sent to ${inviteeEmail}`);
}

export async function sendFamilyInviteConfirmation(
  inviterEmail: string,
  inviterName: string,
  inviteeName: string,
  groupName: string,
): Promise<void> {
  const html = wrap(`
    <h2 style="color:#1a5632;margin-top:0;">Invitation Sent ✅</h2>
    <p style="font-size:15px;color:#333;line-height:1.6;">
      Assalamu Alaikum <strong>${inviterName}</strong>,
    </p>
    <p style="font-size:15px;color:#333;line-height:1.6;">
      You have successfully invited <strong>${inviteeName}</strong> to your family group
      "<strong>${groupName}</strong>".
    </p>
    <p style="font-size:15px;color:#333;line-height:1.6;">
      They will receive an email notification and can accept the invitation from their account.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${FRONTEND}/family" style="display:inline-block;background:#1a5632;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Manage Family →</a>
    </div>
  `);

  await transporter.sendMail({
    from: `"Ramadan Tracker" <${FROM}>`,
    to: inviterEmail,
    subject: `You invited ${inviteeName} to "${groupName}"`,
    html,
  });
  console.log(`[MAIL] Family invite confirmation sent to ${inviterEmail}`);
}

export async function sendDailyReminderEmail(
  email: string,
  displayName: string,
  isArabic: boolean,
): Promise<void> {
  const subject = isArabic
    ? "تذكير رمضان 🌙 - لم تكمل تسجيل يومك بعد"
    : "Ramadan Reminder 🌙 - Complete today's tracker";

  const body = isArabic
    ? `
      <h2 style="color:#1a5632;margin-top:0;direction:rtl;text-align:right;">تذكير يومي 🌙</h2>
      <p style="font-size:15px;color:#333;line-height:1.6;direction:rtl;text-align:right;">
        السلام عليكم <strong>${displayName}</strong>،
      </p>
      <p style="font-size:15px;color:#333;line-height:1.6;direction:rtl;text-align:right;">
        لم تكمل تسجيل يومك بعد في متتبع رمضان. لا تنسَ أن تسجل عباداتك وعاداتك اليومية.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${FRONTEND}/tracker" style="display:inline-block;background:#1a5632;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">سجّل يومك ←</a>
      </div>
      <p style="font-size:14px;color:#888;direction:rtl;text-align:right;">بارك الله فيك</p>
    `
    : `
      <h2 style="color:#1a5632;margin-top:0;">Daily Reminder 🌙</h2>
      <p style="font-size:15px;color:#333;line-height:1.6;">
        Assalamu Alaikum <strong>${displayName}</strong>,
      </p>
      <p style="font-size:15px;color:#333;line-height:1.6;">
        You haven't completed today's entry in the Ramadan Tracker.
        Don't forget to log your daily worship and habits!
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${FRONTEND}/tracker" style="display:inline-block;background:#1a5632;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Log Today →</a>
      </div>
      <p style="font-size:14px;color:#888;">BarakAllahu Feek</p>
    `;

  const html = wrap(body);

  await transporter.sendMail({
    from: `"Ramadan Tracker" <${FROM}>`,
    to: email,
    subject,
    html,
  });
  console.log(`[MAIL] Daily reminder sent to ${email}`);
}

export async function sendPasswordResetEmail(
  email: string,
  displayName: string,
  resetToken: string,
): Promise<void> {
  const resetUrl = `${FRONTEND}/reset-password?token=${resetToken}`;
  const html = wrap(`
    <h2 style="color:#1a5632;margin-top:0;">Password Reset 🔑</h2>
    <p style="font-size:15px;color:#333;line-height:1.6;">
      Assalamu Alaikum <strong>${displayName}</strong>,
    </p>
    <p style="font-size:15px;color:#333;line-height:1.6;">
      We received a request to reset your password. Click the button below to set a new password.
      This link expires in 1 hour.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:#1a5632;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Reset Password →</a>
    </div>
    <p style="font-size:13px;color:#999;">If you didn't request this, you can safely ignore this email.</p>
  `);

  await transporter.sendMail({
    from: `"Ramadan Tracker" <${FROM}>`,
    to: email,
    subject: "Reset your Ramadan Tracker password",
    html,
  });
  console.log(`[MAIL] Password reset email sent to ${email}`);
}

export { transporter };
