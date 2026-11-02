// The billing numbers one shop sees. Used when the dashboard loads AND when it refreshes itself,
// so a change made in Super Admin shows up without reloading.
import { feeSummary } from "./platformFees";

export function getSubscriptionView(db, restaurantId) {
  const row = db.prepare("SELECT * FROM subscriptions WHERE restaurant_id = ?").get(restaurantId);
  if (!row) return null;
  const g = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  const own = false;
  const fees = feeSummary(db, restaurantId);
  const set = row.monthly_fee != null || row.onboarding_fee != null || row.order_fee_override != null || (row.extra_amount || 0) > 0 || (row.fee_paid_total || 0) > 0;
  return {
    ...row,
    onboarding_fee: row.onboarding_fee ?? (own ? null : g?.onboarding_fee ?? 0),
    monthly_fee: row.monthly_fee ?? (own ? null : g?.monthly_fee ?? 600),
    order_fee_effective: row.order_fee_override ?? (own ? 0 : g?.order_fee ?? 2),
    amounts_set: own ? set : true,
    fees,
  };
}
