import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId, generateOrderNumber } from "@/lib/ids";
import { authRestaurant, fullOrder } from "@/lib/posAuth";

// Staff-entered ("offline") order. Prices always come from the database,
// never from the browser, so a tampered request can't change a bill.
export async function POST(request, { params }) {
  const { restaurant: slug } = await params;
  const auth = await authRestaurant(slug);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { restaurant } = auth;

  const body = await request.json().catch(() => ({}));
  const lines = Array.isArray(body.items) ? body.items : [];
  if (!lines.length) return NextResponse.json({ error: "Add at least one item." }, { status: 400 });

  const resolved = [];
  for (const l of lines) {
    const qty = Math.floor(Number(l.qty));
    if (!qty || qty < 1 || qty > 99) continue;
    const item = db.prepare("SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?").get(l.itemId, restaurant.id);
    if (!item || !item.available) {
      return NextResponse.json({ error: `"${item?.name || "An item"}" is not available.` }, { status: 409 });
    }
    resolved.push({ item, qty, price: item.discounted_price || item.price });
  }
  if (!resolved.length) return NextResponse.json({ error: "Add at least one item." }, { status: 400 });

  const subtotal = Math.round(resolved.reduce((s, r) => s + r.price * r.qty, 0));
  const orderId = newId();
  const orderNumber = generateOrderNumber(restaurant.id);
  const label = (body.label || "").toString().trim().slice(0, 40);
  const name = (body.customerName || "").toString().trim().slice(0, 60);
  const phone = (body.customerPhone || "").toString().trim().slice(0, 20);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO orders (id, order_number, restaurant_id, table_id, status, subtotal, discount_amount, tax_amount,
        tax_breakdown, platform_fee, total, payment_method, payment_status, customer_note, customer_name, customer_phone, source)
       VALUES (?, ?, ?, NULL, 'pending', ?, 0, 0, '[]', 0, ?, NULL, 'unpaid', ?, ?, ?, 'offline')`
    ).run(orderId, orderNumber, restaurant.id, subtotal, subtotal, label, name, phone);
    for (const r of resolved) {
      db.prepare(
        `INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price, addons, item_note)
         VALUES (?, ?, ?, ?, ?, ?, '[]', '')`
      ).run(newId(), orderId, r.item.id, r.item.name, r.qty, r.price);
    }
  })();

  return NextResponse.json({ order: fullOrder(orderId) }, { status: 201 });
}
