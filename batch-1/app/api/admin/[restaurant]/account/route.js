import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRestaurant } from "@/lib/posAuth";

const clip = (v, n) => (v ?? "").toString().trim().slice(0, n);

export async function PATCH(request, { params }) {
  const { restaurant: slug } = await params;
  const auth = await authRestaurant(slug);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const r = auth.restaurant;
  const b = await request.json().catch(() => ({}));

  const name = b.name !== undefined ? clip(b.name, 80) : r.name;
  if (!name) return NextResponse.json({ error: "Restaurant name can't be empty." }, { status: 400 });

  const gst = b.gst_number !== undefined ? clip(b.gst_number, 20).toUpperCase() : r.gst_number;
  // Format check is a gentle guard against typos, not a legal verification:
  // 2 digits state code + 10-char PAN + entity digit + Z + checksum.
  if (gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gst)) {
    return NextResponse.json({ error: "That GSTIN doesn't look right. It has 15 characters, e.g. 29ABCDE1234F1Z5." }, { status: 400 });
  }

  db.prepare(
    `UPDATE restaurants SET name = ?, address = ?, phone = ?, gst_number = ?, fssai_number = ?,
       receipt_footer = ?, logo_image_url = ?, tagline = ? WHERE id = ?`
  ).run(
    name,
    b.address !== undefined ? clip(b.address, 200) : r.address,
    b.phone !== undefined ? clip(b.phone, 30) : r.phone,
    gst || "",
    b.fssai_number !== undefined ? clip(b.fssai_number, 20) : r.fssai_number,
    b.receipt_footer !== undefined ? clip(b.receipt_footer, 120) : r.receipt_footer,
    b.logo_image_url !== undefined ? clip(b.logo_image_url, 300) : r.logo_image_url,
    b.tagline !== undefined ? clip(b.tagline, 120) : r.tagline,
    r.id
  );
  return NextResponse.json({ restaurant: db.prepare("SELECT * FROM restaurants WHERE id = ?").get(r.id) });
}
