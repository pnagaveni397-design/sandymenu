export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request, { params }) {
  const order = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(params.orderNumber);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);
  return NextResponse.json({ order: { ...order, tax_breakdown: JSON.parse(order.tax_breakdown || "[]"), items } });
}

// The only thing a customer is allowed to change on their own order: after
// paying via UPI, they tick "I've paid" -- this just flips payment_status
// to pending_confirmation so staff know to check. It cannot mark an order
// as actually paid; only a restaurant staff member confirming on the
// Orders tab can do that.
export async function PATCH(request, { params }) {
  const body = await request.json();
  const order = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(params.orderNumber);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.customerMarkedPaid && order.payment_method === "online_upi" && order.payment_status === "unpaid") {
    db.prepare("UPDATE orders SET payment_status = 'pending_confirmation', updated_at = datetime('now') WHERE id = ?").run(order.id);
  }

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(order.id);
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);
  return NextResponse.json({ order: { ...updated, tax_breakdown: JSON.parse(updated.tax_breakdown || "[]"), items } });
}
