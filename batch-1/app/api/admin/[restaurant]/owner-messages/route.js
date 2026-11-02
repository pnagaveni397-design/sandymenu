import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRestaurant } from "@/lib/posAuth";

export const dynamic = "force-dynamic";

// Messages the owner sent from Super Admin to this shop's app.
export async function GET(request, { params }) {
  const { restaurant: slug } = await params;
  const auth = await authRestaurant(slug);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const messages = db.prepare("SELECT id, text, created_at FROM owner_messages WHERE read = 0 ORDER BY created_at DESC LIMIT 5").all();
  return NextResponse.json({ messages });
}

export async function POST(request, { params }) {
  const { restaurant: slug } = await params;
  const auth = await authRestaurant(slug);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await request.json().catch(() => ({}));
  if (id) db.prepare("UPDATE owner_messages SET read = 1 WHERE id = ?").run(String(id));
  return NextResponse.json({ ok: true });
}
