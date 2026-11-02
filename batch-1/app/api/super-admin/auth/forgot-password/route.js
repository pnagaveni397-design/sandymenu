import { NextResponse } from "next/server";
import { createSuperAdminPasswordResetToken, isAccountConfigured } from "@/lib/superAdminAuth";
import { sendPasswordResetEmail, isConfigured } from "@/lib/email";
import { getBaseUrl } from "@/lib/baseUrl";

export async function POST(request) {
  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  // Always respond the same way whether or not the account/email matches,
  // so this endpoint can't be used to probe for the admin's email address.
  const genericMessage = "If that email matches your super admin account, we've sent password reset instructions to it.";

  if (!isAccountConfigured()) {
    return NextResponse.json({ ok: true, message: genericMessage });
  }

  const result = createSuperAdminPasswordResetToken(email);
  if (!result) {
    return NextResponse.json({ ok: true, message: genericMessage });
  }

  const origin = getBaseUrl(request);
  const resetUrl = `${origin}/super-admin/reset-password?token=${result.token}`;

  if (isConfigured()) {
    const sendResult = await sendPasswordResetEmail({ email: result.account.email, resetUrl, kind: "super_admin" });
    if (!sendResult.sent) {
      // Email is misconfigured/unreachable. There's no "other admin" to
      // fall back to for the super admin account, so print the link to
      // the server's own terminal — only whoever has shell access to the
      // machine running this app (i.e. you) can see it there.
      console.error(`[super-admin-reset] Could not email ${result.account.email}: ${sendResult.reason}`);
      console.log(`[super-admin-reset] Reset link (email delivery failed): ${resetUrl}`);
    }
  } else {
    console.log(`[super-admin-reset] SMTP isn't configured — here is your reset link: ${resetUrl}`);
  }

  return NextResponse.json({ ok: true, message: genericMessage });
}
