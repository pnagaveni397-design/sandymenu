import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const body = await request.json();
  const table = db.prepare("SELECT * FROM tables WHERE id = ?").get(params.tableId);
  if (!table) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const active = "active" in body ? (body.active ? 1 : 0) : table.active;
  db.prepare("UPDATE tables SET active = ? WHERE id = ?").run(active, table.id);

  return NextResponse.json({ table: { ...table, active } });
}
