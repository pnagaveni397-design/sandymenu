// Prints what Super Admin controls, straight from the database, so you can check it in the terminal:
//   npm run check
// Read-only: it never changes anything. Start the app once (npm run dev) first so the tables exist.
const fs = require("fs");
const path = require("path");

let Open;
try {
  const Database = require("better-sqlite3");
  Open = (p) => new Database(p, { readonly: true });
} catch {
  const { DatabaseSync } = require("node:sqlite"); // fallback for Node 22+
  Open = (p) => new DatabaseSync(p);
}

const file = path.join(process.cwd(), "data", "app.db");
if (!fs.existsSync(file)) {
  console.log("No database yet at data/app.db. Run  npm run dev  once, open http://localhost:3000, then run this again.");
  process.exit(0);
}
const db = Open(file);

function show(title, fn) {
  console.log("\n== " + title);
  try {
    const rows = fn();
    if (Array.isArray(rows)) (rows.length ? console.table(rows) : console.log("(none)"));
    else console.log(rows);
  } catch (e) {
    console.log("(not available yet: " + e.message + ")");
  }
}

show("Super Admin account", () => {
  const a = db.prepare("SELECT email, created_at FROM super_admin_account WHERE id = 1").get();
  return a ? `set up: ${a.email} (since ${a.created_at})` : "NOT set up yet. Open http://localhost:3000/super-admin and create your email + password.";
});

show("Current platform rates (Default platform rates)", () => {
  const r = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  if (!r) return "(none)";
  return [{
    setup_fee: r.onboarding_fee, monthly_fee: r.monthly_fee, platform_fee_per_order: r.order_fee,
    grace_days: r.grace_period_days, trial_days: r.trial_days, auto_suspend: r.auto_suspend, plans_page_after_login: r.billing_first,
  }];
});

show("Plans clients see", () =>
  db.prepare("SELECT name, kind, price_monthly AS monthly, order_fee AS fee_per_order, onboarding_fee AS setup, badge, active FROM plans ORDER BY sort_order, created_at").all());

show("Clients (restaurants)", () =>
  db.prepare(`SELECT r.name, r.slug, r.status, s.plan_name AS plan, s.billing_cycle_end AS due_date, s.grace_period_days AS grace
              FROM restaurants r LEFT JOIN subscriptions s ON s.restaurant_id = r.id ORDER BY r.created_at DESC`).all());

show("Payment proofs waiting for you", () =>
  db.prepare("SELECT restaurant_id, amount, status, created_at FROM payment_proofs WHERE status != 'acknowledged' ORDER BY created_at DESC LIMIT 20").all());

console.log("\nOpen Super Admin in the browser:  http://localhost:3000/super-admin");
