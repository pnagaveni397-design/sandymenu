import { requireSuperAdmin } from "@/lib/requireSuperAdmin";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feeSummary, recordPayment, paymentHistory } from "@/lib/platformFees";

// "Mark all collected": records the full amount still owed as received.
export async function POST(request) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const { restaurantId } = await request.json();
  if (!restaurantId) return NextResponse.json({ error: "restaurantId is required" }, { status: 400 });
  const owed = feeSummary(db, restaurantId).owed;
  const summary = owed > 0 ? recordPayment(db, restaurantId, owed, { note: "Marked as fully collected", source: "manual" }) : feeSummary(db, restaurantId);
  return NextResponse.json({ ok: true, summary, history: paymentHistory(db, restaurantId, 6) });
}
