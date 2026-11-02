import { db } from "@/lib/db";
import { SearchX, PauseCircle, Armchair } from "lucide-react";
import MenuApp from "./MenuApp";
import { parseJsonArray } from "@/lib/templates";
import { mergeMascotConfig } from "@/lib/mascot";
import { syncStatuses } from "@/lib/subscriptionStatus";
import { restaurantHasVoice } from "@/lib/voiceAccess";

export default function TableEntryPage({ params }) {
  const { restaurant: slug, tableId } = params;
  syncStatuses(db);

  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(slug);

  if (!restaurant) {
    return (
      <NoticeScreen
        icon={SearchX}
        title="Restaurant not found"
        body="This QR code doesn't match any restaurant on TableServe. Please ask staff for a fresh code."
      />
    );
  }

  if (restaurant.status === "suspended") {
    return (
      <NoticeScreen
        icon={PauseCircle}
        title={`${restaurant.name} is temporarily unavailable`}
        body="This menu isn't taking orders right now. Please check with the restaurant directly."
      />
    );
  }

  const table = db
    .prepare("SELECT * FROM tables WHERE restaurant_id = ? AND table_number = ? AND active = 1")
    .get(restaurant.id, tableId);

  if (!table) {
    return (
      <NoticeScreen
        icon={Armchair}
        title="Table not found"
        body="This table code isn't active. Please ask a staff member for help."
      />
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

  // Up to one active campaign per media_type (a video one and an audio
  // one can run at the same time -- see the campaigns API for the rule).
  const campaigns = db
    .prepare("SELECT * FROM campaigns WHERE restaurant_id = ? AND active = 1")
    .all(restaurant.id)
    .map((c) => ({ ...c, template_videos: parseJsonArray(c.template_videos), templates: parseJsonArray(c.templates) }));

  const taxes = db
    .prepare("SELECT * FROM restaurant_taxes WHERE restaurant_id = ? AND active = 1")
    .all(restaurant.id);

  const subscription = db.prepare("SELECT * FROM subscriptions WHERE restaurant_id = ?").get(restaurant.id);
  const globalSettings = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  const platformFeeRate = subscription?.order_fee_override ?? globalSettings?.order_fee ?? 2;

  return (
    <MenuApp
      restaurant={{
        id: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
        logo_image_url: restaurant.logo_image_url,
        cover_image_url: restaurant.cover_image_url,
        tagline: restaurant.tagline,
        instagram_url: restaurant.instagram_url,
        google_review_url: restaurant.google_review_url,
        offer_success_message: restaurant.offer_success_message,
        banner_messages: JSON.parse(restaurant.banner_messages || "[]"),
        currency: restaurant.currency,
        welcome_animation_enabled: !!restaurant.welcome_animation_enabled,
        welcome_sound_enabled: !!restaurant.welcome_sound_enabled,
      }}
      campaigns={campaigns}
      mascot={mergeMascotConfig(restaurant.mascot_config)}
      taxes={taxes}
      platformFeeRate={platformFeeRate}
      voiceEnabled={restaurantHasVoice(restaurant.id)}
      table={{ id: table.id, table_number: table.table_number, table_name: table.table_name }}
      categories={categories}
      items={items}
      offers={offers}
      payment={{
        cash_enabled: !!paymentSettings?.cash_enabled,
        online_enabled: !!paymentSettings?.online_enabled,
        phonepe_qr_image_url: paymentSettings?.phonepe_qr_image_url || null,
        upi_id: paymentSettings?.upi_id || null,
      }}
    />
  );
}

function NoticeScreen({ icon: Icon, title, body }) {
  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="text-center max-w-sm animate-rise-in">
        <div className="w-16 h-16 rounded-full bg-clay-light flex items-center justify-center mx-auto mb-4">
          <Icon size={28} className="text-clay" strokeWidth={1.5} />
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-ink/60">{body}</p>
      </div>
    </main>
  );
}

