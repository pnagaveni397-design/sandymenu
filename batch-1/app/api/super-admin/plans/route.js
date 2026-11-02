import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { requireSuperAdmin } from "@/lib/requireSuperAdmin";

export const dynamic = "force-dynamic";

function parseFeatures(raw) {
  try {
    const a = JSON.parse(raw || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function listPlans() {
  return db
    .prepare("SELECT * FROM plans ORDER BY sort_order ASC, created_at ASC")
    .all()
    .map((p) => ({ ...p, features: parseFeatures(p.features) }));
}

export async function GET() {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  return NextResponse.json({ plans: listPlans() });
}

// Create (no id) or update (with id) one plan.
export async function POST(request) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const b = await request.json().catch(() => ({}));

  const name = String(b.name || "").trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: "Give the plan a name." }, { status: 400 });
  const price = Number(b.price_monthly);
  if (!(price >= 0)) return NextResponse.json({ error: "Enter the monthly price (0 or more)." }, { status: 400 });
  const onboarding = b.onboarding_fee === "" || b.onboarding_fee == null ? null : Number(b.onboarding_fee);
  if (onboarding != null && !(onboarding >= 0)) return NextResponse.json({ error: "Setup fee must be 0 or more." }, { status: 400 });

  const features = (Array.isArray(b.features) ? b.features : [])
    .map((f) => String(f || "").trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 14);
  const description = String(b.description || "").trim().slice(0, 300);
  const badge = String(b.badge || "").trim().slice(0, 24);
  const sort = Math.round(Number(b.sort_order) || 0);
  const kind = b.kind === "trial" ? "trial" : "paid";
  const orderFee = b.order_fee === "" || b.order_fee == null ? null : Number(b.order_fee);
  if (orderFee != null && !(orderFee >= 0)) return NextResponse.json({ error: "Platform fee must be 0 or more." }, { status: 400 });
  const priceNote = String(b.price_note || "").trim().slice(0, 60);
  const footnote = String(b.footnote || "").trim().slice(0, 100);
  const featuresTitle = String(b.features_title || "").trim().slice(0, 80);
  const active = b.active === false || b.active === 0 ? 0 : 1;
  const voice = b.voice_enabled === true || b.voice_enabled === 1 ? 1 : 0;

  if (b.id) {
    const res = db
      .prepare(
        `UPDATE plans SET name = ?, price_monthly = ?, onboarding_fee = ?, description = ?, features = ?, badge = ?, sort_order = ?, active = ?,
           kind = ?, order_fee = ?, price_note = ?, footnote = ?, features_title = ?, voice_enabled = ? WHERE id = ?`
      )
      .run(name, price, onboarding, description, JSON.stringify(features), badge, sort, active, kind, orderFee, priceNote, footnote, featuresTitle, voice, b.id);
    if (!res.changes) return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    // Everyone already on this plan gets the new name, price and per-order fee straight away
    // (a changed price applies to their next payment). A setup fee that is already paid is left alone.
    if (kind !== "trial") {
      db.prepare(
        `UPDATE subscriptions SET plan_name = ?, monthly_fee = ?, order_fee_override = ?,
           onboarding_fee = CASE WHEN COALESCE(onboarding_paid, 0) = 0 AND ? IS NOT NULL THEN ? ELSE onboarding_fee END
         WHERE selected_plan_id = ?`
      ).run(name, price, orderFee, onboarding, onboarding, b.id);
    }
  } else {
    db.prepare(
      `INSERT INTO plans (id, name, price_monthly, onboarding_fee, description, features, badge, sort_order, active, kind, order_fee, price_note, footnote, features_title, voice_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(newId(), name, price, onboarding, description, JSON.stringify(features), badge, sort, active, kind, orderFee, priceNote, footnote, featuresTitle, voice);
  }
  return NextResponse.json({ plans: listPlans() });
}

export async function DELETE(request) {
  const denied = requireSuperAdmin();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing plan id." }, { status: 400 });
  db.prepare("DELETE FROM plans WHERE id = ?").run(id);
  // clients who had picked it keep the plan name and price they were given
  db.prepare("UPDATE subscriptions SET selected_plan_id = NULL WHERE selected_plan_id = ?").run(id);
  return NextResponse.json({ plans: listPlans() });
}
