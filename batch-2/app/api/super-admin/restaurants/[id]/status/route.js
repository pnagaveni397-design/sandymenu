import { requireSuperAdmin } from "@/lib/requireSuperAdmin";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const { status } = await request.json();
  const allowed = ["active", "grace_period", "suspended", "trial"];
  if (!allowed.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  db.prepare("UPDATE restaurants SET status = ? WHERE id = ?").run(status, params.id);
  return NextResponse.json({ ok: true });
}
