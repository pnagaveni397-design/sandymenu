import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncStatuses } from "@/lib/subscriptionStatus";

export async function GET(request, { params }) {
  const { restaurant: slug } = params;
  syncStatuses(db);

  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (restaurant.status === "suspended") {
    return NextResponse.json(
      { error: "suspended", message: "This restaurant's menu is temporarily unavailable." },
      { status: 403 }
    );
  }

  const categories = db
    .prepare("SELECT * FROM categories WHERE restaurant_id = ? AND active = 1 ORDER BY sort_order")
    .all(restaurant.id);

  const items = db
    .prepare("SELECT * FROM menu_items WHERE restaurant_id = ? AND available = 1 ORDER BY sort_order, created_at")
    .all(restaurant.id)
    .map((it) => ({ ...it, tags: JSON.parse(it.tags || "[]") }));

  const offers = db
    .prepare("SELECT * FROM offers WHERE restaurant_id = ? AND active = 1")
    .all(restaurant.id);

  const paymentSettings = db
    .prepare("SELECT * FROM restaurant_payment_settings WHERE restaurant_id = ?")
    .get(restaurant.id);

  const taxes = db
    .prepare("SELECT * FROM restaurant_taxes WHERE restaurant_id = ? AND active = 1")
    .all(restaurant.id);

  return NextResponse.json({
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      logo_emoji: restaurant.logo_emoji,
      tagline: restaurant.tagline,
      instagram_url: restaurant.instagram_url,
      google_review_url: restaurant.google_review_url,
      offer_success_message: restaurant.offer_success_message,
      currency: restaurant.currency,
      welcome_animation_enabled: !!restaurant.welcome_animation_enabled,
      welcome_sound_enabled: !!restaurant.welcome_sound_enabled,
    },
    categories,
    items,
    offers,
    taxes,
    payment: {
      cash_enabled: !!paymentSettings?.cash_enabled,
      online_enabled: !!paymentSettings?.online_enabled,
      phonepe_qr_image_url: paymentSettings?.phonepe_qr_image_url || null,
      upi_id: paymentSettings?.upi_id || null,
    },
  });
}
