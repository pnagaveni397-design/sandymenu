import { redirect } from "next/navigation";
import { db } from "@/lib/db";

// The one shareable link for a template: /r/<restaurant>/edit/<templateId>
// Optional ?table=<n> pins the table; otherwise the first active table is used.
// Lands on the customer menu, and once the customer reaches their bill the
// edit place opens with this template already loaded.
export default function TemplateLinkPage({ params, searchParams }) {
  const { restaurant: slug, templateId } = params;
  const restaurant = db.prepare("SELECT id FROM restaurants WHERE slug = ?").get(slug);
  if (!restaurant) redirect("/");

  let tableNumber = searchParams?.table;
  if (tableNumber) {
    const ok = db.prepare("SELECT table_number FROM tables WHERE restaurant_id = ? AND table_number = ? AND active = 1").get(restaurant.id, tableNumber);
    if (!ok) tableNumber = null;
  }
  if (!tableNumber) {
    const first = db.prepare("SELECT table_number FROM tables WHERE restaurant_id = ? AND active = 1 ORDER BY table_number LIMIT 1").get(restaurant.id);
    tableNumber = first?.table_number;
  }
  if (!tableNumber) redirect("/");

  redirect(`/r/${slug}/table/${encodeURIComponent(tableNumber)}?edit=${encodeURIComponent(templateId)}`);
}
