import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

// Stage 1 ships a deterministic, rule-based recommender so the feature is
// fully testable with zero API keys. It is intentionally grounded ONLY in
// items that exist in this restaurant's menu right now — same contract the
// real AI call must honor. To go live with Claude:
//   1. set AI_API_KEY in .env
//   2. replace `ruleBasedRecommend()` below with a server-side call to
//      https://api.anthropic.com/v1/messages, passing the same
//      `availableItems` list as the ONLY source of truth in the prompt,
//      and instructing the model to pick item ids from that list only —
//      never invent names, prices, or availability.
//   The response contract (recommendations: [{item, reason}]) stays the same,
//   so MenuApp.jsx needs no changes either way.

export async function POST(request) {
  const { restaurantId, query } = await request.json();
  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

  const availableItems = db
    .prepare("SELECT * FROM menu_items WHERE restaurant_id = ? AND available = 1")
    .all(restaurantId)
    .map((it) => ({ ...it, tags: JSON.parse(it.tags || "[]") }));

  const { message, recommendations } = ruleBasedRecommend(query || "", availableItems);

  db.prepare(
    `INSERT INTO analytics_events (id, restaurant_id, event_type, metadata) VALUES (?, ?, 'ai_recommendation_shown', ?)`
  ).run(newId(), restaurantId, JSON.stringify({ query, count: recommendations.length }));

  return NextResponse.json({
    message,
    recommendations: recommendations.map((r) => ({ item: r.item, reason: r.reason })),
  });
}

function ruleBasedRecommend(query, items) {
  const q = query.toLowerCase();
  let pool = items;
  const reasons = [];

  const wantsVeg = /veg(etarian)?\b(?!.*non)/.test(q) || /\bveg\b/.test(q);
  const wantsNonVeg = /non[- ]?veg|chicken|meat/.test(q);
  const wantsSpicy = /spicy|hot\b/.test(q);
  const wantsSweet = /sweet|dessert/.test(q);
  const wantsLight = /light|healthy/.test(q);
  const wantsHungry = /hungry|filling|big/.test(q);
  const budgetMatch = q.match(/(?:under|below|less than)\s*₹?\s*(\d+)/);
  const budget = budgetMatch ? parseInt(budgetMatch[1], 10) : null;

  if (wantsVeg) { pool = pool.filter((i) => i.is_veg); reasons.push("vegetarian"); }
  if (wantsNonVeg) { pool = pool.filter((i) => !i.is_veg); reasons.push("non-vegetarian"); }
  if (wantsSpicy) { pool = pool.filter((i) => i.spice_level === "medium" || i.spice_level === "hot"); reasons.push("spicy"); }
  if (wantsSweet) { pool = pool.filter((i) => i.tags.includes("sweet")); reasons.push("something sweet"); }
  if (wantsLight) { pool = pool.filter((i) => i.tags.includes("healthy") || i.price < 200); reasons.push("light"); }
  if (budget) { pool = pool.filter((i) => (i.discounted_price || i.price) <= budget); reasons.push(`under ₹${budget}`); }

  if (pool.length === 0) pool = items; // fall back to everything available rather than showing nothing

  // Rank: popular first, then recommended, then cheaper
  pool = [...pool].sort((a, b) => {
    if (a.is_popular !== b.is_popular) return b.is_popular - a.is_popular;
    if (a.is_recommended !== b.is_recommended) return b.is_recommended - a.is_recommended;
    return a.price - b.price;
  });

  const picks = pool.slice(0, wantsHungry ? 5 : 3);
  const descriptor = reasons.length ? reasons.join(", ") : "your craving";

  const recommendations = picks.map((item) => ({
    item,
    reason: buildReason(item, descriptor),
  }));

  const message = query
    ? `Based on ${descriptor}, here's what I'd suggest from today's menu:`
    : "Here are a few things people are loving right now:";

  return { message, recommendations };
}

function buildReason(item, descriptor) {
  const price = item.discounted_price || item.price;
  const bits = [];
  if (item.is_popular) bits.push("a customer favourite");
  if (item.spice_level === "hot") bits.push("nicely spicy");
  else if (item.spice_level === "medium") bits.push("mild-medium heat");
  bits.push(`available now for ₹${Math.round(price)}`);
  return `Matches ${descriptor} — ${bits.join(", ")}.`;
}
