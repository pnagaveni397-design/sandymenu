import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const body = await request.json();
  const tax = db.prepare("SELECT * FROM restaurant_taxes WHERE id = ?").get(params.id);
  if (!tax) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const name = body.name ?? tax.name;
  const percent = body.percent === undefined ? tax.percent : Number(body.percent);
  const type = body.type === undefined ? tax.type : (body.type === "fixed" ? "fixed" : "percent");
  const active = body.active === undefined ? tax.active : (body.active ? 1 : 0);

  db.prepare("UPDATE restaurant_taxes SET name = ?, percent = ?, type = ?, active = ? WHERE id = ?").run(name, percent, type, active, tax.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  db.prepare("DELETE FROM restaurant_taxes WHERE id = ?").run(params.id);
  return NextResponse.json({ ok: true });
}
