import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSuperAdminSession, SUPER_ADMIN_COOKIE } from "@/lib/superAdminAuth";
import { getSuperAdminDashboardData } from "@/lib/superAdminData";
import SuperAdminApp from "./SuperAdminApp";

export default function SuperAdminPage() {
  const token = cookies().get(SUPER_ADMIN_COOKIE)?.value;
  if (!isValidSuperAdminSession(token)) redirect("/super-admin/login");

  const data = getSuperAdminDashboardData();

  return (
    <SuperAdminApp
      settings={data.settings}
      settingsHistory={data.settingsHistory}
      restaurants={data.restaurants}
      contact={data.contact}
      feeBalance={data.feeBalance}
    />
  );
}
