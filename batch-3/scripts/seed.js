// scripts/seed.js — run with `npm run seed`
const { db } = require("../lib/db");
const { newId, generateOrderNumber } = require("../lib/ids");
const { hashPassword, linkUserToRestaurant } = require("../lib/auth");

const DEMO_EMAIL = "demo@spicegarden.test";
const DEMO_PASSWORD = "demo1234";

function seedDemoUser(restaurantId) {
  const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(DEMO_EMAIL);
  if (existing) return existing;
  const id = newId();
  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
    id,
    DEMO_EMAIL,
    hashPassword(DEMO_PASSWORD),
    "Spice Garden Owner"
  );
  linkUserToRestaurant(id, restaurantId, "owner");
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function upsertRestaurant() {
  const existing = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get("spice-garden");
  if (existing) return existing;

  const id = newId();
  db.prepare(
    `INSERT INTO restaurants
      (id, slug, name, logo_emoji, tagline, description, address, phone, currency, tax_percent, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    "spice-garden",
    "Spice Garden",
    "🌶️",
    "Discover today's delicious specials.",
    "A neighbourhood favourite for home-style Indian food, biryani, and wood-fired pizza.",
    "12 MG Road, Mysuru",
    "+91 98765 43210",
    "INR",
    5,
    "active"
  );

  db.prepare(
    `INSERT INTO restaurant_payment_settings (restaurant_id, phonepe_qr_image_url, upi_id, cash_enabled, online_enabled)
     VALUES (?, ?, ?, 1, 1)`
  ).run(id, "", "spicegarden@upi");

  db.prepare(
    `INSERT INTO subscriptions
      (id, restaurant_id, plan_name, onboarding_fee, onboarding_paid, monthly_fee,
       billing_cycle_start, billing_cycle_end, status, grace_period_days)
     VALUES (?, ?, 'Standard', 10000, 1, 7000, date('now'), date('now','+30 day'), 'active', 3)`
  ).run(newId(), id);

  return db.prepare("SELECT * FROM restaurants WHERE id = ?").get(id);
}

function seedCategories(restaurantId) {
  const names = ["Starters", "Biryani", "Main Course", "Pizza", "Beverages", "Desserts"];
  const ids = {};
  names.forEach((name, i) => {
    const existing = db
      .prepare("SELECT * FROM categories WHERE restaurant_id = ? AND name = ?")
      .get(restaurantId, name);
    if (existing) {
      ids[name] = existing.id;
      return;
    }
    const id = newId();
    db.prepare(
      `INSERT INTO categories (id, restaurant_id, name, sort_order, active) VALUES (?, ?, ?, ?, 1)`
    ).run(id, restaurantId, name, i);
    ids[name] = id;
  });
  return ids;
}

function seedMenuItems(restaurantId, cat) {
  const existingCount = db
    .prepare("SELECT COUNT(*) c FROM menu_items WHERE restaurant_id = ?")
    .get(restaurantId).c;
  if (existingCount > 0) return;

  const items = [
    {
      category: "Starters", name: "Paneer Tikka", description: "Chargrilled cottage cheese marinated in spiced yogurt.",
      price: 220, discounted_price: null, emoji: "🧀", veg: 1, spice: "medium",
      tags: ["popular"], popular: 1, recommended: 0,
    },
    {
      category: "Starters", name: "Chicken 65", description: "Deep-fried spicy chicken bites, South Indian style.",
      price: 240, discounted_price: 210, emoji: "🍗", veg: 0, spice: "hot",
      tags: ["spicy", "popular"], popular: 1, recommended: 0,
    },
    {
      category: "Biryani", name: "Chicken Biryani", description: "Slow-cooked basmati rice layered with spiced chicken.",
      price: 280, discounted_price: null, emoji: "🍛", veg: 0, spice: "medium",
      tags: ["popular", "under-300"], popular: 1, recommended: 1,
    },
    {
      category: "Biryani", name: "Veg Dum Biryani", description: "Fragrant basmati rice with garden vegetables and saffron.",
      price: 220, discounted_price: null, emoji: "🍚", veg: 1, spice: "mild",
      tags: ["under-300"], popular: 0, recommended: 1,
    },
    {
      category: "Main Course", name: "Butter Chicken", description: "Tandoori chicken simmered in a rich tomato-butter gravy.",
      price: 320, discounted_price: null, emoji: "🍗", veg: 0, spice: "mild",
      tags: ["popular"], popular: 1, recommended: 0,
    },
    {
      category: "Main Course", name: "Dal Tadka", description: "Yellow lentils tempered with cumin, garlic, and ghee.",
      price: 180, discounted_price: null, emoji: "🥘", veg: 1, spice: "mild",
      tags: ["healthy", "budget"], popular: 0, recommended: 0,
    },
    {
      category: "Pizza", name: "Margherita Pizza", description: "Wood-fired, San Marzano tomato, fresh mozzarella, basil.",
      price: 260, discounted_price: null, emoji: "🍕", veg: 1, spice: "none",
      tags: ["popular"], popular: 1, recommended: 0,
    },
    {
      category: "Pizza", name: "Peri Peri Chicken Pizza", description: "Wood-fired base, peri peri chicken, bell peppers, cheese.",
      price: 340, discounted_price: 300, emoji: "🍕", veg: 0, spice: "hot",
      tags: ["spicy"], popular: 0, recommended: 0,
    },
    {
      category: "Beverages", name: "Masala Chaas", description: "Spiced buttermilk with curry leaf and roasted cumin.",
      price: 60, discounted_price: null, emoji: "🥤", veg: 1, spice: "none",
      tags: ["budget", "healthy"], popular: 0, recommended: 0,
    },
    {
      category: "Beverages", name: "Cold Coffee", description: "Chilled coffee blended with milk and a scoop of ice cream.",
      price: 120, discounted_price: null, emoji: "🥤", veg: 1, spice: "none",
      tags: [], popular: 0, recommended: 0,
    },
    {
      category: "Desserts", name: "Gulab Jamun (2 pc)", description: "Warm milk-solid dumplings soaked in rose-cardamom syrup.",
      price: 90, discounted_price: null, emoji: "🍮", veg: 1, spice: "none",
      tags: ["sweet", "budget"], popular: 1, recommended: 0,
    },
    {
      category: "Desserts", name: "Chocolate Brownie", description: "Warm fudge brownie with vanilla ice cream.",
      price: 150, discounted_price: null, emoji: "🍫", veg: 1, spice: "none",
      tags: ["sweet"], popular: 0, recommended: 0,
    },
  ];

  const insert = db.prepare(
    `INSERT INTO menu_items
      (id, restaurant_id, category_id, name, description, price, discounted_price, image_emoji,
       is_veg, spice_level, tags, prep_time_minutes, available, is_popular, is_recommended)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  );

  for (const it of items) {
    insert.run(
      newId(),
      restaurantId,
      cat[it.category],
      it.name,
      it.description,
      it.price,
      it.discounted_price,
      it.emoji,
      it.veg,
      it.spice,
      JSON.stringify(it.tags),
      15,
      it.popular,
      it.recommended
    );
  }
}

