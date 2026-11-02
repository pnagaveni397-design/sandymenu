import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { cleanSubmissionScenes, mediaUrl as cleanMediaUrl } from "@/lib/templates";

// Called once the customer's food has actually been served. This is where
// the bill is decided: an optional offer or campaign discount, then tax
// and the platform fee, then a payment method. Everything money-related
// is recomputed here from trusted server data -- never from numbers the
// client sends -- exactly like the old all-in-one order-creation route
// used to do, just moved to this later moment in the order's life.
export async function POST(request, { params }) {
  const body = await request.json();
  const { offerId, campaignParticipations, paymentMethod, sessionId } = body;

  const order = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(params.orderNumber);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.status !== "served" && order.status !== "completed") {
    return NextResponse.json(
      { error: "The bill isn't ready yet -- please wait until your food has been served." },
      { status: 409 }
    );
  }
  if (order.payment_method) {
    return NextResponse.json({ error: "This order's bill has already been finalized." }, { status: 409 });
  }
  if (!["cash", "online_upi"].includes(paymentMethod)) {
    return NextResponse.json({ error: "Please choose a valid payment method." }, { status: 400 });
  }

  const restaurantId = order.restaurant_id;
  const subtotal = order.subtotal;
  const roundMoney = (n) => Math.round(n);

  // Discount: either a validated offer, OR one or more validated campaigns
  // whose own discounts (each computed the way the restaurant configured
  // that campaign) are added together and capped at the subtotal -- never
  // an offer combined with a campaign.
  let discount = 0;
  const validatedCampaigns = []; // [{campaign, feedback}]
  if (Array.isArray(campaignParticipations) && campaignParticipations.length > 0) {
    for (const p of campaignParticipations) {
      const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND restaurant_id = ? AND active = 1").get(p.campaignId, restaurantId);
      if (!campaign) {
        return NextResponse.json({ error: "One of these campaigns is no longer available." }, { status: 404 });
      }
      const feedback = p.feedback || {};
      if (!feedback.agreedToSubmitContent) {
        return NextResponse.json({ error: `You must agree to the terms for "${campaign.title}" to apply that discount.` }, { status: 400 });
      }
      if (campaign.requires_video && !cleanMediaUrl(feedback.mediaUrl)) {
        return NextResponse.json({
          error: campaign.media_type === "audio" ? `"${campaign.title}" requires a voice note to be submitted.` : `"${campaign.title}" requires a video to be submitted.`,
        }, { status: 400 });
      }
      if (!feedback.customerName?.trim()) {
        return NextResponse.json({ error: `Please enter your name to submit "${campaign.title}".` }, { status: 400 });
      }
      validatedCampaigns.push({ campaign, feedback });
      discount += campaign.discount_type === "percent" ? (subtotal * campaign.discount_value) / 100 : campaign.discount_value;
    }
    discount = Math.min(discount, subtotal);
  } else if (offerId) {
    const offer = db.prepare("SELECT * FROM offers WHERE id = ? AND restaurant_id = ? AND active = 1").get(offerId, restaurantId);
    if (offer && subtotal >= offer.min_order_value) {
      discount = offer.discount_type === "percent" ? (subtotal * offer.discount_value) / 100 : offer.discount_value;
    }
  }
  discount = roundMoney(discount);

  const activeTaxes = db.prepare("SELECT * FROM restaurant_taxes WHERE restaurant_id = ? AND active = 1").all(restaurantId);
  const taxable = Math.max(subtotal - discount, 0);
  const taxBreakdown = activeTaxes.map((t) => ({
    name: t.name,
    type: t.type || "percent",
    percent: t.percent,
    amount: roundMoney(t.type === "fixed" ? t.percent : (taxable * t.percent) / 100),
  }));
  const tax = taxBreakdown.reduce((s, t) => s + t.amount, 0);

  const subscription = db.prepare("SELECT * FROM subscriptions WHERE restaurant_id = ?").get(restaurantId);
  const globalSettings = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  const platformFeeEnabled = subscription ? subscription.platform_fee_enabled !== 0 : true;
  const platformFee = roundMoney(platformFeeEnabled ? (subscription?.order_fee_override ?? (globalSettings?.order_fee ?? 2)) : 0);

  const total = roundMoney(taxable + tax + platformFee);
  const paymentStatus = "unpaid"; // customer confirms "I've paid" themselves afterward (see /api/orders/[orderNumber] PATCH), which is what actually moves an online order to pending_confirmation

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE orders SET discount_amount = ?, tax_amount = ?, tax_breakdown = ?, platform_fee = ?,
        total = ?, payment_method = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(discount, tax, JSON.stringify(taxBreakdown), platformFee, total, paymentMethod, paymentStatus, order.id);

    if (platformFeeEnabled && platformFee > 0) {
      db.prepare(
        `INSERT INTO platform_fees (id, restaurant_id, order_id, fee_amount) VALUES (?, ?, ?, ?)`
      ).run(newId(), restaurantId, order.id, platformFee);
    }

    for (const { campaign, feedback } of validatedCampaigns) {
      db.prepare(
        `INSERT INTO consents
          (id, campaign_id, order_id, session_id, terms_version, agreed_to_submit_content, agreed_to_instagram_use)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newId(), campaign.id, order.id, sessionId || null, campaign.terms_version,
        feedback.agreedToSubmitContent ? 1 : 0, feedback.agreedToInstagramUse ? 1 : 0
      );
      db.prepare(
        `INSERT INTO reviews (id, restaurant_id, order_id, campaign_id, rating, text_feedback, video_url, discount_code, customer_name, customer_phone, template_name, scenes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newId(), restaurantId, order.id, campaign.id, feedback.rating || null,
        feedback.textFeedback || "", cleanMediaUrl(feedback.mediaUrl),
        `TS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        (feedback.customerName || "").trim().slice(0, 60),
        (feedback.customerPhone || "").trim().slice(0, 20),
        (feedback.templateName || "").toString().slice(0, 80),
        JSON.stringify(cleanSubmissionScenes(feedback.scenes))
      );
    }
  });
  tx();

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(order.id);
  const orderItems = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);
  const table = db.prepare("SELECT * FROM tables WHERE id = ?").get(updated.table_id);
  const fullOrder = { ...updated, table_number: table?.table_number, tax_breakdown: JSON.parse(updated.tax_breakdown || "[]"), items: orderItems };

  return NextResponse.json({ order: fullOrder });
}
