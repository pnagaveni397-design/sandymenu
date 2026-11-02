import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRestaurant, computeBill, fullOrder } from "@/lib/posAuth";

// Takes payment for an offline order and closes it as a finished bill.
// Tax is recomputed here from the restaurant's own (editable) tax list.
export async function POST(request, { params }) {
  const { restaurant: slug, orderNumber } = await params;
  const auth = await authRestaurant(slug);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { restaurant } = auth;

  const { paymentMethod, discount } = await request.json().catch(() => ({}));
  if (!["cash", "online_upi"].includes(paymentMethod)) {
    return NextResponse.json({ error: "Choose Cash or Online payment." }, { status: 400 });
  }
  const order = db.prepare("SELECT * FROM orders WHERE order_number = ? AND restaurant_id = ?").get(orderNumber, restaurant.id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.payment_method) return NextResponse.json({ error: "This order is already billed." }, { status: 409 });

  const taxes = db.prepare("SELECT * FROM restaurant_taxes WHERE restaurant_id = ? AND active = 1").all(restaurant.id);
  const bill = computeBill(order.subtotal, Number(discount) || 0, taxes);

  // No platform fee on staff-entered bills: the customer's total is
  // exactly items - discount + tax.
  db.prepare(
    `UPDATE orders SET discount_amount = ?, tax_amount = ?, tax_breakdown = ?, platform_fee = 0, total = ?,
       payment_method = ?, payment_status = 'paid', status = 'completed', paid_at = datetime('now'),
       updated_at = datetime('now') WHERE id = ?`
  ).run(bill.discount, bill.tax, JSON.stringify(bill.breakdown), bill.total, paymentMethod, order.id);

  return NextResponse.json({ order: fullOrder(order.id) });
}
