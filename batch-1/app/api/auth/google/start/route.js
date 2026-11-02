import { NextResponse } from "next/server";
import { googleConfigured, oauthBase, buildAuthUrl, newState, safeNext } from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

// The "Continue with Google" button points here: remember a one-time state, then send the browser to Google.
export async function GET(request) {
  const baseUrl = oauthBase(request);
  if (!googleConfigured()) return NextResponse.redirect(new URL("/login?error=google_off", baseUrl));

  const state = newState();
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const res = NextResponse.redirect(buildAuthUrl({ baseUrl, state }));
  const opts = { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: baseUrl.startsWith("https") };
  res.cookies.set("g_state", state, opts);
  res.cookies.set("g_next", next, opts);
  return res;
}
