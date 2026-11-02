import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { saveDataUrl } from "@/lib/uploads";

export async function GET(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const proofs = db
    .prepare("SELECT * FROM payment_proofs WHERE restaurant_id = ? ORDER BY created_at DESC")
    .all(restaurant.id);
  return NextResponse.json({ proofs });
}

export async function POST(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { imageDataUrl, amountClaimed, note, type } = await request.json();
  if (!imageDataUrl) {
    return NextResponse.json({ error: "Please attach a screenshot of your payment." }, { status: 400 });
  }
  const proofType = type === "platform_fee" ? "platform_fee" : "subscription";

  let imageUrl;
  try {
    imageUrl = saveDataUrl(imageDataUrl);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const id = newId();
  db.prepare(
    `INSERT INTO payment_proofs (id, restaurant_id, image_url, amount_claimed, note, status, type)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`
  ).run(id, restaurant.id, imageUrl, amountClaimed ? Number(amountClaimed) : null, note || "", proofType);

  const proof = db.prepare("SELECT * FROM payment_proofs WHERE id = ?").get(id);
  return NextResponse.json({ proof }, { status: 201 });
}
