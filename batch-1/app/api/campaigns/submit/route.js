import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function POST(request) {
  const {
    campaignId, orderId, sessionId, rating, textFeedback,
    videoUrl, agreedToSubmitContent, agreedToInstagramUse,
  } = await request.json();

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND active = 1").get(campaignId);
  if (!campaign) return NextResponse.json({ error: "This campaign is no longer available." }, { status: 404 });

  if (!agreedToSubmitContent) {
    return NextResponse.json({ error: "You must agree to the campaign terms to participate." }, { status: 400 });
  }
  if (campaign.requires_video && !videoUrl) {
    return NextResponse.json({ error: "This campaign requires a video to be submitted." }, { status: 400 });
  }
  if (campaign.allow_instagram_repost && agreedToInstagramUse === undefined) {
    return NextResponse.json({ error: "Please indicate whether Instagram reuse is okay." }, { status: 400 });
  }

  const discountCode = `TS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO consents
        (id, campaign_id, order_id, session_id, terms_version, agreed_to_submit_content, agreed_to_instagram_use)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newId(), campaignId, orderId || null, sessionId || null, campaign.terms_version,
      agreedToSubmitContent ? 1 : 0, agreedToInstagramUse ? 1 : 0
    );

    db.prepare(
      `INSERT INTO reviews (id, restaurant_id, order_id, campaign_id, rating, text_feedback, video_url, discount_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(newId(), campaign.restaurant_id, orderId || null, campaignId, rating || null, textFeedback || "", videoUrl || "", discountCode);
  });
  tx();

  return NextResponse.json({
    message: "Thank you! Show this code to staff for your discount on your next visit.",
    discountCode,
    discountType: campaign.discount_type,
    discountValue: campaign.discount_value,
  });
}
