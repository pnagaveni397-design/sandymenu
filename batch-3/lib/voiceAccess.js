// Voice agent access + cost guards.
//
//  * A restaurant gets the voice agent only when the plan it is on has "Voice agent included"
//    ticked in Super Admin (and the restaurant is not suspended).
//  * Every AI call is counted per restaurant per day; past VOICE_DAILY_LIMIT the agent politely
//    stops until tomorrow, so a busy night (or abuse) can't run up the AI bill.
//  * Customer requests are also throttled per device/IP.
import { db } from "./db";

export function restaurantHasVoice(restaurantId) {
  const row = db
    .prepare(
      `SELECT r.status AS rstatus, p.voice_enabled AS voice
         FROM restaurants r
         LEFT JOIN subscriptions s ON s.restaurant_id = r.id
         LEFT JOIN plans p ON p.id = s.selected_plan_id
        WHERE r.id = ?`
    )
    .get(restaurantId);
  if (!row || row.rstatus === "suspended") return false;
  // VOICE_FORCE_ENABLE=1 switches the agent on for EVERY restaurant, ignoring plans. For testing only.
  return process.env.VOICE_FORCE_ENABLE === "1" || row.voice === 1;
}

function today() {
  // India date, so the daily limit resets at midnight IST
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function dailyLimit() {
  const n = Number(process.env.VOICE_DAILY_LIMIT);
  return n > 0 ? n : 400;
}

// Returns true (and counts the call) if the restaurant is still under today's limit.
export function takeVoiceCredit(restaurantId) {
  const day = today();
  const row = db.prepare("SELECT count FROM voice_usage WHERE restaurant_id = ? AND day = ?").get(restaurantId, day);
  if ((row?.count || 0) >= dailyLimit()) return false;
  db.prepare(
    `INSERT INTO voice_usage (restaurant_id, day, count) VALUES (?, ?, 1)
     ON CONFLICT(restaurant_id, day) DO UPDATE SET count = count + 1`
  ).run(restaurantId, day);
  return true;
}

// Simple in-memory throttle (one server process on Render): max `limit` calls per minute per key.
const hits = new Map();
export function throttle(key, limit = 12) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 60000);
  if (arr.length >= limit) { hits.set(key, arr); return false; }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 60000) hits.delete(k);
  return true;
}

export function clientIp(request) {
  const xf = request.headers.get("x-forwarded-for") || "";
  return xf.split(",")[0].trim() || "unknown";
}
