import { requireSuperAdmin } from "@/lib/requireSuperAdmin";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request, { params }) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(params.id);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("UPDATE restaurants SET status = 'pending_payment' WHERE id = ?").run(restaurant.id);
  db.prepare("UPDATE subscriptions SET status = 'pending_payment' WHERE restaurant_id = ?").run(restaurant.id);

  return NextResponse.json({ ok: true });
}
