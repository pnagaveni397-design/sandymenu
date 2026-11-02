import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { upi_id, phonepe_qr_image_url, online_enabled } = await request.json();

  const existing = db
    .prepare("SELECT * FROM restaurant_payment_settings WHERE restaurant_id = ?")
    .get(restaurant.id);

  // online_enabled controls only whether the customer sees "Pay online
  // (UPI)" as a choice on their phone at checkout. The receipt the staff
  // prints/views always shows the QR regardless of this setting.
  const onlineEnabled = online_enabled === undefined ? (existing ? existing.online_enabled : 1) : online_enabled ? 1 : 0;

  if (existing) {
    db.prepare(
      `UPDATE restaurant_payment_settings SET upi_id = ?, phonepe_qr_image_url = ?, online_enabled = ? WHERE restaurant_id = ?`
    ).run(upi_id || "", phonepe_qr_image_url || "", onlineEnabled, restaurant.id);
  } else {
    db.prepare(
      `INSERT INTO restaurant_payment_settings (restaurant_id, upi_id, phonepe_qr_image_url, cash_enabled, online_enabled)
       VALUES (?, ?, ?, 1, ?)`
    ).run(restaurant.id, upi_id || "", phonepe_qr_image_url || "", onlineEnabled);
  }

  const updated = db.prepare("SELECT * FROM restaurant_payment_settings WHERE restaurant_id = ?").get(restaurant.id);
  return NextResponse.json({ ok: true, paymentSettings: updated });
}
