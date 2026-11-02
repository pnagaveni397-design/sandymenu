const crypto = require("crypto");
const { db } = require("./db");

function newId() {
  return crypto.randomUUID();
}

function generateOrderNumber(restaurantId) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const datePart = `${y}${m}${d}`;

  // Order numbers must be globally unique (the column has a UNIQUE
  // constraint across all restaurants), so a per-restaurant count alone
  // isn't safe — two different restaurants' first order of the day would
  // both compute ORD-20260905-0001 and collide. Start from this
  // restaurant's own daily count for a human-friendly sequence, then walk
  // forward until we land on a number nothing else has taken yet.
  const countRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM orders
       WHERE restaurant_id = ? AND date(created_at) = date('now')`
    )
    .get(restaurantId);

  let seq = (countRow?.c || 0) + 1;
  let candidate = `ORD-${datePart}-${String(seq).padStart(4, "0")}`;
  while (db.prepare("SELECT 1 FROM orders WHERE order_number = ?").get(candidate)) {
    seq += 1;
    candidate = `ORD-${datePart}-${String(seq).padStart(4, "0")}`;
  }
  return candidate;
}

module.exports = { newId, generateOrderNumber };
