import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const logo_image_url = body.logo_image_url !== undefined ? body.logo_image_url : restaurant.logo_image_url;
  const cover_image_url = body.cover_image_url !== undefined ? body.cover_image_url : restaurant.cover_image_url;
  const tagline = body.tagline !== undefined ? body.tagline : restaurant.tagline;
  const instagram_url = body.instagram_url !== undefined ? body.instagram_url : restaurant.instagram_url;
  const google_review_url = body.google_review_url !== undefined ? body.google_review_url : restaurant.google_review_url;
  const offer_success_message = body.offer_success_message !== undefined ? body.offer_success_message : restaurant.offer_success_message;
  const banner_messages = body.banner_messages !== undefined
    ? JSON.stringify(body.banner_messages)
    : restaurant.banner_messages;

  db.prepare(`UPDATE restaurants SET logo_image_url = ?, cover_image_url = ?, tagline = ?, instagram_url = ?, google_review_url = ?, offer_success_message = ?, banner_messages = ? WHERE id = ?`).run(
    logo_image_url || "",
    cover_image_url || "",
    tagline || "",
    instagram_url || "",
    google_review_url || "",
    offer_success_message || "",
    banner_messages || "[]",
    restaurant.id
  );

  const updated = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(restaurant.id);
  return NextResponse.json({ restaurant: updated });
}
