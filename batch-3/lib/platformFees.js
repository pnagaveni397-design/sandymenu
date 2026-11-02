// Platform-fee ledger for one shop.
//   owed = (all per-order fees ever charged) + (extra amount billed) - (all money received)
// A partial payment just lowers what is owed; the rest stays until it is paid in full, then it is 0.
const crypto = require("node:crypto");

const r2 = (n) => Math.round(n * 100) / 100;

function feeSummary(db, restaurantId) {
  const a = db.prepare("SELECT COALESCE(SUM(fee_amount),0) t, COUNT(*) n FROM platform_fees WHERE restaurant_id = ?").get(restaurantId);
  const s = db.prepare("SELECT extra_amount, extra_note, fee_paid_total FROM subscriptions WHERE restaurant_id = ?").get(restaurantId) || {};
  const extra = s.extra_amount || 0;
  const paid = s.fee_paid_total || 0;
  return {
    accrued: r2(a.t), orders: a.n,
    extra: r2(extra), extra_note: s.extra_note || "",
    paid: r2(paid),
    owed: Math.max(0, r2(a.t + extra - paid)),
  };
}

// Keeps each order's "settled" tick in step: what was paid covers the oldest orders first.
function syncSettledFlags(db, restaurantId) {
  const paid = db.prepare("SELECT fee_paid_total FROM subscriptions WHERE restaurant_id = ?").get(restaurantId)?.fee_paid_total || 0;
  const rows = db.prepare("SELECT id, fee_amount, settled FROM platform_fees WHERE restaurant_id = ? ORDER BY created_at ASC, rowid ASC").all(restaurantId);
  let run = 0;
  const up = db.prepare("UPDATE platform_fees SET settled = ?, settled_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END WHERE id = ?");
  for (const r of rows) {
    run += r.fee_amount;
    const should = run <= paid + 0.0001 ? 1 : 0;
    if (should !== (r.settled ? 1 : 0)) up.run(should, should, r.id);
  }
}

function recordPayment(db, restaurantId, amount, { note = "", source = "manual", proofId = null } = {}) {
  const amt = r2(Math.max(0, Number(amount) || 0));
  if (!amt) return feeSummary(db, restaurantId);
  db.prepare("UPDATE subscriptions SET fee_paid_total = COALESCE(fee_paid_total, 0) + ? WHERE restaurant_id = ?").run(amt, restaurantId);
  db.prepare("INSERT INTO platform_fee_payments (id, restaurant_id, amount, note, source, proof_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run(crypto.randomUUID(), restaurantId, amt, String(note).slice(0, 200), source, proofId);
  db.prepare("UPDATE client_register SET fee_paid_total = (SELECT fee_paid_total FROM subscriptions WHERE restaurant_id = ?) WHERE restaurant_id = ?").run(restaurantId, restaurantId);
  syncSettledFlags(db, restaurantId);
  return feeSummary(db, restaurantId);
}

// Client app: the owner's running total of money received (sent through "Send to client app").
function setPaidTotal(db, total) {
  const t = r2(Math.max(0, Number(total) || 0));
  db.prepare("UPDATE subscriptions SET fee_paid_total = ?").run(t);
  for (const r of db.prepare("SELECT restaurant_id FROM subscriptions").all()) syncSettledFlags(db, r.restaurant_id);
}

function paymentHistory(db, restaurantId, limit = 6) {
  return db.prepare("SELECT amount, note, source, created_at FROM platform_fee_payments WHERE restaurant_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?").all(restaurantId, limit);
}

module.exports = { feeSummary, syncSettledFlags, recordPayment, setPaidTotal, paymentHistory };
