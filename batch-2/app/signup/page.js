import { googleConfigured } from "@/lib/googleAuth";
import SignupForm from "./SignupForm";

export default async function SignupPage({ searchParams }) {
  const sp = (await searchParams) || {};
  return <SignupForm googleEnabled={googleConfigured() || process.env.NODE_ENV !== "production"} googleToken={String(sp.google || "")} />;
}
