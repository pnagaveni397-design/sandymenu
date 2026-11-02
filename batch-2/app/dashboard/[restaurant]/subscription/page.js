import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUserByToken, userHasAccessToRestaurant, SESSION_COOKIE } from "@/lib/auth";
import { getSubscriptionView } from "@/lib/billingView";
import { syncStatuses } from "@/lib/subscriptionStatus";
import { SubscriptionScreen } from "../DashboardApp";

export const dynamic = "force-dynamic";

// The separate plans / subscription page every client sees right after logging in, before the dashboard.
export default function SubscriptionPage({ params }) {
  syncStatuses(db);
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) redirect("/login");

  const user = getUserByToken(cookies().get(SESSION_COOKIE)?.value);
  if (!user) redirect(`/login?next=/dashboard/${params.restaurant}/subscription`);
  if (!userHasAccessToRestaurant(user.id, restaurant.id)) redirect("/login");

  const subscription = getSubscriptionView(db, restaurant.id);
  const platformContact = db.prepare("SELECT * FROM platform_contact WHERE id = 1").get();
  const paymentProofs = db.prepare("SELECT * FROM payment_proofs WHERE restaurant_id = ? ORDER BY created_at DESC").all(restaurant.id);
  const plans = db.prepare("SELECT * FROM plans WHERE active = 1 ORDER BY sort_order ASC, created_at ASC").all();
  const platformPage = db.prepare("SELECT * FROM platform_page WHERE id = 1").get() || {};
  const rateRow = db.prepare("SELECT trial_days, order_fee, monthly_fee FROM platform_settings ORDER BY id DESC LIMIT 1").get() || {};
  const platformRates = { trial_days: rateRow.trial_days ?? 14, order_fee: rateRow.order_fee ?? 2, monthly_fee: rateRow.monthly_fee ?? 600 };

  return (
    <SubscriptionScreen
      restaurant={restaurant}
      subscription={subscription}
      platformContact={platformContact}
      paymentProofs={paymentProofs}
      plans={plans}
      platformPage={platformPage}
      platformRates={platformRates}
    />
  );
}
