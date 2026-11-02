import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByToken, getUserRestaurants, SESSION_COOKIE } from "@/lib/auth";

// There is no landing page: opening the site goes straight to the login (or the dashboard if already signed in).
export default async function Home() {
  if (process.env.TABLESERVE_ADMIN === "1") redirect("/super-admin");
  const user = getUserByToken((await cookies()).get(SESSION_COOKIE)?.value);
  const first = user ? getUserRestaurants(user.id)[0] : null;
  redirect(first ? `/dashboard/${first.slug}` : "/login");
}
