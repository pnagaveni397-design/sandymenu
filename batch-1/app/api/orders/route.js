import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId, generateOrderNumber } from "@/lib/ids";
import { syncStatuses } from "@/lib/subscriptionStatus";

export async function POST(request) {
  const body = await request.json();
  const { restaurantId, tableId, items, subtotal, sessionId, customerName, customerPhone } = body;

  if (!restaurantId || !tableId || !items?.length) {
    return NextResponse.json({ error: "Missing order details" }, { status: 400 });
  }

  syncStatuses(db);
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(restaurantId);
  if (!restaurant || restaurant.status === "suspended") {
    return NextResponse.json({ error: "This restaurant isn't accepting orders right now." }, { status: 403 });
  }

  // Every rupee amount is rounded to a whole rupee exactly once, here.
  const roundMoney = (n) => Math.round(n);
  const roundedSubtotal = roundMoney(subtotal);

  // Payment method, discount (offer/campaign), tax, and platform fee are
  // no longer decided at order time. The customer picks a discount (if
  // any) and a payment method only after their food has been served --
  // see /api/orders/[orderNumber]/finalize. Placing the order just sends
  // the items to the kitchen: no bill, no payment step, yet.
  const orderId = newId();
  const orderNumber = generateOrderNumber(restaurantId);

  // Name is trimmed and capped to a sane length; phone is optional and kept
  // as-entered (no format enforced, since customers may be on any country's
  // number format) but also capped to avoid abuse via a huge payload.
  const cleanCustomerName = (customerName || "").toString().trim().slice(0, 60);
  const cleanCustomerPhone = (customerPhone || "").toString().trim().slice(0, 20);

  const insertOrder = db.prepare(
    `INSERT INTO orders
      (id, order_number, restaurant_id, table_id, status, subtotal, discount_amount, tax_amount,
       tax_breakdown, platform_fee, total, payment_method, payment_status, customer_name, customer_phone)
     VALUES (?, ?, ?, ?, 'pending', ?, 0, 0, '[]', 0, ?, NULL, 'unpaid', ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price, addons, item_note)
     VALUES (?, ?, ?, ?, ?, ?, '[]', ?)`
  );

  const tx = db.transaction(() => {
    insertOrder.run(orderId, orderNumber, restaurantId, tableId, roundedSubtotal, roundedSubtotal, cleanCustomerName, cleanCustomerPhone);
    for (const it of items) {
      insertItem.run(newId(), orderId, it.itemId, it.name, it.qty, it.price, it.note || "");
    }
    db.prepare(
      `INSERT INTO analytics_events (id, restaurant_id, event_type, metadata) VALUES (?, ?, 'order_placed', ?)`
    ).run(newId(), restaurantId, JSON.stringify({ orderNumber, subtotal: roundedSubtotal }));
  });
  tx();

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  const orderItems = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderId);
  const table = db.prepare("SELECT * FROM tables WHERE id = ?").get(tableId);
  const fullOrder = { ...order, table_number: table?.table_number, tax_breakdown: JSON.parse(order.tax_breakdown || "[]"), items: orderItems };

  // n8n webhook (Stage 2). Fires only if configured -- safe no-op otherwise.
  notifyN8n({ restaurant, orderNumber, tableId, items, total: roundedSubtotal }).catch(() => {});

  return NextResponse.json({ order: fullOrder }, { status: 201 });
}

async function notifyN8n({ restaurant, orderNumber, tableId, items, total }) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return; // no webhook configured, skip silently
  await fetch(`${url}/order-created`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET || "" },
    body: JSON.stringify({
      restaurantId: restaurant.id, restaurantName: restaurant.name, orderNumber,
      tableId, items, total, timestamp: new Date().toISOString(),
    }),
  });
}