function seedTables(restaurantId) {
  const existingCount = db.prepare("SELECT COUNT(*) c FROM tables WHERE restaurant_id = ?").get(restaurantId).c;
  if (existingCount > 0) return;
  for (let i = 1; i <= 6; i++) {
    db.prepare(
      `INSERT INTO tables (id, restaurant_id, table_number, table_name, active) VALUES (?, ?, ?, ?, 1)`
    ).run(newId(), restaurantId, String(i), `Table ${i}`);
  }
}

function seedOffers(restaurantId) {
  const existingCount = db.prepare("SELECT COUNT(*) c FROM offers WHERE restaurant_id = ?").get(restaurantId).c;
  if (existingCount > 0) return;
  db.prepare(
    `INSERT INTO offers (id, restaurant_id, title, description, discount_type, discount_value, min_order_value, active)
     VALUES (?, ?, ?, ?, 'percent', 10, 500, 1)`
  ).run(newId(), restaurantId, "10% OFF on orders above ₹500", "Applied automatically at checkout.");
}

function seedTaxes(restaurantId) {
  const existingCount = db.prepare("SELECT COUNT(*) c FROM restaurant_taxes WHERE restaurant_id = ?").get(restaurantId).c;
  if (existingCount > 0) return;
  db.prepare(
    `INSERT INTO restaurant_taxes (id, restaurant_id, name, percent, active) VALUES (?, ?, 'GST', 5, 1)`
  ).run(newId(), restaurantId);
}

function seedSampleOrder(restaurant) {
  const existing = db.prepare("SELECT COUNT(*) c FROM orders WHERE restaurant_id = ?").get(restaurant.id).c;
  if (existing > 0) return;

  const table = db.prepare("SELECT * FROM tables WHERE restaurant_id = ? LIMIT 1").get(restaurant.id);
  const biryani = db
    .prepare("SELECT * FROM menu_items WHERE restaurant_id = ? AND name = 'Chicken Biryani'")
    .get(restaurant.id);
  if (!table || !biryani) return;

  const orderId = newId();
  const orderNumber = generateOrderNumber(restaurant.id);
  const subtotal = biryani.price;
  const tax = Math.round(subtotal * (restaurant.tax_percent / 100));
  const platformFee = 3;
  const total = subtotal + tax;

  db.prepare(
    `INSERT INTO orders
      (id, order_number, restaurant_id, table_id, status, subtotal, discount_amount, tax_amount,
       platform_fee, total, payment_method, payment_status)
     VALUES (?, ?, ?, ?, 'completed', ?, 0, ?, ?, ?, 'cash', 'paid')`
  ).run(orderId, orderNumber, restaurant.id, table.id, subtotal, tax, platformFee, total);

  db.prepare(
    `INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price, addons, item_note)
     VALUES (?, ?, ?, ?, 1, ?, '[]', '')`
  ).run(newId(), orderId, biryani.id, biryani.name, biryani.price);
}

const restaurant = upsertRestaurant();
const cat = seedCategories(restaurant.id);
seedMenuItems(restaurant.id, cat);
seedTables(restaurant.id);
seedOffers(restaurant.id);
seedTaxes(restaurant.id);
seedSampleOrder(restaurant);
seedDemoUser(restaurant.id);

console.log("Seed complete.");
console.log(`Demo restaurant: ${restaurant.name} (slug: ${restaurant.slug})`);
console.log(`Customer flow: /r/${restaurant.slug}/table/1`);
console.log(`Dashboard login: /login`);
console.log(`  email:    ${DEMO_EMAIL}`);
console.log(`  password: ${DEMO_PASSWORD}`);
