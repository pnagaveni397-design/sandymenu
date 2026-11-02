import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const EDITABLE_FIELDS = [
  "category_id", "name", "description", "price", "discounted_price",
  "image_emoji", "image_url", "is_veg", "spice_level", "prep_time_minutes",
  "available", "is_popular", "is_recommended", "is_new_pick", "sort_order",
];
const JSON_FIELDS = ["tags", "ingredients", "allergens"];
const BOOL_FIELDS = ["is_veg", "available", "is_popular", "is_recommended", "is_new_pick"];

export async function PATCH(request, { params }) {
  const body = await request.json();
  const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(params.id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fields = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) fields[key] = BOOL_FIELDS.includes(key) ? (body[key] ? 1 : 0) : body[key];
  }
  for (const key of JSON_FIELDS) {
    if (key in body) fields[key] = JSON.stringify(body[key] || []);
  }

  const keys = Object.keys(fields);
  if (keys.length === 0) return NextResponse.json({ error: "No changes" }, { status: 400 });

  db.prepare(`UPDATE menu_items SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).run(
    ...keys.map((k) => fields[k]),
    params.id
  );

  const updated = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(params.id);
  return NextResponse.json({ item: { ...updated, tags: JSON.parse(updated.tags || "[]") } });
}

export async function DELETE(request, { params }) {
  const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(params.id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  db.prepare("DELETE FROM menu_item_addons WHERE menu_item_id = ?").run(item.id);
  db.prepare("DELETE FROM menu_items WHERE id = ?").run(item.id);
  return NextResponse.json({ ok: true });
}
