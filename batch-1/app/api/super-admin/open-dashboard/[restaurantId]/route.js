import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authSuperAdmin } from "@/lib/posAuth";
import { createSession, SESSION_COOKIE } from "@/lib/auth";

// Super admin only. Signs you in as that restaurant's owner and opens their
// dashboard, exactly as the client sees it.
export async function GET(request, { params }) {
  const { restaurantId } = await params;
  const origin = request.nextUrl.origin;
  if (!(await authSuperAdmin())) return NextResponse.redirect(new URL("/super-admin/login", origin));

  const r = db.prepare("SELECT * FROM restaurants WHERE id = ? OR slug = ?").get(restaurantId, restaurantId);
  if (!r) return NextResponse.redirect(new URL("/super-admin?missing=1", origin));

  const owner =
    db.prepare(`SELECT user_id FROM restaurant_users WHERE restaurant_id = ? AND role = 'owner' LIMIT 1`).get(r.id) ||
    db.prepare(`SELECT user_id FROM restaurant_users WHERE restaurant_id = ? LIMIT 1`).get(r.id);
  if (!owner) return NextResponse.redirect(new URL("/super-admin?missing=1", origin));

  const { token, expires } = createSession(owner.user_id);
  const res = NextResponse.redirect(new URL(`/dashboard/${r.slug}`, origin));
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: new Date(expires) });
  return res;
}
