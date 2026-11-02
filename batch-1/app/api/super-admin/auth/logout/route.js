import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySuperAdminSession, SUPER_ADMIN_COOKIE } from "@/lib/superAdminAuth";

export async function POST() {
  const token = cookies().get(SUPER_ADMIN_COOKIE)?.value;
  destroySuperAdminSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SUPER_ADMIN_COOKIE, "", { path: "/", expires: new Date(0) });
  return res;
}
