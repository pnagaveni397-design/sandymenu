// Keeps each client's status in step with their due date, with no scheduler needed:
// it is called whenever a dashboard, menu or the Super Admin list loads.
//   trial / active  --(due date passed)-->  grace_period  --(grace days over)-->  suspended
// A payment confirmed in Super Admin moves the client back to active with a new due date.
// "Suspended" by hand in Super Admin is never touched here, and nothing here ever un-suspends.

const DAY = 86400000;

function syncStatuses(db, restaurantId = null) {
  const g = db.prepare("SELECT auto_suspend FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  if (g && g.auto_suspend === 0) return;

  const rows = db
    .prepare(
      `SELECT r.id, r.status, s.billing_cycle_end, s.grace_period_days
         FROM restaurants r JOIN subscriptions s ON s.restaurant_id = r.id
        WHERE r.status IN ('trial','active','grace_period')
          AND s.billing_cycle_end IS NOT NULL ${restaurantId ? "AND r.id = ?" : ""}`
    )
    .all(...(restaurantId ? [restaurantId] : []));

  const now = Date.now();
  const setR = db.prepare("UPDATE restaurants SET status = ? WHERE id = ?");
  const setS = db.prepare("UPDATE subscriptions SET status = ? WHERE restaurant_id = ?");

  for (const r of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.billing_cycle_end || "")) continue;
    // the due date counts until the end of that day, India time
    const dueEnd = Date.parse(`${r.billing_cycle_end}T23:59:59+05:30`);
    if (Number.isNaN(dueEnd)) continue;
    const graceMs = Math.max(0, Number(r.grace_period_days) || 0) * DAY;

    let next = r.status;
    if (now > dueEnd + graceMs) next = "suspended";
    else if (now > dueEnd) next = "grace_period";
    else if (r.status === "grace_period") next = "active"; // due date was moved forward

    if (next !== r.status) {
      setR.run(next, r.id);
      setS.run(next, r.id);
    }
  }
}

// Days left until a YYYY-MM-DD due date: 0 on the due day itself, negative once it has passed.
// null when there is no usable date.
function daysUntil(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) return null;
  const end = Date.parse(`${dateStr}T23:59:59+05:30`);
  if (Number.isNaN(end)) return null;
  return Math.floor((end - Date.now()) / DAY);
}

module.exports = { syncStatuses, daysUntil };
