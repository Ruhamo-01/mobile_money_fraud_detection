/**
 * emailService.js
 * Sends email notifications via EmailJS (no SMTP, no passwords).
 *
 * HOW TO SET UP (one time, 3 minutes):
 * 1. Go to https://www.emailjs.com and sign up free
 * 2. Add Email Service: Dashboard → Email Services → Add Service → Gmail
 *    Copy your SERVICE_ID
 * 3. Create Template: Email Templates → Create New → use the variables below
 *    Copy your TEMPLATE_ID
 * 4. Get Public Key: Account → API Keys
 *    Copy your PUBLIC_KEY
 * 5. Replace the three placeholder values below with your real IDs
 */

import emailjs from '@emailjs/browser';

// ── Replace these with your actual EmailJS credentials ──────────────────
const SERVICE_ID  = 'service_ex6ifxp';    // ✅ configured
const TEMPLATE_ID = 'template_j26i0sh';  // ✅ configured
const PUBLIC_KEY  = 'dFr0-PoHeQ9iDy9sF'; // ✅ configured
// ─────────────────────────────────────────────────────────────────────────

const isConfigured = () =>
  !SERVICE_ID.startsWith('YOUR_') &&
  !TEMPLATE_ID.startsWith('YOUR_') &&
  !PUBLIC_KEY.startsWith('YOUR_');

/**
 * Send a login notification to the customer.
 * Fails silently — never blocks login flow.
 */
export async function sendLoginNotification({ name, email, phone }) {
  if (!isConfigured()) {
    console.info('[EmailJS] Not configured yet — skipping notification.');
    return;
  }

  const now = new Date();
  const loginTime = now.toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Kigali',
  }) + ' (Rwanda Time)';

  const params = {
    to_email  : email,
    to_name   : name,
    user_email: email,
    user_phone: phone || '—',
    login_time: loginTime,
  };

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, params, PUBLIC_KEY);
    console.info(`[EmailJS] Login notification sent to ${email}`);
  } catch (err) {
    // Never throw — login must succeed even if email fails
    console.warn('[EmailJS] Notification failed:', err?.text || err);
  }
}
