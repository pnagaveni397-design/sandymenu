// lib/db.js
//
// Stage 1 uses local SQLite (via better-sqlite3) so the whole project runs
// with zero external setup. The schema mirrors the Postgres design in
// technical-spec.md. To move to production, swap this file for a Postgres
// client (e.g. Supabase or `pg`) that speaks the same query shape — the
// rest of the app calls the exported functions below, not SQL directly,
// so the migration is contained to this one file.

const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

let db;
let isNew = false;

if (isBuildPhase) {
  // During `next build`, Next.js imports every API route module in parallel
  // worker processes just to collect its metadata (e.g. runtime config) --
  // it never actually calls into the database. Opening a real SQLite
  // connection here anyway used to run `db.pragma("journal_mode = WAL")`
  // (a write to the file's header) on every one of those workers at once,
  // with no busy-timeout configured yet to make them wait their turn. That
  // race is what crashed the build with SQLITE_BUSY -- and because it's
  // timing-dependent, it could surface on whichever route happened to lose
  // the race, not always the same one. Since nothing during the build
  // phase ever actually queries the database, a harmless stub avoids
  // touching the file at all here.
  db = new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(
          `lib/db.js: "${String(prop)}" was called during the build phase, but the database is not available then.`
        );
      },
    }
  );
} else {
  const DATA_DIR = path.join(process.cwd(), "data");
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const DB_PATH = path.join(DATA_DIR, "app.db");
  isNew = !fs.existsSync(DB_PATH);

  db = new Database(DB_PATH);
  // busy_timeout MUST be set first: it tells this connection to wait and
  // retry (up to 5s) if the file is briefly locked by another process,
  // instead of throwing SQLITE_BUSY right away. Setting journal_mode
  // before this was the original bug -- that pragma is itself a write and
  // had no retry protection yet when it ran.
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo_emoji TEXT DEFAULT '🍽️',
  logo_image_url TEXT DEFAULT '',
  cover_image_url TEXT DEFAULT '',
  tagline TEXT DEFAULT '',
  description TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  currency TEXT DEFAULT 'INR',
  tax_percent REAL DEFAULT 5,
  welcome_animation_enabled INTEGER DEFAULT 1,
  welcome_sound_enabled INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active', -- active | grace_period | suspended | trial
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurant_payment_settings (
  restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id),
  phonepe_qr_image_url TEXT DEFAULT '',
  upi_id TEXT DEFAULT '',
  cash_enabled INTEGER DEFAULT 1,
  online_enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  onboarding_fee REAL NOT NULL,
  monthly_fee REAL NOT NULL,
  order_fee REAL NOT NULL,
  grace_period_days INTEGER NOT NULL,
  effective_from TEXT DEFAULT (datetime('now')),
  updated_by TEXT DEFAULT 'system'
);

