import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authSuperAdmin } from "@/lib/posAuth";

export async function GET() {
  if (!(await authSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tickets = db.prepare(
    `SELECT s.*, r.name AS restaurant_name, r.slug AS restaurant_slug, r.phone AS restaurant_phone,
            r.gst_number AS restaurant_gst, r.address AS restaurant_address,
            (SELECT u.email FROM restaurant_users ru JOIN users u ON u.id = ru.user_id
             WHERE ru.restaurant_id = r.id LIMIT 1) AS restaurant_email
     FROM support_tickets s JOIN restaurants r ON r.id = s.restaurant_id
     ORDER BY CASE s.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, s.created_at DESC LIMIT 300`
  ).all();
  return NextResponse.json({ tickets });
}
