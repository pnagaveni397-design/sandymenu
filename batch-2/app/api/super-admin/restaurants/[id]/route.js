import { requireSuperAdmin } from "@/lib/requireSuperAdmin";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(request, { params }) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(params.id);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Capture which users are linked to this restaurant BEFORE we unlink them,
  // so we can clean up any that end up with no restaurants left. Without
  // this, the `users` row (and its unique email) lives on forever even
  // after the restaurant is fully deleted, which is why a client who tries
  // to sign up again with their old email used to be told the account
  // "already exists" — the restaurant was gone but the email was still
  // reserved.
  const linkedUserIds = db
    .prepare("SELECT DISTINCT user_id FROM restaurant_users WHERE restaurant_id = ?")
    .all(restaurant.id)
    .map((r) => r.user_id);

  const tx = db.transaction(() => {
    // Delete anything referencing an order (or a campaign) BEFORE the
    // orders/campaigns themselves, or SQLite's foreign key constraints
    // reject the whole transaction.
    const orderIds = db.prepare("SELECT id FROM orders WHERE restaurant_id = ?").all(restaurant.id).map((o) => o.id);
    for (const orderId of orderIds) {
      db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);
      db.prepare("DELETE FROM platform_fees WHERE order_id = ?").run(orderId);
      db.prepare("DELETE FROM consents WHERE order_id = ?").run(orderId);
      db.prepare("DELETE FROM reviews WHERE order_id = ?").run(orderId);
    }
    db.prepare("DELETE FROM orders WHERE restaurant_id = ?").run(restaurant.id);

    db.prepare("DELETE FROM consents WHERE campaign_id IN (SELECT id FROM campaigns WHERE restaurant_id = ?)").run(restaurant.id);
    db.prepare("DELETE FROM reviews WHERE restaurant_id = ?").run(restaurant.id);
    db.prepare("DELETE FROM campaigns WHERE restaurant_id = ?").run(restaurant.id);

    db.prepare("DELETE FROM menu_item_addons WHERE menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = ?)").run(restaurant.id);
    db.prepare("DELETE FROM menu_items WHERE restaurant_id = ?").run(restaurant.id);
    db.prepare("DELETE FROM categories WHERE restaurant_id = ?").run(restaurant.id);
    db.prepare("DELETE FROM tables WHERE restaurant_id = ?").run(restaurant.id);
    db.prepare("DELETE FROM offers WHERE restaurant_id = ?").run(restaurant.id);
    db.prepare("DELETE FROM restaurant_taxes WHERE restaurant_id = ?").run(restaurant.id);
    db.prepare("DELETE FROM restaurant_notification_emails WHERE restaurant_id = ?").run(restaurant.id);
    db.prepare("DELETE FROM restaurant_payment_settings WHERE restaurant_id = ?").run(restaurant.id);
    db.prepare("DELETE FROM analytics_events WHERE restaurant_id = ?").run(restaurant.id);
    db.prepare("DELETE FROM payment_proofs WHERE restaurant_id = ?").run(restaurant.id);
    db.prepare("DELETE FROM subscriptions WHERE restaurant_id = ?").run(restaurant.id);
    db.prepare("DELETE FROM restaurant_users WHERE restaurant_id = ?").run(restaurant.id);
    db.prepare("DELETE FROM restaurants WHERE id = ?").run(restaurant.id);

    // Free up the email of any user who no longer has any restaurant left
    // (the normal case — one owner account per restaurant) so they can
    // sign up again later with the same email without hitting a false
    // "account already exists" error.
    for (const userId of linkedUserIds) {
      const remaining = db.prepare("SELECT COUNT(*) as c FROM restaurant_users WHERE user_id = ?").get(userId).c;
      if (remaining === 0) {
        db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM users WHERE id = ?").run(userId);
      }
    }
  });
  tx();

  return NextResponse.json({ ok: true });
}
