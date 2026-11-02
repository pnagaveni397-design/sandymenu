import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const body = await request.json();
  const offer = db.prepare("SELECT * FROM offers WHERE id = ?").get(params.id);
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fields = ["title", "description", "discount_type", "discount_value", "min_order_value", "active"];
  const updates = {};
  for (const f of fields) {
    if (f in body) updates[f] = f === "active" ? (body[f] ? 1 : 0) : body[f];
  }
  const keys = Object.keys(updates);
  if (keys.length === 0) return NextResponse.json({ error: "No changes" }, { status: 400 });

  db.prepare(`UPDATE offers SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).run(
    ...keys.map((k) => updates[k]),
    offer.id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  db.prepare("DELETE FROM offers WHERE id = ?").run(params.id);
  return NextResponse.json({ ok: true });
}
