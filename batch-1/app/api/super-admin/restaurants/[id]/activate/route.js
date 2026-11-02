import { requireSuperAdmin } from "@/lib/requireSuperAdmin";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request, { params }) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(params.id);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const subscription = db.prepare("SELECT * FROM subscriptions WHERE restaurant_id = ?").get(restaurant.id);

  db.prepare("UPDATE restaurants SET status = 'active' WHERE id = ?").run(restaurant.id);
  db.prepare(
    `UPDATE subscriptions
     SET status = 'active', onboarding_paid = 1,
         billing_cycle_start = date('now'), billing_cycle_end = date('now', '+30 day')
     WHERE restaurant_id = ?`
  ).run(restaurant.id);

  return NextResponse.json({ ok: true });
}
