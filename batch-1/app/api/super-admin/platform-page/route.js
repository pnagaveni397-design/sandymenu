import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/requireSuperAdmin";

export const dynamic = "force-dynamic";

function readPage() {
  const p = db.prepare("SELECT * FROM platform_page WHERE id = 1").get() || {};
  let features = [];
  try {
    const a = JSON.parse(p.about_features || "[]");
    if (Array.isArray(a)) features = a;
  } catch {}
  return { ...p, about_features: features };
}

export async function GET() {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  return NextResponse.json({ page: readPage() });
}

export async function PUT(request) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const b = await request.json().catch(() => ({}));
  const t = (v, n) => String(v ?? "").trim().slice(0, n);
  const features = (Array.isArray(b.about_features) ? b.about_features : [])
    .map((f) => t(f, 120))
    .filter(Boolean)
    .slice(0, 12);

  db.prepare(
    `UPDATE platform_page SET about_title = ?, about_text = ?, about_features = ?, owner_name = ?, owner_phone = ?,
       owner_email = ?, owner_hours = ?, payment_note = ?, updated_at = datetime('now') WHERE id = 1`
  ).run(
    t(b.about_title, 80), t(b.about_text, 1200), JSON.stringify(features), t(b.owner_name, 80),
    t(b.owner_phone, 30), t(b.owner_email, 120), t(b.owner_hours, 120), t(b.payment_note, 500)
  );
  return NextResponse.json({ page: readPage() });
}
