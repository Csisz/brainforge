import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Shared exchange endpoint for both magic-link and Google OAuth (both use the
 * same PKCE `code` param). Lives under /api so next-intl's middleware matcher
 * skips it — the redirect target is what needs a locale, not this handler.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
