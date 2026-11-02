import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getUserByToken, userHasAccessToRestaurant, SESSION_COOKIE } from "@/lib/auth";

// The owner picks a plan on their Billing tab. This only changes what they are billed
// from the next payment; nothing is charged and no status changes until a payment is confirmed.
export async function POST(request, { params }) {
  const user = getUserByToken(cookies().get(SESSION_COOKIE)?.value);
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user || !userHasAccessToRestaurant(user.id, restaurant.id)) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }

  const { planId } = await request.json().catch(() => ({}));
  const plan = db.prepare("SELECT * FROM plans WHERE id = ? AND active = 1").get(planId);
  if (!plan) return NextResponse.json({ error: "That plan isn't available." }, { status: 404 });

  if (plan.kind === "trial") return NextResponse.json({ error: "The free trial starts automatically. Choose a paid plan to continue after it." }, { status: 400 });

  const sub = db.prepare("SELECT * FROM subscriptions WHERE restaurant_id = ?").get(restaurant.id);
  if (!sub) return NextResponse.json({ error: "No subscription record yet." }, { status: 404 });

  const onboarding = !sub.onboarding_paid && plan.onboarding_fee != null ? plan.onboarding_fee : sub.onboarding_fee;
  db.prepare(
    "UPDATE subscriptions SET selected_plan_id = ?, plan_name = ?, monthly_fee = ?, onboarding_fee = ?, order_fee_override = ? WHERE restaurant_id = ?"
  ).run(plan.id, plan.name, plan.price_monthly, onboarding, plan.order_fee ?? null, restaurant.id);

  return NextResponse.json({ ok: true });
}
