import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function GET(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const taxes = db.prepare("SELECT * FROM restaurant_taxes WHERE restaurant_id = ?").all(restaurant.id);
  return NextResponse.json({ taxes });
}

export async function POST(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, percent, type } = await request.json();
  if (!name?.trim() || percent === undefined || percent === null) {
    return NextResponse.json({ error: "Tax name and amount are required." }, { status: 400 });
  }
  const taxType = type === "fixed" ? "fixed" : "percent";

  const id = newId();
  db.prepare(
    `INSERT INTO restaurant_taxes (id, restaurant_id, name, percent, type, active) VALUES (?, ?, ?, ?, ?, 1)`
  ).run(id, restaurant.id, name.trim(), Number(percent), taxType);

  const tax = db.prepare("SELECT * FROM restaurant_taxes WHERE id = ?").get(id);
  return NextResponse.json({ tax }, { status: 201 });
}
