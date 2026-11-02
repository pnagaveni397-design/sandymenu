// Small guards for the new billing/support API routes. The older admin
// routes trust the URL slug; these new ones also check the logged-in
// session so one restaurant can never read or bill another's data.
import { cookies } from "next/headers";
import { db } from "./db";
import { getUserByToken, userHasAccessToRestaurant, SESSION_COOKIE } from "./auth";
import { isValidSuperAdminSession, SUPER_ADMIN_COOKIE } from "./superAdminAuth";

export async function authRestaurant(slug) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(slug);
  if (!restaurant) return { error: "Restaurant not found", status: 404 };
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = getUserByToken(token);
  if (!user || !userHasAccessToRestaurant(user.id, restaurant.id)) {
    return { error: "Please log in again.", status: 401 };
  }
  return { restaurant, user };
}

export async function authSuperAdmin() {
  const token = (await cookies()).get(SUPER_ADMIN_COOKIE)?.value;
  return isValidSuperAdminSession(token);
}

// Same tax rules the QR checkout uses (lib is shared by nothing else, so
// this stays here): percent taxes apply to (subtotal - discount), fixed
// taxes are flat rupee amounts.
export function computeBill(subtotal, discount, taxes) {
  const round = (n) => Math.round(n);
  const disc = Math.min(Math.max(round(discount || 0), 0), subtotal);
  const taxable = Math.max(subtotal - disc, 0);
  const breakdown = (taxes || [])
    .filter((t) => t.active !== 0)
    .map((t) => ({
      name: t.name,
      type: t.type || "percent",
      percent: t.percent,
      amount: round(t.type === "fixed" ? t.percent : (taxable * t.percent) / 100),
    }));
  const tax = breakdown.reduce((s, t) => s + t.amount, 0);
  return { discount: disc, breakdown, tax, total: round(taxable + tax) };
}

export function fullOrder(orderId) {
  const o = db.prepare(
    `SELECT o.*, COALESCE(t.table_number, '') AS table_number FROM orders o
     LEFT JOIN tables t ON t.id = o.table_id WHERE o.id = ?`
  ).get(orderId);
  if (!o) return null;
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderId);
  return { ...o, tax_breakdown: JSON.parse(o.tax_breakdown || "[]"), items };
}
