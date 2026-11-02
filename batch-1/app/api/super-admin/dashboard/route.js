import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSuperAdminSession, SUPER_ADMIN_COOKIE } from "@/lib/superAdminAuth";
import { getSuperAdminDashboardData } from "@/lib/superAdminData";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = cookies().get(SUPER_ADMIN_COOKIE)?.value;
  if (!isValidSuperAdminSession(token)) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const data = getSuperAdminDashboardData();
  return NextResponse.json(data);
}
