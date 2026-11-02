import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { hashPassword, createSession, linkUserToRestaurant, SESSION_COOKIE } from "@/lib/auth";
import { saveDataUrl } from "@/lib/uploads";
import crypto from "node:crypto";
import { postLoginPath } from "@/lib/afterLogin";
import { getPending, consumePending } from "@/lib/googleAuth";

function slugify(name) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || "restaurant";
}

export async function POST(request) {
  const body = await request.json();
  const { restaurantName, phone, coverImageDataUrl, googleToken } = body;
  let { email, password } = body;

  // Signing up with Google: the email comes from the verified Google sign-in, not from the form,
  // and there is no password (the owner can set one later with "Forgot password").
  let pending = null;
  if (googleToken) {
    pending = getPending(googleToken);
    if (!pending) {
      return NextResponse.json({ error: "This Google sign-in has expired. Please start again." }, { status: 400 });
    }
    email = pending.email;
    password = crypto.randomBytes(24).toString("hex");
  }

  if (!restaurantName || !email || !phone || !password) {
    return NextResponse.json({ error: "Restaurant name, email, phone number, and password are required." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  let existingUser = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
  if (existingUser) {
    // A user row can be left behind with no restaurant attached to it (e.g.
    // a restaurant that was deleted before this cleanup existed). That's not
    // a real "in use" account, so quietly reclaim the email instead of
    // blocking a genuine new signup.
    const stillLinked = db.prepare("SELECT COUNT(*) as c FROM restaurant_users WHERE user_id = ?").get(existingUser.id).c;
    if (stillLinked === 0) {
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existingUser.id);
      db.prepare("DELETE FROM users WHERE id = ?").run(existingUser.id);
      existingUser = null;
    }
  }
  if (existingUser) {
    return NextResponse.json({ error: "An account with this email already exists. Try logging in." }, { status: 409 });
  }

  let slugBase = slugify(restaurantName);
  let slug = slugBase;
  let i = 1;
  while (db.prepare("SELECT 1 FROM restaurants WHERE slug = ?").get(slug)) {
    slug = `${slugBase}-${++i}`;
  }

  let coverImageUrl = "";
  if (coverImageDataUrl) {
    try {
      coverImageUrl = saveDataUrl(coverImageDataUrl);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  const restaurantId = newId();
  const userId = newId();
  const globalSettings = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO restaurants (id, slug, name, cover_image_url, phone, status, tax_percent)
       VALUES (?, ?, ?, ?, ?, 'trial', 5)`
    ).run(restaurantId, slug, restaurantName, coverImageUrl, phone.trim());

    db.prepare(
      `INSERT INTO restaurant_payment_settings (restaurant_id, cash_enabled, online_enabled) VALUES (?, 1, 1)`
    ).run(restaurantId);

    db.prepare(
      `INSERT INTO restaurant_taxes (id, restaurant_id, name, percent, active) VALUES (?, ?, 'GST', 5, 1)`
    ).run(newId(), restaurantId);

    db.prepare(
      `INSERT INTO subscriptions
        (id, restaurant_id, plan_name, onboarding_fee, onboarding_paid, monthly_fee,
         billing_cycle_start, billing_cycle_end, status, grace_period_days)
       VALUES (?, ?, 'Standard', NULL, 0, NULL, date('now'), date('now', ?), 'trial', ?)`
    ).run(
      newId(),
      restaurantId,
      `+${Math.max(0, Math.round(Number(globalSettings?.trial_days ?? 14)))} day`,
      globalSettings?.grace_period_days ?? 2
    );

    db.prepare(`INSERT INTO users (id, email, password_hash, name, google_sub) VALUES (?, ?, ?, ?, ?)`).run(
      userId,
      email.toLowerCase(),
      hashPassword(password),
      restaurantName,
      pending?.google_sub || null
    );

    linkUserToRestaurant(userId, restaurantId, "owner");
  });
  tx();
  if (pending) consumePending(googleToken);

  const { token, expires } = createSession(userId);
  const res = NextResponse.json({ slug, redirect: postLoginPath(slug) }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
  return res;
}
