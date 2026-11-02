import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authSuperAdmin } from "@/lib/posAuth";

export async function PATCH(request, { params }) {
  if (!(await authSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const t = db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const status = ["open", "in_progress", "resolved"].includes(b.status) ? b.status : t.status;
  const reply = b.admin_reply !== undefined ? b.admin_reply.toString().slice(0, 2000) : t.admin_reply;
  const repliedAt = b.admin_reply !== undefined && reply !== t.admin_reply ? new Date().toISOString().slice(0, 19).replace("T", " ") : t.replied_at;
  db.prepare(`UPDATE support_tickets SET status = ?, admin_reply = ?, replied_at = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, reply, repliedAt, id);
  return NextResponse.json({ ticket: db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(id) });
}
