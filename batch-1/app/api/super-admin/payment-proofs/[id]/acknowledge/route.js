import { requireSuperAdmin } from "@/lib/requireSuperAdmin";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordPayment, paymentHistory } from "@/lib/platformFees";

export async function POST(request, { params }) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const proof = db.prepare("SELECT * FROM payment_proofs WHERE id = ?").get(params.id);
  if (!proof) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  let summary = null;
  if (proof.type === "platform_fee") {
    const amount = Number(body.amount ?? proof.amount_claimed);
    if (!(amount > 0)) return NextResponse.json({ error: "Enter the amount you received." }, { status: 400 });
    summary = recordPayment(db, proof.restaurant_id, amount, { note: "From payment screenshot", source: "proof", proofId: proof.id });
  }
  db.prepare("UPDATE payment_proofs SET status = 'acknowledged', reviewed_at = datetime('now') WHERE id = ?").run(params.id);

  if (proof.type === "platform_fee") {
    // The amount received was deducted above; whatever is left stays owed until it is paid in full.
  } else {
    // Subscription payment confirmed: mark it, renew the billing cycle,
    // and make sure onboarding is flagged paid + the account is active.
    // The client's Billing tab shows a "you paid successfully this month"
    // confirmation the moment this happens.
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    // Paying early never wastes days: the new month starts from the current due date if it is still ahead.
    const cur = db.prepare("SELECT billing_cycle_end FROM subscriptions WHERE restaurant_id = ?").get(proof.restaurant_id);
    const curEnd = /^\d{4}-\d{2}-\d{2}$/.test(cur?.billing_cycle_end || "") ? new Date(`${cur.billing_cycle_end}T00:00:00Z`) : null;
    const base = curEnd && curEnd.getTime() > today.getTime() ? curEnd : today;
    const nextCycleEnd = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    db.prepare(
      `UPDATE subscriptions SET onboarding_paid = 1, has_paid = 1, last_payment_confirmed_at = datetime('now'),
        billing_cycle_start = ?, billing_cycle_end = ?, status = 'active'
       WHERE restaurant_id = ?`
    ).run(fmt(today), fmt(nextCycleEnd), proof.restaurant_id);
    db.prepare(`UPDATE restaurants SET status = 'active' WHERE id = ?`).run(proof.restaurant_id);
  }

  return NextResponse.json({ ok: true, summary, history: summary ? paymentHistory(db, proof.restaurant_id, 6) : undefined });
}
