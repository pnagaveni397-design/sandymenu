import { requireSuperAdmin } from "@/lib/requireSuperAdmin";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const contact = db.prepare("SELECT * FROM platform_contact WHERE id = 1").get();
  return NextResponse.json({ contact });
}

export async function POST(request) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const { phone, phonepe_qr_image_url, email } = await request.json();
  db.prepare(
    `UPDATE platform_contact SET phone = ?, phonepe_qr_image_url = ?, email = ?, updated_at = datetime('now') WHERE id = 1`
  ).run(phone || "", phonepe_qr_image_url || "", (email || "").toString().trim().slice(0, 120));
  const contact = db.prepare("SELECT * FROM platform_contact WHERE id = 1").get();
  return NextResponse.json({ contact });
}
