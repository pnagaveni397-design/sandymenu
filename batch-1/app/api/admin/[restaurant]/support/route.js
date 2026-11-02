import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { authRestaurant } from "@/lib/posAuth";

export async function GET(request, { params }) {
  const { restaurant: slug } = await params;
  const auth = await authRestaurant(slug);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const tickets = db.prepare("SELECT * FROM support_tickets WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 100").all(auth.restaurant.id);
  const contact = db.prepare("SELECT phone, email FROM platform_contact WHERE id = 1").get();
  return NextResponse.json({ tickets, contact });
}

export async function POST(request, { params }) {
  const { restaurant: slug } = await params;
  const auth = await authRestaurant(slug);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = await request.json().catch(() => ({}));
  const subject = (b.subject || "").toString().trim().slice(0, 120);
  const message = (b.message || "").toString().trim().slice(0, 2000);
  if (!subject || !message) return NextResponse.json({ error: "Please add a subject and describe the problem." }, { status: 400 });
  const category = ["billing", "printer", "menu", "gst", "account", "other"].includes(b.category) ? b.category : "other";
  const id = newId();
  db.prepare(`INSERT INTO support_tickets (id, restaurant_id, category, subject, message) VALUES (?, ?, ?, ?, ?)`)
    .run(id, auth.restaurant.id, category, subject, message);
  return NextResponse.json({ ticket: db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(id) }, { status: 201 });
}
