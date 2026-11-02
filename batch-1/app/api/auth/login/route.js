import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postLoginPath } from "@/lib/afterLogin";
import { verifyPassword, createSession, getUserRestaurants, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const restaurants = getUserRestaurants(user.id);
  if (restaurants.length === 0) {
    return NextResponse.json({ error: "No restaurant is linked to this account yet." }, { status: 403 });
  }

  const { token, expires } = createSession(user.id);
  const res = NextResponse.json({ slug: restaurants[0].slug, redirect: postLoginPath(restaurants[0].slug) });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
  return res;
}
