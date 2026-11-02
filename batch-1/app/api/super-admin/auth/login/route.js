import { NextResponse } from "next/server";
import { verifySuperAdminCredentials, isAccountConfigured, createSuperAdminSession, SUPER_ADMIN_COOKIE } from "@/lib/superAdminAuth";

export async function POST(request) {
  const { email, password } = await request.json();
  if (!isAccountConfigured()) {
    return NextResponse.json({ error: "No super admin account has been set up yet." }, { status: 400 });
  }
  if (!verifySuperAdminCredentials(email, password)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  const { token, expires } = createSuperAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SUPER_ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
  return res;
}
