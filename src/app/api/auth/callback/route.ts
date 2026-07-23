import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback / email-link landing.
 *
 * Handles three flows by the `flow` param the app sets on the redirect URL:
 *
 *  - `signup` (Sprint 9 M0): the email-confirmation link. Supabase's verify
 *    endpoint has already confirmed the address before redirecting here, so we
 *    establish NO session — we send the parent to the login screen to sign in
 *    with their password (`?confirmed=1` shows the "email confirmed" banner).
 *  - `recovery`: the password-reset link. Here we DO need a (recovery) session
 *    so the reset page can call updateUser, so we exchange the PKCE code and
 *    land on /reset-password.
 *  - neither (legacy magic-link / Google OAuth): exchange the code and continue
 *    to `next`. The magic-link path stays in the repo but is no longer primary.
 *
 * B6 adds a fourth: a `token_hash` link, minted by the app when it sends its own
 * branded emails via Resend (see src/lib/auth/actions.ts). We verify it
 * server-side with verifyOtp — no PKCE, no URL fragment — and land the parent:
 * a confirmed signup is now signed in, a recovery gets a session for the reset.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const flow = searchParams.get("flow");
  const locale = searchParams.get("locale") ?? "hu";
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  // App-minted confirmation / reset link (B6): verify the token_hash server-side.
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (tokenHash && (type === "signup" || type === "recovery")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      return type === "recovery"
        ? NextResponse.redirect(`${origin}/${locale}/reset-password?error=1`)
        : NextResponse.redirect(`${origin}/${locale}/login?error=expired`);
    }
    // recovery: session established, go set a new password. signup: verifyOtp
    // signed the parent in, so take them straight into the app.
    return NextResponse.redirect(`${origin}/${locale}${type === "recovery" ? "/reset-password" : "/app"}`);
  }

  if (flow === "signup") {
    // Email is already confirmed at the verify step; no session, go log in.
    return NextResponse.redirect(`${origin}/${locale}/login?confirmed=1`);
  }

  if (flow === "recovery") {
    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return NextResponse.redirect(`${origin}/${locale}/reset-password?error=1`);
    }
    return NextResponse.redirect(`${origin}/${locale}/reset-password`);
  }

  // Legacy magic-link / OAuth (both use the PKCE `code`).
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/`);
}
