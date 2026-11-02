import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRestaurant } from "@/lib/posAuth";

// Revenue analytics. "Revenue" = the total of bills that are PAID
// (offline and QR orders alike). Everything is bucketed in the viewer's
// local time using ?offset=<minutes east of UTC> (India = 330), so
// "today" means the restaurant's today, not UTC's.
const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
const sqlStr = (d) => d.toISOString().slice(0, 19).replace("T", " ");

export async function GET(request, { params }) {
  const { restaurant: slug } = await params;
  const auth = await authRestaurant(slug);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const rid = auth.restaurant.id;

  const url = new URL(request.url);
  const range = ["today", "week", "month", "3m", "year"].includes(url.searchParams.get("range")) ? url.searchParams.get("range") : "week";
  const off = parseInt(url.searchParams.get("offset") || "0", 10) || 0;

  // "Local" dates are stored in UTC fields of a shifted Date.
  const nowL = new Date(Date.now() + off * 60000);
  const today0 = new Date(Date.UTC(nowL.getUTCFullYear(), nowL.getUTCMonth(), nowL.getUTCDate()));
  const monthStart = (y, m) => new Date(Date.UTC(y, m, 1));
  let start, end, prevStart, prevEnd, kind;

  if (range === "today") {
    start = today0; end = new Date(+today0 + DAY); prevStart = new Date(+today0 - DAY); prevEnd = today0; kind = "hour";
  } else if (range === "week") {
    start = new Date(+today0 - 6 * DAY); end = new Date(+today0 + DAY);
    prevStart = new Date(+start - 7 * DAY); prevEnd = start; kind = "day";
  } else if (range === "month") {
    const y = nowL.getUTCFullYear(), m = nowL.getUTCMonth();
    start = monthStart(y, m); end = monthStart(y, m + 1);
    prevStart = monthStart(y, m - 1); prevEnd = start; kind = "day";
  } else if (range === "3m") {
    const y = nowL.getUTCFullYear(), m = nowL.getUTCMonth();
    start = monthStart(y, m - 2); end = monthStart(y, m + 1);
    prevStart = monthStart(y, m - 5); prevEnd = start; kind = "week";
  } else {
    const y = nowL.getUTCFullYear(), m = nowL.getUTCMonth();
    start = monthStart(y, m - 11); end = monthStart(y, m + 1);
    prevStart = monthStart(y, m - 23); prevEnd = start; kind = "month";
  }
  const toUtc = (d) => sqlStr(new Date(+d - off * 60000));

  const rowsFor = (a, b) => db.prepare(
    `SELECT id, datetime(created_at, ? || ' minutes') AS lt, total, subtotal, discount_amount, tax_amount, payment_method
     FROM orders WHERE restaurant_id = ? AND payment_status = 'paid' AND created_at >= ? AND created_at < ?`
  ).all(String(off), rid, toUtc(a), toUtc(b));

  const rows = rowsFor(start, end);
  const prevRows = rowsFor(prevStart, prevEnd);
  const parse = (s) => new Date(s.replace(" ", "T") + "Z");

  // Build the empty buckets, then fill them.
  const buckets = [];
  const keyOf = { hour: (d) => d.getUTCHours(), day: (d) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - +start) / DAY),
    week: (d) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - +weekStart(start)) / (7 * DAY)),
    month: (d) => (d.getUTCFullYear() - start.getUTCFullYear()) * 12 + d.getUTCMonth() - start.getUTCMonth() };
  function weekStart(d) { const w = (d.getUTCDay() + 6) % 7; return new Date(+d - w * DAY); } // Monday

  if (kind === "hour") {
    for (let h = 0; h < 24; h++) buckets.push({ label: h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`, revenue: 0, orders: 0 });
  } else if (kind === "day") {
    for (let d = new Date(start); d < end; d = new Date(+d + DAY)) {
      buckets.push({ label: range === "month" ? String(d.getUTCDate()) : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, revenue: 0, orders: 0 });
    }
  } else if (kind === "week") {
    for (let d = weekStart(start); d < end; d = new Date(+d + 7 * DAY)) {
      buckets.push({ label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, revenue: 0, orders: 0 });
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const d = monthStart(start.getUTCFullYear(), start.getUTCMonth() + i);
      buckets.push({ label: MONTHS[d.getUTCMonth()], revenue: 0, orders: 0 });
    }
  }

  const sum = (list) => ({
    revenue: list.reduce((s, r) => s + r.total, 0),
    orders: list.length,
    tax: list.reduce((s, r) => s + (r.tax_amount || 0), 0),
    discount: list.reduce((s, r) => s + (r.discount_amount || 0), 0),
    cash: list.filter((r) => r.payment_method === "cash").reduce((s, r) => s + r.total, 0),
    online: list.filter((r) => r.payment_method === "online_upi").reduce((s, r) => s + r.total, 0),
  });

  const hours = new Array(24).fill(0);
  for (const r of rows) {
    const d = parse(r.lt);
    const b = buckets[keyOf[kind](d)];
    if (b) { b.revenue += r.total; b.orders += 1; }
    hours[d.getUTCHours()] += 1;
  }

  const ids = rows.map((r) => r.id);
  let topItems = [], categories = [];
  if (ids.length) {
    const ph = ids.map(() => "?").join(",");
    topItems = db.prepare(
      `SELECT name, SUM(quantity) AS qty, SUM(quantity * unit_price) AS amount FROM order_items
       WHERE order_id IN (${ph}) GROUP BY name ORDER BY qty DESC, amount DESC LIMIT 8`
    ).all(...ids);
    categories = db.prepare(
      `SELECT COALESCE(c.name, 'Other') AS name, SUM(oi.quantity * oi.unit_price) AS amount
       FROM order_items oi LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN categories c ON c.id = mi.category_id
       WHERE oi.order_id IN (${ph}) GROUP BY COALESCE(c.name, 'Other') ORDER BY amount DESC LIMIT 8`
    ).all(...ids);
  }

  const cur = sum(rows), prev = sum(prevRows);
  const peak = hours.indexOf(Math.max(...hours));
  return NextResponse.json({
    range,
    from: start.toISOString().slice(0, 10),
    to: new Date(+end - DAY).toISOString().slice(0, 10),
    kpis: { ...cur, avg: cur.orders ? cur.revenue / cur.orders : 0, prevRevenue: prev.revenue, prevOrders: prev.orders },
    buckets: buckets.map((b) => ({ ...b, revenue: Math.round(b.revenue) })),
    topItems, categories,
    peakHour: rows.length ? peak : null,
  });
}
