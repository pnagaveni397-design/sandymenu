import { NextResponse } from "next/server";
import { isAccountConfigured } from "@/lib/superAdminAuth";

// Without this, Next.js statically optimizes this route at build time
// (it has no cookies/params to key off of) and freezes whatever the
// answer was back then — which is why, right after finishing setup, the
// login page could still be told "not configured yet" until a full
// rebuild. Forcing it dynamic makes it check the database on every request.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ configured: isAccountConfigured() });
}
