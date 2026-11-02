import { syncSettledFlags } from "./platformFees";

const str = (v, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Validates a client record.
export function cleanClient(b) {
  const business_name = str(b.business_name, 120);
  if (!business_name) return { error: "Please enter the business name." };

  // (licence fields are no longer used; the columns stay empty)
  const machine_code = "";
  const licence_key = "";
  const licence_expires_on = "";

  const amount = Number(b.amount_paid);
  const pf = b.platform_fee === null || b.platform_fee === undefined || b.platform_fee === "" ? null : Number(b.platform_fee);
  const extra = Number(b.extra_amount);
  const nn = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));
  return {
    value: {
      business_name,
      owner_name: str(b.owner_name, 120),
      phone: str(b.phone, 40),
      email: str(b.email, 160),
      city: str(b.city, 80),
      address: str(b.address, 300),
      gstin: str(b.gstin, 20).toUpperCase(),
      install_type: "hosted",
      restaurant_id: str(b.restaurant_id, 80) || null,
      machine_code,
      licence_key,
      licence_expires_on,
      amount_paid: Number.isFinite(amount) && amount >= 0 ? amount : 0,
      platform_fee: pf !== null && Number.isFinite(pf) && pf >= 0 ? pf : null,
      monthly_fee: nn(b.monthly_fee),
      fee_paid_total: nn(b.fee_paid_total) ?? 0,
      onboarding_fee: nn(b.onboarding_fee),
      extra_amount: Number.isFinite(extra) && extra >= 0 ? extra : 0,
      extra_note: str(b.extra_note, 200),
      status: ["trial", "active", "suspended", "closed"].includes(b.status) ? b.status : "active",
      notes: str(b.notes, 2000),
    },
  };
}

// A client linked to a hosted restaurant: write the fee + extra amount straight into
// that restaurant's subscription, so it shows in THEIR Billing section and in the
// Platform fees totals. (Reading back keeps both places the same.)
export function syncToSubscription(db, v) {
  if (!v.restaurant_id) return;
  db.prepare("UPDATE subscriptions SET order_fee_override = ?, extra_amount = ?, extra_note = ?, monthly_fee = ?, onboarding_fee = ?, fee_paid_total = ? WHERE restaurant_id = ?")
    .run(v.platform_fee, v.extra_amount, v.extra_note, v.monthly_fee, v.onboarding_fee, v.fee_paid_total || 0, v.restaurant_id);
  syncSettledFlags(db, v.restaurant_id);
}
export function withLiveFees(db, rows) {
  const q = db.prepare("SELECT order_fee_override, extra_amount, extra_note, monthly_fee, onboarding_fee, fee_paid_total FROM subscriptions WHERE restaurant_id = ?");
  return rows.map((r) => {
    if (!r.restaurant_id) return r;
    const s = q.get(r.restaurant_id);
    return s ? { ...r, platform_fee: s.order_fee_override, extra_amount: s.extra_amount || 0, extra_note: s.extra_note || "", monthly_fee: s.monthly_fee, onboarding_fee: s.onboarding_fee, fee_paid_total: s.fee_paid_total || 0 } : r;
  });
}
