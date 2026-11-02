// "Continue with Google" (OAuth 2.0 authorization-code flow), written with plain fetch.
// Needs two environment variables (set them in Render):  GOOGLE_CLIENT_ID  and  GOOGLE_CLIENT_SECRET.
// Without them the Google button simply doesn't appear.
const crypto = require("crypto");
const { db } = require("./db");

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// The address Google must send people back to. It has to match the browser's address exactly
// (http://localhost:3000 while testing, your real domain on Render), so unlike table-QR codes it never
// swaps in this computer's network address. BASE_URL, when set, always wins.
function oauthBase(request) {
  const clean = (u) => String(u || "").trim().replace(/\/+$/, "");
  const env = clean(process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL);
  if (env) return /^https?:\/\//i.test(env) ? env : `https://${env}`;
  const first = (v) => (v ? String(v).split(",")[0].trim() : "");
  const h = request.headers;
  const host = first(h.get("x-forwarded-host")) || first(h.get("host")) || new URL(request.url).host;
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(host);
  const proto = first(h.get("x-forwarded-proto")) || (local ? "http" : "https");
  return `${proto}://${host}`;
}

function redirectUri(baseUrl) {
  return `${String(baseUrl).replace(/\/+$/, "")}/api/auth/google/callback`;
}

function buildAuthUrl({ baseUrl, state }) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(baseUrl),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${AUTH_URL}?${q.toString()}`;
}

// Swaps the one-time code for the signed-in Google user's profile.
// The profile is read straight from Google over HTTPS with the access token we just received.
async function fetchGoogleProfile({ code, baseUrl }) {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(baseUrl),
      grant_type: "authorization_code",
    }).toString(),
  });
  const tokens = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokens.access_token) throw new Error("token_exchange_failed");

  const infoRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const info = await infoRes.json().catch(() => ({}));
  if (!infoRes.ok || !info.email) throw new Error("profile_failed");
  if (info.email_verified !== true && info.email_verified !== "true") throw new Error("email_not_verified");

  return { email: String(info.email).toLowerCase(), name: String(info.name || ""), sub: String(info.sub || "") };
}

// Only allow in-site paths as a "go here afterwards" target (blocks open redirects).
function safeNext(next) {
  const n = String(next || "");
  return n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : "";
}

function createPending({ email, name, sub }) {
  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.prepare("DELETE FROM oauth_pending WHERE expires_at < ? OR email = ?").run(new Date().toISOString(), email);
  db.prepare("INSERT INTO oauth_pending (token, email, name, google_sub, expires_at) VALUES (?, ?, ?, ?, ?)").run(token, email, name, sub, expires);
  return token;
}

function getPending(token) {
  if (!token) return null;
  const row = db.prepare("SELECT * FROM oauth_pending WHERE token = ?").get(String(token));
  if (!row || new Date(row.expires_at) < new Date()) return null;
  return row;
}

function consumePending(token) {
  db.prepare("DELETE FROM oauth_pending WHERE token = ?").run(String(token));
}

function newState() {
  return crypto.randomBytes(24).toString("hex");
}

function statesMatch(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = {
  googleConfigured, oauthBase, redirectUri, buildAuthUrl, fetchGoogleProfile, safeNext,
  createPending, getPending, consumePending, newState, statesMatch,
};
