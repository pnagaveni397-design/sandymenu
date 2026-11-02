const { db } = require("./db");
const { feeSummary, paymentHistory } = require("./platformFees");
const { syncStatuses } = require("./subscriptionStatus");

function getSuperAdminDashboardData() {
  syncStatuses(db);
  const settings = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  const settingsHistory = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 10").all();

  const rawRestaurants = db
    .prepare(
      `SELECT r.*, s.monthly_fee, s.order_fee_override, s.billing_cycle_end, s.billing_cycle_start,
              s.onboarding_fee, s.onboarding_paid, s.platform_fee_enabled,
              s.extra_amount, s.extra_note, s.settled_extra_total
       FROM restaurants r LEFT JOIN subscriptions s ON s.restaurant_id = r.id
       ORDER BY r.created_at DESC`
    )
    .all();

  const restaurants = rawRestaurants.map((r) => {
    // Pending payment proofs uploaded by the client from their billing tab.
    const pendingProofs = db
      .prepare("SELECT * FROM payment_proofs WHERE restaurant_id = ? AND status = 'pending' ORDER BY created_at DESC")
      .all(r.id);
    const allProofs = db
      .prepare("SELECT * FROM payment_proofs WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 10")
      .all(r.id);

    // A password-reset link the client requested but (maybe) never
    // received by email — surfaced here so the admin can hand it over
    // directly (WhatsApp/phone) if email delivery isn't working.
    const owner = db
      .prepare(
        `SELECT u.email, u.reset_token, u.reset_token_expires FROM users u
         JOIN restaurant_users ru ON ru.user_id = u.id
         WHERE ru.restaurant_id = ? LIMIT 1`
      )
      .get(r.id);
    const hasPendingReset =
      owner?.reset_token && owner?.reset_token_expires && new Date(owner.reset_token_expires) > new Date();

    // This month's platform-fee amount owed (unsettled fees), computed
    // live from the ledger rather than a cached figure, so it's always
    // accurate the instant an order is placed or removed.
    const feeRow = db
      .prepare("SELECT COUNT(*) as n FROM platform_fees WHERE restaurant_id = ? AND settled = 0")
      .get(r.id);
    const fs = feeSummary(db, r.id);

    return {
      ...r,
      monthly_fee_is_custom: r.monthly_fee !== null,
      monthly_fee_effective: r.monthly_fee ?? settings?.monthly_fee ?? 7000,
      onboarding_fee_is_custom: r.onboarding_fee !== null,
      onboarding_fee_effective: r.onboarding_fee ?? settings?.onboarding_fee ?? 10000,
      platform_fee_enabled: r.platform_fee_enabled !== 0,
      order_fee_is_custom: r.order_fee_override !== null && r.order_fee_override !== undefined,
      order_fee_effective: r.order_fee_override ?? settings?.order_fee ?? 2,
      extra_amount: r.extra_amount || 0,
      extra_note: r.extra_note || "",
      platform_accrued: fs.accrued,
      platform_extra: fs.extra,
      platform_paid: fs.paid,
      payment_history: paymentHistory(db, r.id, 6),
      unsettled_platform_fees: fs.owed,
      unsettled_platform_fee_orders: feeRow.n,
      settled_platform_fees_total: fs.paid,
      pending_payment_proofs: pendingProofs,
      payment_proofs: allProofs,
      owner_email: owner?.email || null,
      pending_reset_link: hasPendingReset ? `/reset-password?token=${owner.reset_token}` : null,
    };
  });

  const contact = db.prepare("SELECT * FROM platform_contact WHERE id = 1").get();

  const totalUnsettled = restaurants.reduce((n, x) => n + (x.unsettled_platform_fees || 0), 0);
  const totalSettled = restaurants.reduce((n, x) => n + (x.platform_paid || 0), 0);
  const feesByRestaurant = restaurants
    .filter((x) => (x.unsettled_platform_fees || 0) > 0)
    .map((x) => ({ restaurant_id: x.id, name: x.name, unsettled: x.unsettled_platform_fees, unsettled_orders: x.unsettled_platform_fee_orders }))
    .sort((p, q) => q.unsettled - p.unsettled);

  return {
    settings,
    settingsHistory,
    restaurants,
    contact,
    feeBalance: { totalUnsettled, totalSettled, byRestaurant: feesByRestaurant },
  };
}

module.exports = { getSuperAdminDashboardData };
