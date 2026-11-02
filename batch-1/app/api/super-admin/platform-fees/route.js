import { requireSuperAdmin } from "@/lib/requireSuperAdmin";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feeSummary } from "@/lib/platformFees";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const shops = db.prepare("SELECT id, name FROM restaurants").all();
  const rows = shops.map((s) => ({ ...s, ...feeSummary(db, s.id) }));
  const totalUnsettled = rows.reduce((n, x) => n + x.owed, 0);
  const totalSettled = rows.reduce((n, x) => n + x.paid, 0);
  const byRestaurant = rows
    .filter((x) => x.owed > 0)
    .map((x) => ({ restaurant_id: x.id, name: x.name, unsettled: x.owed, unsettled_orders: x.orders }))
    .sort((a, b) => b.unsettled - a.unsettled);
  return NextResponse.json({ totalUnsettled, totalSettled, byRestaurant });
}
