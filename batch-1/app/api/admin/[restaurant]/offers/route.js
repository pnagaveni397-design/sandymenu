import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function POST(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { title, description = "", discount_type = "percent", discount_value, min_order_value = 0 } = await request.json();
  if (!title?.trim() || discount_value === undefined) {
    return NextResponse.json({ error: "Title and discount value are required." }, { status: 400 });
  }

  const id = newId();
  db.prepare(
    `INSERT INTO offers (id, restaurant_id, title, description, discount_type, discount_value, min_order_value, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(id, restaurant.id, title.trim(), description, discount_type, Number(discount_value), Number(min_order_value) || 0);

  const offer = db.prepare("SELECT * FROM offers WHERE id = ?").get(id);
  return NextResponse.json({ offer }, { status: 201 });
}
