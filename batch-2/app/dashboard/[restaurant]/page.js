import { getSubscriptionView } from "@/lib/billingView";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUserByToken, userHasAccessToRestaurant, SESSION_COOKIE } from "@/lib/auth";
import DashboardApp, { SuspendedBilling } from "./DashboardApp";
import { parseJsonArray } from "@/lib/templates";
import { syncStatuses } from "@/lib/subscriptionStatus";
import { restaurantHasVoice } from "@/lib/voiceAccess";

export default function DashboardPage({ params }) {
  syncStatuses(db);
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);

  if (!restaurant) {
    return (
      <main className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/60">No restaurant found for "{params.restaurant}".</p>
      </main>
    );
  }

  const token = cookies().get(SESSION_COOKIE)?.value;
  const user = getUserByToken(token);
  if (!user) redirect(`/login?next=/dashboard/${params.restaurant}`);
  if (!userHasAccessToRestaurant(user.id, restaurant.id)) {
    return (
      <main className="min-h-screen bg-paper flex items-center justify-center px-6 text-center">
        <p className="text-ink/60">Your account doesn't have access to this restaurant's dashboard.</p>
      </main>
    );
  }

  const categories = db
    .prepare("SELECT * FROM categories WHERE restaurant_id = ? ORDER BY sort_order")
    .all(restaurant.id);
  const items = db
    .prepare("SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY created_at")
    .all(restaurant.id)
    .map((it) => ({ ...it, tags: JSON.parse(it.tags || "[]") }));
  const tables = db.prepare("SELECT * FROM tables WHERE restaurant_id = ?").all(restaurant.id);
  const offers = db.prepare("SELECT * FROM offers WHERE restaurant_id = ?").all(restaurant.id);
  const orders = db
    .prepare(
      `SELECT o.*, COALESCE(t.table_number, 'Counter') AS table_number, pf.settled as platform_fee_settled FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN platform_fees pf ON pf.order_id = o.id
       WHERE o.restaurant_id = ? ORDER BY o.created_at DESC LIMIT 100`
    )
    .all(restaurant.id);
  const orderIds = orders.map((o) => o.id);
  const itemsByOrder = {};
  if (orderIds.length) {
    const placeholders = orderIds.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`)
      .all(...orderIds);
    for (const row of rows) {
      itemsByOrder[row.order_id] = itemsByOrder[row.order_id] || [];
      itemsByOrder[row.order_id].push(row);
    }
  }
  const ordersWithItems = orders.map((o) => ({
    ...o,
    tax_breakdown: JSON.parse(o.tax_breakdown || "[]"),
    items: itemsByOrder[o.id] || [],
  }));

  const paymentSettings = db
    .prepare("SELECT * FROM restaurant_payment_settings WHERE restaurant_id = ?")
    .get(restaurant.id);

  const subscription = getSubscriptionView(db, restaurant.id);
  const campaigns = db.prepare("SELECT * FROM campaigns WHERE restaurant_id = ?").all(restaurant.id)
    .map((c) => ({ ...c, template_videos: parseJsonArray(c.template_videos), templates: parseJsonArray(c.templates) }));
  const taxes = db.prepare("SELECT * FROM restaurant_taxes WHERE restaurant_id = ?").all(restaurant.id);
  const platformContact = db.prepare("SELECT * FROM platform_contact WHERE id = 1").get();
  const reviews = db
    .prepare("SELECT * FROM reviews WHERE restaurant_id = ? ORDER BY submitted_at DESC LIMIT 200")
    .all(restaurant.id)
    .map((r) => ({ ...r, scenes: parseJsonArray(r.scenes) }));
  const paymentProofs = db
    .prepare("SELECT * FROM payment_proofs WHERE restaurant_id = ? ORDER BY created_at DESC")
    .all(restaurant.id);

  const plans = db.prepare("SELECT * FROM plans WHERE active = 1 ORDER BY sort_order ASC, created_at ASC").all();
  const platformPage = db.prepare("SELECT * FROM platform_page WHERE id = 1").get() || {};
  const rateRow = db.prepare("SELECT trial_days, order_fee, monthly_fee FROM platform_settings ORDER BY id DESC LIMIT 1").get() || {};
  const platformRates = { trial_days: rateRow.trial_days ?? 14, order_fee: rateRow.order_fee ?? 2, monthly_fee: rateRow.monthly_fee ?? 600 };

  // A suspended client only gets the plans / pay screen until a payment is confirmed.
  if (restaurant.status === "suspended") {
    return (
      <SuspendedBilling
        restaurant={restaurant}
        subscription={subscription}
        platformContact={platformContact}
        orders={[]}
        paymentProofs={paymentProofs}
        plans={plans}
        platformPage={platformPage}
        platformRates={platformRates}
      />
    );
  }

  const totals = db
    .prepare(
      `SELECT COUNT(*) as totalOrders, COALESCE(SUM(total),0) as totalSales,
              COALESCE(SUM(CASE WHEN payment_method='cash' THEN 1 ELSE 0 END),0) as cashOrders,
              COALESCE(SUM(CASE WHEN payment_method='online_upi' THEN 1 ELSE 0 END),0) as onlineOrders
       FROM orders WHERE restaurant_id = ?`
    )
    .get(restaurant.id);

  return (
    <DashboardApp
      restaurant={restaurant}
      categories={categories}
      items={items}
      tables={tables}
      offers={offers}
      orders={ordersWithItems}
      paymentSettings={paymentSettings}
      subscription={subscription}
      totals={totals}
      campaigns={campaigns}
      reviews={reviews}
      taxes={taxes}
      platformContact={platformContact}
      paymentProofs={paymentProofs}
      plans={plans}
      platformPage={platformPage}
      platformRates={platformRates}
      billingFirst={(db.prepare("SELECT billing_first FROM platform_settings ORDER BY id DESC LIMIT 1").get()?.billing_first ?? 1) !== 0}
      userName={user.name}
      userEmail={user.email}
      voiceEnabled={restaurantHasVoice(restaurant.id)}
    />
  );
}
