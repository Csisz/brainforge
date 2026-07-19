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
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const flow = searchParams.get("flow");
  const locale = searchParams.get("locale") ?? "hu";
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

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
