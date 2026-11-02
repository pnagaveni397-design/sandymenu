import { NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/auth";
import { sendPasswordResetEmail, isConfigured } from "@/lib/email";
import { getBaseUrl } from "@/lib/baseUrl";

export async function POST(request) {
  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const result = createPasswordResetToken(email);

  // Always respond the same way whether or not the account exists, so this
  // endpoint can't be used to check which emails are registered.
  const genericMessage =
    "If an account with that email exists, we've sent password reset instructions to it. " +
    "Didn't get it? Ask the TableServe team for a reset link.";

  if (!result) {
    return NextResponse.json({ ok: true, message: genericMessage });
  }

  const origin = getBaseUrl(request);
  const resetUrl = `${origin}/reset-password?token=${result.token}`;

  if (isConfigured()) {
    const sendResult = await sendPasswordResetEmail({ email: result.user.email, resetUrl, kind: "client" });
    if (!sendResult.sent) {
      console.error(`[password-reset] Could not email ${result.user.email}:`, sendResult.reason);
    }
  }

  // Deliberately NOT returning the reset link here even if email failed —
  // doing so would let anyone who merely knows (or guesses) a client's
  // email address take over their account with no proof of ownership. If
  // email delivery isn't working, the platform admin can see this same
  // pending reset link for the client in the super admin dashboard (that's
  // gated behind the admin's own login) and pass it on directly.
  return NextResponse.json({ ok: true, message: genericMessage });
}
