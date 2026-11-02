import { NextResponse } from "next/server";
import { setupAccount, isAccountConfigured, createSuperAdminSession, SUPER_ADMIN_COOKIE } from "@/lib/superAdminAuth";

export async function POST(request) {
  if (isAccountConfigured()) {
    return NextResponse.json({ error: "Super admin account is already set up. Use the login form." }, { status: 409 });
  }

  const { email, password, confirmPassword } = await request.json();
  if (!email || !password || !confirmPassword) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords don't match." }, { status: 400 });
  }

  try {
    setupAccount({ email, password });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
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
