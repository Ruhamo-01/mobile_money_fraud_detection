/**
 * emailService.js
 * Sends email notifications via EmailJS (no SMTP, no passwords).
 */

import emailjs from '@emailjs/browser';

// ── EmailJS credentials ──────────────────────────────────────────────────
const SERVICE_ID  = 'service_ex6ifxp';
const TEMPLATE_ID = 'template_j26i0sh';
const PUBLIC_KEY  = 'dFr0-PoHeQ9iDy9sF';
// ─────────────────────────────────────────────────────────────────────────

const isConfigured = () =>
  !SERVICE_ID.startsWith('YOUR_') &&
  !TEMPLATE_ID.startsWith('YOUR_') &&
  !PUBLIC_KEY.startsWith('YOUR_');

/** Send a login notification to the customer. */
export async function sendLoginNotification({ name, email, phone }) {
  if (!isConfigured()) return;
  const now = new Date();
  const loginTime = now.toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Kigali',
  }) + ' (Rwanda Time)';

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email  : email,
      to_name   : name,
      user_email: email,
      user_phone: phone || '—',
      login_time: loginTime,
      subject   : 'MoMo Shield — Login Notification',
      message   : `You logged in to your MoMo Shield account on ${loginTime}.`,
    }, PUBLIC_KEY);
    console.info(`[EmailJS] Login notification sent to ${email}`);
  } catch (err) {
    console.warn('[EmailJS] Login notification failed:', err?.text || err);
  }
}

/** Send a registration welcome email. */
export async function sendRegistrationEmail({ name, email, phone }) {
  if (!isConfigured()) return;
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email  : email,
      to_name   : name,
      user_email: email,
      user_phone: phone || '—',
      login_time: new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Africa/Kigali',
      }) + ' (Rwanda Time)',
      subject   : 'Welcome to MoMo Shield',
      message   : `Your MoMo Shield account has been successfully created. Your phone number ${phone} is now protected with ML fraud detection and biometric verification.`,
    }, PUBLIC_KEY);
    console.info(`[EmailJS] Registration email sent to ${email}`);
  } catch (err) {
    console.warn('[EmailJS] Registration email failed:', err?.text || err);
  }
}

/** Send a face verification challenge notification (e.g. abroad user). */
export async function sendFaceVerificationEmail({ name, email, phone, amount, reason, verificationLink = '' }) {
  if (!isConfigured()) return;
  try {
    const linkLine = verificationLink
      ? `\n\nClick the link below to verify your face and complete the transfer:\n\n${verificationLink}\n\nThis link expires in 30 minutes.`
      : '';
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email          : email,
      to_name           : name,
      user_email        : email,
      user_phone        : phone || '—',
      login_time        : new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Africa/Kigali',
      }) + ' (Rwanda Time)',
      subject           : 'MoMo Shield — Face Verification Required',
      message           : `A transfer of ${Number(amount).toLocaleString()} RWF was initiated on your account. ${reason}Face verification is required to complete this transfer.${linkLine}`,
      verification_link : verificationLink,
    }, PUBLIC_KEY);
    console.info(`[EmailJS] Face verification email sent to ${email}`);
  } catch (err) {
    console.warn('[EmailJS] Face verification email failed:', err?.text || err);
  }
}

/** Send a transfer blocked notification. */
export async function sendTransferBlockedEmail({ name, email, phone, amount }) {
  if (!isConfigured()) return;
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email  : email,
      to_name   : name,
      user_email: email,
      user_phone: phone || '—',
      login_time: new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Africa/Kigali',
      }) + ' (Rwanda Time)',
      subject   : 'MoMo Shield — Transfer Blocked',
      message   : `A transfer of ${Number(amount).toLocaleString()} RWF on your account was blocked. Face verification failed — the person attempting the transfer did not match the registered account owner. If this was you, please contact support.`,
    }, PUBLIC_KEY);
    console.info(`[EmailJS] Transfer blocked email sent to ${email}`);
  } catch (err) {
    console.warn('[EmailJS] Transfer blocked email failed:', err?.text || err);
  }
}
