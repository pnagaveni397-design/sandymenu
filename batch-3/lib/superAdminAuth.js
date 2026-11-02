const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { db } = require("./db");

const SUPER_ADMIN_COOKIE = "super_admin_token";
const SESSION_HOURS = 12;

// Super admin (platform owner — you, not restaurant clients) credentials
// used to live as hardcoded/demo env-var defaults (admin@tableserve.local /
// changeme123). That's gone now: the very first time /super-admin is
// opened with no account configured, it shows a one-time setup form where
// you set your own email and password. Everything is stored, hashed, in
// the database.
//
// Guarded the same way lib/db.js guards its own schema setup: during
// `next build`, Next.js imports every API route module (including this one,
// via the login/reset routes) just to collect metadata, without ever
// actually running the handler. Running a schema-writing `db.exec` at
// import time meant several build workers could open + write to the same
// SQLite file at once, which is what produced the SQLITE_BUSY crash during
// deployment ("Failed to collect page data for /api/super-admin/auth/login").
// Skipping writes during the build phase (they aren't needed then anyway —
// the real schema is created on first run) fixes it.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (!isBuildPhase) {
  db.exec(`
CREATE TABLE IF NOT EXISTS super_admin_sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
`);
}

function hash(value) {
  return bcrypt.hashSync(String(value), 10);
}
function compareHash(value, hashed) {
  return bcrypt.compareSync(String(value ?? ""), hashed);
}

function getAccount() {
  return db.prepare(`SELECT * FROM super_admin_account WHERE id = 1`).get();
}

function isAccountConfigured() {
  return !!getAccount();
}

// One-time setup — only allowed while no account exists yet.
function setupAccount({ email, password }) {
  if (isAccountConfigured()) {
    throw new Error("Super admin account is already set up.");
  }
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  // secret_code_hash is a legacy NOT NULL column from an older schema —
  // kept in place (rather than migrating the table) but no longer used
  // for anything; a placeholder value satisfies the constraint.
  db.prepare(
    `INSERT INTO super_admin_account (id, email, password_hash, secret_code_hash) VALUES (1, ?, ?, '')`
  ).run(email.toLowerCase(), hash(password));
}

function verifySuperAdminCredentials(email, password) {
  const account = getAccount();
  if (!account) return false;
  if ((email || "").toLowerCase() !== account.email) return false;
  if (!compareHash(password, account.password_hash)) return false;
  return true;
}

const RESET_TOKEN_MINUTES = 60;

// Password recovery — since there's only ever one super admin account (you),
// this works the same way as the client-side reset flow: a time-limited
// token is emailed to the address on file, and following that link is the
// proof of identity. Always looks up by the account's own email rather
// than trusting a bare "reset my password" request.
function createSuperAdminPasswordResetToken(email) {
  const account = getAccount();
  if (!account || (email || "").toLowerCase() !== account.email) return null;
  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000).toISOString();
  db.prepare(`UPDATE super_admin_account SET reset_token = ?, reset_token_expires = ? WHERE id = 1`).run(token, expires);
  return { account, token, expires };
}

function getSuperAdminByResetToken(token) {
  if (!token) return null;
  const account = getAccount();
  if (!account || account.reset_token !== token) return null;
  if (!account.reset_token_expires || new Date(account.reset_token_expires) < new Date()) return null;
  return account;
}

function resetSuperAdminPasswordWithToken(token, newPassword) {
  const account = getSuperAdminByResetToken(token);
  if (!account) return false;
  if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters.");
  db.prepare(
    `UPDATE super_admin_account SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = datetime('now') WHERE id = 1`
  ).run(hash(newPassword));
  db.exec(`DELETE FROM super_admin_sessions`); // force re-login everywhere after a recovery
  return true;
}

function createSuperAdminSession() {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO super_admin_sessions (token, expires_at) VALUES (?, ?)`).run(token, expires);
  return { token, expires };
}

function destroySuperAdminSession(token) {
  if (!token) return;
  db.prepare(`DELETE FROM super_admin_sessions WHERE token = ?`).run(token);
}

function isValidSuperAdminSession(token) {
  if (!token) return false;
  const session = db.prepare(`SELECT * FROM super_admin_sessions WHERE token = ?`).get(token);
  if (!session) return false;
  if (new Date(session.expires_at) < new Date()) {
    destroySuperAdminSession(token);
    return false;
  }
  return true;
}

module.exports = {
  SUPER_ADMIN_COOKIE,
  isAccountConfigured,
  setupAccount,
  verifySuperAdminCredentials,
  createSuperAdminPasswordResetToken,
  getSuperAdminByResetToken,
  resetSuperAdminPasswordWithToken,
  createSuperAdminSession,
  destroySuperAdminSession,
  isValidSuperAdminSession,
};
