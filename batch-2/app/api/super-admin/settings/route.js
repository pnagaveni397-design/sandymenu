import { requireSuperAdmin } from "@/lib/requireSuperAdmin";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const settings = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  return NextResponse.json({ settings });
}

// Inserts a new versioned row rather than updating in place, so every past
// rate is preserved for invoice-dispute auditing (see technical-spec.md §5).
export async function POST(request) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const { onboarding_fee, monthly_fee, order_fee, grace_period_days, trial_days, auto_suspend, billing_first } = await request.json();
  const prev = db.prepare("SELECT trial_days, auto_suspend, billing_first FROM platform_settings ORDER BY id DESC LIMIT 1").get() || {};
  const trial = Math.min(365, Math.max(0, Math.round(Number(trial_days ?? prev.trial_days ?? 14))));
  const auto = auto_suspend === undefined ? (prev.auto_suspend ?? 1) : (auto_suspend ? 1 : 0);
  const prevGrace = db.prepare("SELECT grace_period_days FROM platform_settings ORDER BY id DESC LIMIT 1").get()?.grace_period_days;
  const first = billing_first === undefined ? (prev.billing_first ?? 1) : (billing_first ? 1 : 0);

  db.prepare(
    `INSERT INTO platform_settings (onboarding_fee, monthly_fee, order_fee, grace_period_days, trial_days, auto_suspend, billing_first, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(onboarding_fee, monthly_fee, order_fee, grace_period_days, trial, auto, first, "super-admin");
  // Clients still on the old default grace period move to the new one; a client you gave a different value keeps it.
  if (prevGrace != null && Number(grace_period_days) !== Number(prevGrace)) {
    db.prepare("UPDATE subscriptions SET grace_period_days = ? WHERE grace_period_days = ?").run(grace_period_days, prevGrace);
  }

  const settings = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  return NextResponse.json({ settings });
}
