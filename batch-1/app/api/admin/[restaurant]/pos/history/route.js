import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRestaurant } from "@/lib/posAuth";

// Billing history: every finished bill (offline and QR), newest first.
// Optional ?date=YYYY-MM-DD&offset=<minutes from UTC> narrows to one day.
export async function GET(request, { params }) {
  const { restaurant: slug } = await params;
  const auth = await authRestaurant(slug);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { restaurant } = auth;

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;

  let where = "o.restaurant_id = ? AND o.payment_method IS NOT NULL";
  const args = [restaurant.id];
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    where += " AND date(datetime(o.created_at, ? || ' minutes')) = ?";
    args.push(String(offset), date);
  }
  const orders = db.prepare(
    `SELECT o.*, COALESCE(t.table_number, '') AS table_number FROM orders o
     LEFT JOIN tables t ON t.id = o.table_id WHERE ${where} ORDER BY o.created_at DESC LIMIT 300`
  ).all(...args);

  const ids = orders.map((o) => o.id);
  const byOrder = {};
  if (ids.length) {
    const rows = db.prepare(`SELECT * FROM order_items WHERE order_id IN (${ids.map(() => "?").join(",")})`).all(...ids);
    for (const r of rows) (byOrder[r.order_id] ||= []).push(r);
  }
  return NextResponse.json({
    orders: orders.map((o) => ({ ...o, tax_breakdown: JSON.parse(o.tax_breakdown || "[]"), items: byOrder[o.id] || [] })),
  });
}
