import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseJsonArray } from "@/lib/templates";

// The restaurant can correct what's shown for a submission (name, phone,
// feedback text, and the per-scene captions) -- nothing about it is locked.
export async function PATCH(request, { params }) {
  const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(params.id);
  if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json();

  const customer_name = body.customer_name !== undefined ? String(body.customer_name).trim().slice(0, 60) : review.customer_name;
  const customer_phone = body.customer_phone !== undefined ? String(body.customer_phone).trim().slice(0, 20) : review.customer_phone;
  const text_feedback = body.text_feedback !== undefined ? String(body.text_feedback).slice(0, 1000) : review.text_feedback;

  let scenes = review.scenes;
  if (Array.isArray(body.scenes)) {
    // Only captions are editable here; the clips themselves stay as uploaded.
    const existing = parseJsonArray(review.scenes);
    scenes = JSON.stringify(
      existing.map((s, i) => ({ ...s, caption: body.scenes[i]?.caption !== undefined ? String(body.scenes[i].caption).slice(0, 140) : s.caption }))
    );
  }

  db.prepare("UPDATE reviews SET customer_name = ?, customer_phone = ?, text_feedback = ?, scenes = ? WHERE id = ?")
    .run(customer_name, customer_phone, text_feedback, scenes, review.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(params.id);
  if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("DELETE FROM consents WHERE order_id = ? AND campaign_id = ?").run(review.order_id, review.campaign_id);
  db.prepare("DELETE FROM reviews WHERE id = ?").run(review.id);

  return NextResponse.json({ ok: true });
}
