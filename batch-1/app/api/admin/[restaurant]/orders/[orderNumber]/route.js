import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const ALLOWED_STATUSES = ["pending", "preparing", "served", "completed"];

export async function DELETE(request, { params }) {
  const order = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(params.orderNumber);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(order.id);
    db.prepare("DELETE FROM platform_fees WHERE order_id = ?").run(order.id);
    db.prepare("DELETE FROM consents WHERE order_id = ?").run(order.id);
    db.prepare("DELETE FROM reviews WHERE order_id = ?").run(order.id);
    db.prepare("DELETE FROM orders WHERE id = ?").run(order.id);
  });
  tx();

  return NextResponse.json({ ok: true });
}

export async function PATCH(request, { params }) {
  const body = await request.json();
  const order = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(params.orderNumber);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let status = body.status !== undefined
    ? (ALLOWED_STATUSES.includes(body.status) ? body.status : order.status)
    : order.status;
  const paymentStatus = body.payment_status ?? order.payment_status;

  // Marking a served order's payment as received also closes it out --
  // "served + paid" is what "completed" means. Staff don't need a
  // separate manual step for this.
  if (paymentStatus === "paid" && status === "served") {
    status = "completed";
  }

  db.prepare(
    `UPDATE orders SET status = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, paymentStatus, order.id);

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(order.id);
  const table = db.prepare("SELECT * FROM tables WHERE id = ?").get(updated.table_id);
  const full = { ...updated, table_number: table?.table_number, tax_breakdown: JSON.parse(updated.tax_breakdown || "[]") };

  return NextResponse.json({ order: full });
}
