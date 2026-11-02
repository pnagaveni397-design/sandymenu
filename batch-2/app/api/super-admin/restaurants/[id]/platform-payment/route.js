import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authSuperAdmin } from "@/lib/posAuth";
import { recordPayment, paymentHistory } from "@/lib/platformFees";

// Super Admin: "I received Rs X from this client" (screenshot, cash, anything).
export async function POST(request, { params }) {
  if (!(await authSuperAdmin())) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { id } = await params;
  const { amount, note } = await request.json().catch(() => ({}));
  if (!(Number(amount) > 0)) return NextResponse.json({ error: "Enter the amount you received." }, { status: 400 });
  if (!db.prepare("SELECT id FROM restaurants WHERE id = ?").get(id)) return NextResponse.json({ error: "Client not found." }, { status: 404 });
  const summary = recordPayment(db, id, amount, { note: note || "Received", source: "manual" });
  return NextResponse.json({ ok: true, summary, history: paymentHistory(db, id, 6) });
}
