import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByToken, getUserRestaurants, SESSION_COOKIE } from "@/lib/auth";
import { googleConfigured } from "@/lib/googleAuth";
import LoginForm from "./LoginForm";

// Already signed in? Skip the form and go straight to the dashboard.
// The login form only appears again after the owner taps "Log out".
export default async function LoginPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = getUserByToken(token);
  if (user) {
    const r = getUserRestaurants(user.id)[0];
    if (r) redirect(`/dashboard/${r.slug}`);
  }
  return <LoginForm googleEnabled={googleConfigured() || process.env.NODE_ENV !== "production"} googleReady={googleConfigured()} initialError={String(sp.error || "")} next={String(sp.next || "")} />;
}
