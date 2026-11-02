import { requireSuperAdmin } from "@/lib/requireSuperAdmin";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const { notes } = await request.json();
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(params.id);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("UPDATE restaurants SET notes = ? WHERE id = ?").run(notes ?? "", params.id);
  return NextResponse.json({ ok: true });
}
