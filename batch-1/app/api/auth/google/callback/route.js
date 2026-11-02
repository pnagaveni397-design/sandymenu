import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createSession, getUserRestaurants, SESSION_COOKIE } from "@/lib/auth";
import { postLoginPath } from "@/lib/afterLogin";
import { googleConfigured, oauthBase, fetchGoogleProfile, createPending, safeNext, statesMatch } from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

// Google sends the person back here. Existing owner -> log them in. New person -> finish signup (restaurant name + phone).
export async function GET(request) {
  const baseUrl = oauthBase(request);
  const go = (path) => {
    const res = NextResponse.redirect(new URL(path, baseUrl));
    res.cookies.set("g_state", "", { path: "/", maxAge: 0 });
    res.cookies.set("g_next", "", { path: "/", maxAge: 0 });
    return res;
  };

  if (!googleConfigured()) return go("/login?error=google_off");

  const url = new URL(request.url);
  const jar = await cookies();
  const savedState = jar.get("g_state")?.value;
  const next = safeNext(jar.get("g_next")?.value);

  if (url.searchParams.get("error")) return go("/login?error=google_cancelled");
  if (!statesMatch(url.searchParams.get("state"), savedState)) return go("/login?error=google_state");
  const code = url.searchParams.get("code");
  if (!code) return go("/login?error=google_failed");

  let profile;
  try {
    profile = await fetchGoogleProfile({ code, baseUrl });
  } catch (e) {
    return go(`/login?error=${e.message === "email_not_verified" ? "google_unverified" : "google_failed"}`);
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(profile.email);
  const restaurants = user ? getUserRestaurants(user.id) : [];

  if (!user || restaurants.length === 0) {
    const token = createPending(profile);
    return go(`/signup?google=${token}`);
  }

  if (!user.google_sub && profile.sub) {
    db.prepare("UPDATE users SET google_sub = ? WHERE id = ?").run(profile.sub, user.id);
  }

  const { token, expires } = createSession(user.id);
  const res = go(next || postLoginPath(restaurants[0].slug));
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: new Date(expires) });
  return res;
}
