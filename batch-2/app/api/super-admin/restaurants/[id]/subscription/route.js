import { requireSuperAdmin } from "@/lib/requireSuperAdmin";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const body = await request.json();
  const subscription = db.prepare("SELECT * FROM subscriptions WHERE restaurant_id = ?").get(params.id);
  if (!subscription) return NextResponse.json({ error: "No subscription found for this restaurant" }, { status: 404 });

  const monthly_fee = body.monthly_fee !== undefined
    ? (body.monthly_fee === null || body.monthly_fee === "" ? null : Number(body.monthly_fee))
    : subscription.monthly_fee;
  const order_fee_override = body.order_fee_override !== undefined
    ? (body.order_fee_override === null || body.order_fee_override === "" ? null : Number(body.order_fee_override))
    : subscription.order_fee_override;
  const onboarding_fee = body.onboarding_fee !== undefined
    ? (body.onboarding_fee === null || body.onboarding_fee === "" ? null : Number(body.onboarding_fee))
    : subscription.onboarding_fee;
  const billing_cycle_end = body.billing_cycle_end !== undefined ? body.billing_cycle_end : subscription.billing_cycle_end;
  const platform_fee_enabled = body.platform_fee_enabled !== undefined
    ? (body.platform_fee_enabled ? 1 : 0)
    : subscription.platform_fee_enabled;

  const extra_amount = body.extra_amount !== undefined ? Math.max(0, Number(body.extra_amount) || 0) : (subscription.extra_amount || 0);
  const extra_note = body.extra_note !== undefined ? String(body.extra_note).slice(0, 200) : (subscription.extra_note || "");

  db.prepare(
    `UPDATE subscriptions SET monthly_fee = ?, order_fee_override = ?, onboarding_fee = ?, billing_cycle_end = ?, platform_fee_enabled = ? WHERE restaurant_id = ?`
  ).run(monthly_fee, order_fee_override, onboarding_fee, billing_cycle_end, platform_fee_enabled, params.id);
  db.prepare("UPDATE subscriptions SET extra_amount = ?, extra_note = ? WHERE restaurant_id = ?").run(extra_amount, extra_note, params.id);
  db.prepare("UPDATE client_register SET platform_fee = ?, extra_amount = ?, extra_note = ?, monthly_fee = ?, onboarding_fee = ? WHERE restaurant_id = ?").run(order_fee_override, extra_amount, extra_note, monthly_fee, onboarding_fee, params.id);

  return NextResponse.json({ ok: true });
}
