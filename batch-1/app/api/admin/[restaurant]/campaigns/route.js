import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { cleanTemplates, parseJsonArray } from "@/lib/templates";

export async function POST(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const {
    title, description = "", discount_type = "percent", discount_value,
    requires_video = 1, allow_instagram_repost = 0, terms_text = "",
    media_type = "video", template_videos = [], templates = [],
  } = await request.json();

  if (!title?.trim() || discount_value === undefined) {
    return NextResponse.json({ error: "Title and discount value are required." }, { status: 400 });
  }

  const resolvedMediaType = media_type === "audio" ? "audio" : "video";
  const id = newId();
  // Restaurants can run one active video campaign AND one active audio
  // campaign at the same time (a customer can complete both and stack the
  // discounts) -- but not two of the *same* media type, since the customer
  // menu shows one card per type. So a new campaign only pauses existing
  // campaigns that share its media_type, not every campaign.
  const createCampaign = db.transaction(() => {
    db.prepare("UPDATE campaigns SET active = 0 WHERE restaurant_id = ? AND media_type = ?").run(restaurant.id, resolvedMediaType);
    db.prepare(
      `INSERT INTO campaigns
        (id, restaurant_id, title, description, discount_type, discount_value,
         requires_video, allow_instagram_repost, terms_text, terms_version, active, media_type, template_videos, templates)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'v1', 1, ?, ?, ?)`
    ).run(
      id, restaurant.id, title.trim(), description, discount_type, Number(discount_value),
      requires_video ? 1 : 0, allow_instagram_repost ? 1 : 0, terms_text,
      resolvedMediaType, JSON.stringify(Array.isArray(template_videos) ? template_videos : []),
      JSON.stringify(cleanTemplates(templates))
    );
  });
  createCampaign();

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  return NextResponse.json({ campaign: { ...campaign, template_videos: parseJsonArray(campaign.template_videos), templates: parseJsonArray(campaign.templates) } }, { status: 201 });
}