-- Lets the super admin type their Gmail (or any SMTP provider) address and
-- App Password straight into the app's Email Settings screen instead of
-- having to edit .env / restart the server with a text editor.
CREATE TABLE IF NOT EXISTS smtp_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT NOT NULL,
  smtp_pass TEXT NOT NULL,
  from_email TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_contact (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phone TEXT DEFAULT '',
  phonepe_qr_image_url TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT UNIQUE REFERENCES restaurants(id),
  plan_name TEXT DEFAULT 'Standard',
  onboarding_fee REAL,
  onboarding_paid INTEGER DEFAULT 0,
  monthly_fee REAL,
  order_fee_override REAL,
  platform_fee_enabled INTEGER DEFAULT 1,
  billing_cycle_start TEXT,
  billing_cycle_end TEXT,
  status TEXT DEFAULT 'active',
  grace_period_days INTEGER DEFAULT 3,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurant_taxes (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  name TEXT NOT NULL,
  percent REAL NOT NULL,
  type TEXT DEFAULT 'percent', -- 'percent' or 'fixed' (when fixed, the percent column holds the flat rupee amount)
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  category_id TEXT REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  discounted_price REAL,
  image_emoji TEXT DEFAULT '🍲',
  image_url TEXT DEFAULT '',
  is_veg INTEGER DEFAULT 1,
  spice_level TEXT DEFAULT 'none', -- none | mild | medium | hot
  tags TEXT DEFAULT '[]',
  ingredients TEXT DEFAULT '[]',
  allergens TEXT DEFAULT '[]',
  prep_time_minutes INTEGER DEFAULT 15,
  available INTEGER DEFAULT 1,
  is_popular INTEGER DEFAULT 0,
  is_recommended INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_item_addons (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT REFERENCES menu_items(id),
  name TEXT NOT NULL,
  price REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  table_number TEXT NOT NULL,
  table_name TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  discount_type TEXT DEFAULT 'percent', -- percent | flat
  discount_value REAL DEFAULT 0,
  min_order_value REAL DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  restaurant_id TEXT REFERENCES restaurants(id),
  table_id TEXT REFERENCES tables(id),
  status TEXT DEFAULT 'pending', -- pending|confirmed|preparing|ready|completed|cancelled
  subtotal REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  tax_breakdown TEXT DEFAULT '[]',
  platform_fee REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT, -- cash | online_upi -- NULL until the bill is finalized, after the food is served
  payment_status TEXT DEFAULT 'unpaid', -- unpaid|pending_confirmation|paid|failed
  customer_note TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  menu_item_id TEXT REFERENCES menu_items(id),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  addons TEXT DEFAULT '[]',
  item_note TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT DEFAULT '',
  reset_token TEXT,
  reset_token_expires TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS super_admin_account (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  secret_code_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_proofs (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  image_url TEXT NOT NULL,
  amount_claimed REAL,
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'pending', -- pending | acknowledged
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS restaurant_users (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  restaurant_id TEXT REFERENCES restaurants(id),
  role TEXT DEFAULT 'owner',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  discount_type TEXT DEFAULT 'percent',
  discount_value REAL DEFAULT 0,
  requires_video INTEGER DEFAULT 1,
  allow_instagram_repost INTEGER DEFAULT 0,
  terms_text TEXT DEFAULT '',
  terms_version TEXT DEFAULT 'v1',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id),
  order_id TEXT REFERENCES orders(id),
  session_id TEXT,
  consent_timestamp TEXT DEFAULT (datetime('now')),
  terms_version TEXT,
  agreed_to_submit_content INTEGER DEFAULT 0,
  agreed_to_instagram_use INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  order_id TEXT REFERENCES orders(id),
  campaign_id TEXT REFERENCES campaigns(id),
  rating INTEGER,
  text_feedback TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  discount_code TEXT DEFAULT '',
  submitted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_fees (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  order_id TEXT REFERENCES orders(id),
  fee_amount REAL NOT NULL,
  settled INTEGER DEFAULT 0,
  settled_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurant_notification_emails (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  email TEXT NOT NULL,
  label TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  event_type TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Safe migration: if an older data/app.db already exists without the new
// columns, add them without wiping existing data. Ignored if already present.
function tryAddColumn(table, columnDef) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (e) {
    // column already exists — fine
  }
}
tryAddColumn("restaurants", "logo_image_url TEXT DEFAULT ''");
tryAddColumn("restaurants", "cover_image_url TEXT DEFAULT ''");
tryAddColumn("menu_items", "image_url TEXT DEFAULT ''");
tryAddColumn("orders", "tax_breakdown TEXT DEFAULT '[]'");
tryAddColumn("restaurants", "notes TEXT DEFAULT ''");
tryAddColumn("users", "reset_token TEXT");
tryAddColumn("users", "reset_token_expires TEXT");
tryAddColumn("restaurant_notification_emails", "label TEXT DEFAULT ''");
tryAddColumn("payment_proofs", "type TEXT DEFAULT 'subscription'");
tryAddColumn("subscriptions", "last_payment_confirmed_at TEXT");
tryAddColumn("restaurant_taxes", "type TEXT DEFAULT 'percent'");
tryAddColumn("subscriptions", "platform_fee_enabled INTEGER DEFAULT 1");
tryAddColumn("super_admin_account", "reset_token TEXT");
tryAddColumn("super_admin_account", "reset_token_expires TEXT");
tryAddColumn("restaurants", "instagram_url TEXT DEFAULT ''");
tryAddColumn("restaurants", "banner_messages TEXT DEFAULT '[]'");
tryAddColumn("campaigns", "media_type TEXT DEFAULT 'video'"); // 'video' | 'audio'
// Up to 6 restaurant-provided template videos a customer can pick from
// instead of filming their own during the meal -- JSON array of URLs.
tryAddColumn("campaigns", "template_videos TEXT DEFAULT '[]'");
// Scene-based templates the restaurant builds (captions, transitions,
// durations, optional shots) -- JSON array. Customers fill them in with
// their own clips in the in-app edit place.
tryAddColumn("campaigns", "templates TEXT DEFAULT '[]'");
// What a customer actually made from a template: which template, and the
// scene list (their clips/photos + captions) the restaurant can replay.
tryAddColumn("reviews", "template_name TEXT DEFAULT ''");
tryAddColumn("reviews", "scenes TEXT DEFAULT '[]'");
// Lets the restaurant explicitly control ordering and which dishes show up
// in the "Chef's Pick" hero carousel / "New on the menu" row on the
// customer view, instead of those being fully automatic.
tryAddColumn("menu_items", "sort_order INTEGER DEFAULT 0");
tryAddColumn("menu_items", "is_new_pick INTEGER DEFAULT 0");
// A link to the restaurant's Google Maps listing (for reviews) shown as an
// icon-only button on the customer menu, next to Instagram.
tryAddColumn("restaurants", "google_review_url TEXT DEFAULT ''");
// A short congratulatory message shown right when a customer applies an
// offer or finishes a campaign at billing time -- editable by the
// restaurant, e.g. "Awesome! Your discount has been applied."
tryAddColumn("restaurants", "offer_success_message TEXT DEFAULT ''");
// The animated table-guide mascot's settings (look, size, messages, poses,
// expressions per situation) as one JSON blob -- edited in the dashboard's
// "Mascot" section and played on the customer view.
tryAddColumn("restaurants", "mascot_config TEXT DEFAULT ''");
// Optional customer details captured when an order is placed -- shown to
// staff on the Kitchen Display and in the dashboard's order list so a
// table can be greeted by name / called if follow-up is needed.
tryAddColumn("orders", "customer_name TEXT DEFAULT ''");
tryAddColumn("orders", "customer_phone TEXT DEFAULT ''");
// So the restaurant knows who submitted each campaign video/audio, since
// the customer isn't necessarily logged in or the same person who placed
// the order (e.g. someone else at the table might participate).
tryAddColumn("reviews", "customer_name TEXT DEFAULT ''");
tryAddColumn("reviews", "customer_phone TEXT DEFAULT ''");
// Lets the restaurant hide a template from customers without deleting it
// (e.g. drafts, or ones they've retired) -- 1 = shown, 0 = hidden. Stored
// per-template inside the campaign's template_videos JSON array as
// {url, active}, migrated below for any campaign created before this.


// One-time structural migration: older installs created the orders table
// with `payment_method TEXT NOT NULL`, back when payment was chosen at
// order time. Now an order exists for a while with no payment method at
// all (it's decided later, after the food is served), so that NOT NULL
// rule has to go. SQLite can't just ALTER a column's constraint, so this
// rebuilds the table the standard safe way: new table with the right
// shape, copy every row across untouched, swap the names. Runs only once
// -- it checks first and does nothing on a database that's already fixed
// (including on a brand new install using the CREATE TABLE above).
function migrateOrdersPaymentMethodNullable() {
  const col = db
    .prepare("SELECT \"notnull\" FROM pragma_table_info('orders') WHERE name = 'payment_method'")
    .get();
  if (!col || col.notnull === 0) return; // already fine, or table doesn't exist yet

  db.pragma("foreign_keys = OFF");
  db.exec("DROP TABLE IF EXISTS orders_new"); // in case a previous attempt was interrupted
  const rebuild = db.transaction(() => {
    db.exec(`
      CREATE TABLE orders_new (
        id TEXT PRIMARY KEY,
        order_number TEXT UNIQUE NOT NULL,
        restaurant_id TEXT REFERENCES restaurants(id),
        table_id TEXT REFERENCES tables(id),
        status TEXT DEFAULT 'pending',
        subtotal REAL NOT NULL,
        discount_amount REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        tax_breakdown TEXT DEFAULT '[]',
        platform_fee REAL DEFAULT 0,
        total REAL NOT NULL,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'unpaid',
        customer_note TEXT DEFAULT '',
        customer_name TEXT DEFAULT '',
        customer_phone TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO orders_new SELECT * FROM orders;
      DROP TABLE orders;
      ALTER TABLE orders_new RENAME TO orders;
    `);
  });
  rebuild();
  db.pragma("foreign_keys = ON");
}
migrateOrdersPaymentMethodNullable();

// Seed a single default platform_settings row if none exists yet.
const settingsRow = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
if (!settingsRow) {
  db.prepare(
    `INSERT INTO platform_settings (onboarding_fee, monthly_fee, order_fee, grace_period_days, updated_by)
     VALUES (?, ?, ?, ?, ?)`
  ).run(10000, 7000, 3, 3, "system-seed");
}

const contactRow = db.prepare("SELECT * FROM platform_contact WHERE id = 1").get();
if (!contactRow) {
  db.prepare(`INSERT INTO platform_contact (id, phone, phonepe_qr_image_url) VALUES (1, '', '')`).run();
}


// ---------------------------------------------------------------------
// Billing / POS additions (offline ordering, receipts, GST details,
// customer support). All additive -- nothing above is changed.
// ---------------------------------------------------------------------
tryAddColumn("restaurants", "gst_number TEXT DEFAULT ''");
tryAddColumn("restaurants", "fssai_number TEXT DEFAULT ''");
tryAddColumn("restaurants", "receipt_footer TEXT DEFAULT 'Thank you! Visit again.'");
// 'qr' = customer ordered by scanning; 'offline' = staff typed the order in.
tryAddColumn("orders", "source TEXT DEFAULT 'qr'");
tryAddColumn("orders", "paid_at TEXT");
tryAddColumn("platform_contact", "email TEXT DEFAULT ''");

db.exec(`
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  category TEXT DEFAULT 'other',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- open | in_progress | resolved
  admin_reply TEXT DEFAULT '',
  replied_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Super Admin's register of every client (hosted or offline-installed):
-- who they are, how to reach them, which computer/licence they have.
-- Only the Super Admin can read or change this table.
CREATE TABLE IF NOT EXISTS client_register (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  owner_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  city TEXT DEFAULT '',
  address TEXT DEFAULT '',
  gstin TEXT DEFAULT '',
  install_type TEXT DEFAULT 'offline', -- offline | hosted
  restaurant_id TEXT,                  -- link to a hosted restaurant (optional)
  machine_code TEXT DEFAULT '',
  licence_key TEXT DEFAULT '',
  licence_expires_on TEXT DEFAULT '',  -- YYYY-MM-DD, read from the key
  amount_paid REAL DEFAULT 0,
  status TEXT DEFAULT 'active',        -- trial | active | suspended | closed
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`);

// Per-client platform fee + extra amount (set by the owner in Super Admin).
tryAddColumn("subscriptions", "extra_amount REAL DEFAULT 0");
tryAddColumn("subscriptions", "extra_note TEXT DEFAULT ''");
tryAddColumn("subscriptions", "settled_extra_total REAL DEFAULT 0");
tryAddColumn("subscriptions", "fee_paid_total REAL DEFAULT 0");
tryAddColumn("client_register", "fee_paid_total REAL DEFAULT 0");
db.exec(`
CREATE TABLE IF NOT EXISTS platform_fee_payments (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT,
  amount REAL NOT NULL,
  note TEXT DEFAULT '',
  source TEXT DEFAULT 'manual',
  proof_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);
tryAddColumn("client_register", "platform_fee REAL");
tryAddColumn("client_register", "monthly_fee REAL");
tryAddColumn("client_register", "onboarding_fee REAL");
tryAddColumn("client_register", "extra_amount REAL DEFAULT 0");
tryAddColumn("client_register", "extra_note TEXT DEFAULT ''");
tryAddColumn("client_register", "last_sent_at TEXT");
tryAddColumn("client_register", "last_message TEXT DEFAULT ''");
db.exec(`
CREATE TABLE IF NOT EXISTS owner_messages (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  read INTEGER DEFAULT 0
);
`);

// Plans + the "about / my details" page that clients see on their Billing tab,
// both edited in Super Admin. Trial length and auto-suspend are platform settings.
tryAddColumn("platform_settings", "trial_days INTEGER DEFAULT 14");
tryAddColumn("platform_settings", "auto_suspend INTEGER DEFAULT 1");
tryAddColumn("platform_settings", "billing_first INTEGER DEFAULT 1");
tryAddColumn("subscriptions", "selected_plan_id TEXT");
tryAddColumn("subscriptions", "has_paid INTEGER DEFAULT 0");
db.exec(`
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_monthly REAL NOT NULL DEFAULT 0,
  onboarding_fee REAL,
  description TEXT DEFAULT '',
  features TEXT DEFAULT '[]',
  badge TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS platform_page (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  about_title TEXT DEFAULT '',
  about_text TEXT DEFAULT '',
  about_features TEXT DEFAULT '[]',
  owner_name TEXT DEFAULT '',
  owner_phone TEXT DEFAULT '',
  owner_email TEXT DEFAULT '',
  owner_hours TEXT DEFAULT '',
  payment_note TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO platform_page (id) VALUES (1);
`);

// "Continue with Google": remember the Google account id, and hold a new Google user's
// verified email for a few minutes while they finish the restaurant details on /signup.
tryAddColumn("users", "google_sub TEXT");
db.exec(`
CREATE TABLE IF NOT EXISTS oauth_pending (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT DEFAULT '',
  google_sub TEXT DEFAULT '',
  expires_at TEXT NOT NULL
);
`);

// Plan cards: type (free trial or paid), per-order platform fee, and the small texts on the card.
tryAddColumn("plans", "kind TEXT DEFAULT 'paid'");
tryAddColumn("plans", "order_fee REAL");
tryAddColumn("plans", "price_note TEXT DEFAULT ''");
tryAddColumn("plans", "footnote TEXT DEFAULT ''");
tryAddColumn("plans", "features_title TEXT DEFAULT ''");

// Voice agent (Kannada / Hindi / English): a plan feature switched on per plan in Super Admin,
// plus a small per-restaurant, per-day counter so AI usage can never run away.
tryAddColumn("plans", "voice_enabled INTEGER DEFAULT 0");
db.exec(`
CREATE TABLE IF NOT EXISTS voice_usage (
  restaurant_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (restaurant_id, day)
);
`);
db.exec(`CREATE TABLE IF NOT EXISTS app_flags (key TEXT PRIMARY KEY);`);

// One-time starting point (edit or delete anything in Super Admin afterwards; it never comes back):
// a Free Trial plan, a Rs 600 / month plan, platform fee Rs 2 per order and no setup fee.
if (!db.prepare("SELECT 1 FROM app_flags WHERE key = 'default_plans_v1'").get()) {
  db.transaction(() => {
    if (db.prepare("SELECT COUNT(*) AS c FROM plans").get().c === 0) {
      const ins = db.prepare(
        `INSERT INTO plans (id, name, price_monthly, onboarding_fee, description, features, badge, sort_order, active, kind, order_fee, price_note, footnote, features_title)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
      );
      ins.run("plan_trial", "Free Trial", 0, 0, "Try everything for free. No payment needed to start.",
        JSON.stringify(["QR menu and table ordering", "Live kitchen display and order tracking", "Offline billing and printed receipts", "Offers, campaigns and the mascot guide", "Menu manager with photos"]),
        "", 0, "trial", null, "", "No payment needed to start", "Everything included:");
      ins.run("plan_standard", "Standard", 600, 0, "Everything your restaurant needs, billed monthly.",
        JSON.stringify(["Everything in the free trial", "Unlimited QR orders and tables", "Sales reports and order history", "Customer offers and campaigns", "Priority support"]),
        "Most popular", 1, "paid", 2, "billed monthly", "No lock-in. Pay monthly by UPI.", "Everything in the free trial, plus:");
    }
    const cur = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get() || {};
    db.prepare(
      `INSERT INTO platform_settings (onboarding_fee, monthly_fee, order_fee, grace_period_days, trial_days, auto_suspend, billing_first, updated_by)
       VALUES (0, 600, 2, ?, ?, ?, ?, 'default-plans')`
    ).run(cur.grace_period_days ?? 3, cur.trial_days ?? 14, cur.auto_suspend ?? 1, cur.billing_first ?? 1);
    db.prepare("INSERT INTO app_flags (key) VALUES ('default_plans_v1')").run();
  })();
}

// One-time: add a Pro plan with the voice agent ticked, so it shows on the plans page (also for
// databases that already ran default_plans_v1 and only had Free Trial + Standard). Edit the price,
// text or delete it in Super Admin afterwards; it never comes back.
if (!db.prepare("SELECT 1 FROM app_flags WHERE key = 'default_pro_plan_v1'").get()) {
  db.transaction(() => {
    const hasPro = db.prepare("SELECT 1 FROM plans WHERE voice_enabled = 1 OR LOWER(name) = 'pro'").get();
    if (!hasPro) {
      db.prepare(
        `INSERT INTO plans (id, name, price_monthly, onboarding_fee, description, features, badge, sort_order, active, kind, order_fee, price_note, footnote, features_title, voice_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'paid', ?, ?, ?, ?, 1)`
      ).run(
        "plan_pro", "Pro", 999, 0, "Everything in Standard, plus the voice agent that works in Kannada, Hindi and English.",
        JSON.stringify(["Everything in Standard", "Voice agent for the owner and kitchen (Kannada / Hindi / English)", "Hands-free: add dishes, mark sold out, move orders to preparing / served", "Customers can search, add to cart and order by voice", "Priority support"]),
        "Voice agent", 2, 2, "billed monthly", "No lock-in. Pay monthly by UPI.", "Everything in Standard, plus:"
      );
    }
    db.prepare("INSERT INTO app_flags (key) VALUES ('default_pro_plan_v1')").run();
  })();
}
}

module.exports = { db, isNew };
