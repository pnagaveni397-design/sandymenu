const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { db } = require("./db");
const { newId } = require("./ids");

const SESSION_COOKIE = "session_token";
const SESSION_DAYS = 365; // stay signed in until the owner taps Log out

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).run(token, userId, expires);
  return { token, expires };
}

function destroySession(token) {
  if (!token) return;
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

function getUserByToken(token) {
  if (!token) return null;
  const session = db.prepare(`SELECT * FROM sessions WHERE token = ?`).get(token);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    destroySession(token);
    return null;
  }
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(session.user_id);
}

function getUserRestaurants(userId) {
  return db
    .prepare(
      `SELECT r.* FROM restaurants r
       JOIN restaurant_users ru ON ru.restaurant_id = r.id
       WHERE ru.user_id = ?`
    )
    .all(userId);
}

function userHasAccessToRestaurant(userId, restaurantId) {
  const row = db
    .prepare(`SELECT 1 FROM restaurant_users WHERE user_id = ? AND restaurant_id = ?`)
    .get(userId, restaurantId);
  return !!row;
}

function linkUserToRestaurant(userId, restaurantId, role = "owner") {
  db.prepare(
    `INSERT INTO restaurant_users (id, user_id, restaurant_id, role) VALUES (?, ?, ?, ?)`
  ).run(newId(), userId, restaurantId, role);
}

const RESET_TOKEN_MINUTES = 60;

// Creates (or replaces) a password-reset token for this email. Always
// returns a token even if we're not sure the email will be able to be sent
// out — the platform owner can hand the client a reset link manually from
// the super admin dashboard if email delivery is down.
function createPasswordResetToken(email) {
  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get((email || "").toLowerCase());
  if (!user) return null;
  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000).toISOString();
  db.prepare(`UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`).run(token, expires, user.id);
  return { user, token, expires };
}

function getUserByResetToken(token) {
  if (!token) return null;
  const user = db.prepare(`SELECT * FROM users WHERE reset_token = ?`).get(token);
  if (!user) return null;
  if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) return null;
  return user;
}

function resetPasswordWithToken(token, newPassword) {
  const user = getUserByResetToken(token);
  if (!user) return false;
  db.prepare(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?`).run(
    hashPassword(newPassword),
    user.id
  );
  // Reset password should also sign the user out of any other open sessions.
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(user.id);
  return true;
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getUserByToken,
  getUserRestaurants,
  userHasAccessToRestaurant,
  linkUserToRestaurant,
  createPasswordResetToken,
  getUserByResetToken,
  resetPasswordWithToken,
};
