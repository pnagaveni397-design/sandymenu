const nodemailer = require("nodemailer");

// Email sending is configured once, by you (the platform owner), through
// the .env file on the server — SMTP_HOST / SMTP_USER / SMTP_PASS (and
// optionally SMTP_PORT / SMTP_FROM). It's deliberately NOT a settings
// screen inside the app: restaurant clients never see or touch this, they
// only add recipient emails on their own Notifications tab and pick who to
// send each order to from the Orders tab.
function getConfig() {
  if (!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) return null;
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  };
}

function isConfigured() {
  return !!getConfig();
}

// Cache the transport instead of building a brand new SMTP connection pool
// on every single call — every call building a fresh, un-verified
// connection with no timeout was one source of "sometimes emails just
// silently vanish": a slow/unreachable SMTP host would just hang until the
// serverless function itself timed out with no error ever surfaced.
let _transport = null;
function getTransport() {
  if (_transport) return _transport;
  const config = getConfig();
  if (!config) return null;
  _transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // Gmail/most providers: port 465 = implicit TLS, 587 = STARTTLS.
    secure: Number(config.port) === 465,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return _transport;
}

// Sends one email and always resolves to { sent, reason } — never throws —
// so callers (order placement, password reset) can never be silently
// blocked or crash because SMTP is misconfigured.
async function sendEmail({ to, subject, text }) {
  if (!to) return { sent: false, reason: "No recipient email provided." };
  const config = getConfig();
  if (!config) {
    return {
      sent: false,
      reason:
        "Email isn't configured on this server yet — set SMTP_HOST, SMTP_USER, SMTP_PASS (and optionally SMTP_PORT/SMTP_FROM) in .env, then restart the server. " +
        "For Gmail: use smtp.gmail.com, port 587, and a 16-character Google App Password (not your normal Gmail password — App Passwords require 2-Step Verification to be turned on for the Google account).",
    };
  }
  try {
    const transport = getTransport();
    await transport.sendMail({
      from: config.from,
      to: Array.isArray(to) ? to.join(",") : to,
      subject,
      text,
    });
    return { sent: true };
  } catch (e) {
    // Reset the cached transport on failure in case the connection itself
    // went bad, so the next attempt starts fresh instead of reusing a dead
    // socket.
    _transport = null;
    return { sent: false, reason: e?.message || "Unknown email error." };
  }
}

function renderPasswordResetEmail(resetUrl, kind) {
  const subject = kind === "super_admin" ? "TableServe super admin — reset your password" : "TableServe — reset your password";
  const text = `We received a request to reset your TableServe password.\n\nOpen this link to choose a new password (it expires in 60 minutes):\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`;
  return { subject, text };
}

async function sendPasswordResetEmail({ email, resetUrl, kind }) {
  const { subject, text } = renderPasswordResetEmail(resetUrl, kind);
  return sendEmail({ to: email, subject, text });
}

module.exports = { sendPasswordResetEmail, isConfigured };
