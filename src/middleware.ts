import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { refreshSession } from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

/** Routes that require a signed-in user, checked with the locale prefix stripped. */
const PROTECTED_PREFIXES = ["/app", "/onboarding", "/account"];

function stripLocale(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})(\/.*|$)/);
  if (match && (routing.locales as readonly string[]).includes(match[1]!)) {
    return match[2] || "/";
  }
  return pathname;
}

export default async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);

  // next-intl already decided to redirect/rewrite for locale reasons (e.g. "/"
  // -> "/hu") — let that happen first; auth is re-checked on the next request.
  if (intlResponse.headers.get("location")) {
    return intlResponse;
  }

  const user = await refreshSession(request, intlResponse);

  const bare = stripLocale(request.nextUrl.pathname);
  const requiresAuth = PROTECTED_PREFIXES.some((p) => bare === p || bare.startsWith(`${p}/`));

  if (requiresAuth && !user) {
    const localeMatch = request.nextUrl.pathname.match(/^\/([a-z]{2})(\/|$)/);
    const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
