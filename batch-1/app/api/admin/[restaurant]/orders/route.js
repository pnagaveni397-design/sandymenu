import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orders = db
    .prepare(
      `SELECT o.*, COALESCE(t.table_number, 'Counter') AS table_number, pf.settled as platform_fee_settled FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN platform_fees pf ON pf.order_id = o.id
       WHERE o.restaurant_id = ? ORDER BY o.created_at DESC LIMIT 100`
    )
    .all(restaurant.id);

  const orderIds = orders.map((o) => o.id);
  const itemsByOrder = {};
  if (orderIds.length) {
    const placeholders = orderIds.map(() => "?").join(",");
    const rows = db.prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`).all(...orderIds);
    for (const row of rows) {
      itemsByOrder[row.order_id] = itemsByOrder[row.order_id] || [];
      itemsByOrder[row.order_id].push(row);
    }
  }

  return NextResponse.json({
    orders: orders.map((o) => ({
      ...o,
      tax_breakdown: JSON.parse(o.tax_breakdown || "[]"),
      items: itemsByOrder[o.id] || [],
    })),
  });
}

// Bulk delete — either every order for this restaurant ({ all: true }) or a
// specific set the client picked from checkboxes ({ orderNumbers: [...] }).
// Reuses the same cleanup as the single-order DELETE route (order_items,
// platform_fees, consents, reviews) so nothing is left orphaned.
export async function DELETE(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { all, orderNumbers } = body;

  let orders;
  if (all) {
    // "Delete all" only clears scan orders. Bills typed on the Offline Menu are
    // kept so billing history and analytics are never wiped by accident.
    orders = db.prepare("SELECT * FROM orders WHERE restaurant_id = ? AND COALESCE(source, 'qr') != 'offline'").all(restaurant.id);
  } else if (Array.isArray(orderNumbers) && orderNumbers.length) {
    const placeholders = orderNumbers.map(() => "?").join(",");
    orders = db
      .prepare(`SELECT * FROM orders WHERE restaurant_id = ? AND order_number IN (${placeholders})`)
      .all(restaurant.id, ...orderNumbers);
  } else {
    return NextResponse.json({ error: "Nothing selected to delete." }, { status: 400 });
  }

  const tx = db.transaction(() => {
    for (const order of orders) {
      db.prepare("DELETE FROM order_items WHERE order_id = ?").run(order.id);
      db.prepare("DELETE FROM platform_fees WHERE order_id = ?").run(order.id);
      db.prepare("DELETE FROM consents WHERE order_id = ?").run(order.id);
      db.prepare("DELETE FROM reviews WHERE order_id = ?").run(order.id);
      db.prepare("DELETE FROM orders WHERE id = ?").run(order.id);
    }
  });
  tx();

  return NextResponse.json({ ok: true, deletedCount: orders.length });
}
