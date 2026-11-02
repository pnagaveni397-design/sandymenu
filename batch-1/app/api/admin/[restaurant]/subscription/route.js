import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRestaurant } from "@/lib/posAuth";
import { getSubscriptionView } from "@/lib/billingView";

export const dynamic = "force-dynamic";

// Fresh billing numbers for the open dashboard (it asks every 30 seconds).
export async function GET(request, { params }) {
  const { restaurant: slug } = await params;
  const auth = await authRestaurant(slug);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const restaurantId = auth.restaurant?.id ?? db.prepare("SELECT id FROM restaurants WHERE slug = ?").get(slug)?.id;
  return NextResponse.json({ subscription: restaurantId ? getSubscriptionView(db, restaurantId) : null });
}
