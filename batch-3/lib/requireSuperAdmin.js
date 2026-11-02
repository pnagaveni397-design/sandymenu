import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSuperAdminSession, SUPER_ADMIN_COOKIE } from "@/lib/superAdminAuth";

// Call at the top of every Super Admin API handler.
// Returns a 401 response when the caller isn't signed in as Super Admin, otherwise null.
export function requireSuperAdmin() {
  const token = cookies().get(SUPER_ADMIN_COOKIE)?.value;
  if (!isValidSuperAdminSession(token)) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return null;
}
