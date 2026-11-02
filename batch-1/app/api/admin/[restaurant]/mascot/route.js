import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRestaurant } from "@/lib/posAuth";
import { mergeMascotConfig } from "@/lib/mascot";

// Saves the restaurant's mascot settings. Lives in its own route so the
// existing restaurant PATCH route is untouched. Requires the logged-in
// owner/staff session, and the config is run through mergeMascotConfig so
// only valid values (known poses, hex colors, size limits, trimmed
// messages) are ever stored.
export async function PATCH(request, { params }) {
  const { restaurant: slug } = await params;
  const auth = await authRestaurant(slug);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const clean = mergeMascotConfig(body?.mascot);
  db.prepare("UPDATE restaurants SET mascot_config = ? WHERE id = ?").run(JSON.stringify(clean), auth.restaurant.id);
  return NextResponse.json({ mascot: clean });
}
