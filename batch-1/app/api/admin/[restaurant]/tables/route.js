import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function GET(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tables = db.prepare("SELECT * FROM tables WHERE restaurant_id = ?").all(restaurant.id);
  return NextResponse.json({ tables });
}

export async function POST(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { table_number, table_name } = await request.json();
  if (!table_number) return NextResponse.json({ error: "table_number is required" }, { status: 400 });

  const existing = db
    .prepare("SELECT * FROM tables WHERE restaurant_id = ? AND table_number = ?")
    .get(restaurant.id, table_number);
  if (existing) return NextResponse.json({ error: "Table already exists" }, { status: 409 });

  const id = newId();
  db.prepare(
    `INSERT INTO tables (id, restaurant_id, table_number, table_name, active) VALUES (?, ?, ?, ?, 1)`
  ).run(id, restaurant.id, String(table_number), table_name || `Table ${table_number}`);

  const table = db.prepare("SELECT * FROM tables WHERE id = ?").get(id);
  return NextResponse.json({ table }, { status: 201 });
}
