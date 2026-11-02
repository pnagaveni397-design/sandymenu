import { NextResponse } from "next/server";
import { getPending } from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

// The signup page asks who just signed in with Google, so it can show their email and name.
export async function GET(request) {
  const row = getPending(new URL(request.url).searchParams.get("token"));
  if (!row) return NextResponse.json({ error: "This Google sign-in has expired. Please try again." }, { status: 404 });
  return NextResponse.json({ email: row.email, name: row.name });
}
