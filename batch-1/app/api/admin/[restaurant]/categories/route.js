import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function POST(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Category name is required" }, { status: 400 });

  const maxSort = db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) as m FROM categories WHERE restaurant_id = ?")
    .get(restaurant.id).m;

  const id = newId();
  db.prepare(
    `INSERT INTO categories (id, restaurant_id, name, sort_order, active) VALUES (?, ?, ?, ?, 1)`
  ).run(id, restaurant.id, name.trim(), maxSort + 1);

  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  return NextResponse.json({ category }, { status: 201 });
}
