import { NextResponse } from "next/server";
import { getSuperAdminByResetToken, resetSuperAdminPasswordWithToken } from "@/lib/superAdminAuth";

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  const account = getSuperAdminByResetToken(token);
  return NextResponse.json({ valid: !!account });
}

export async function POST(request) {
  const { token, password, confirmPassword } = await request.json();
  if (!token || !password || !confirmPassword) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords don't match." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const account = getSuperAdminByResetToken(token);
  if (!account) {
    return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });
  }

  resetSuperAdminPasswordWithToken(token, password);
  return NextResponse.json({ ok: true });
}
