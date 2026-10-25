import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { HAS_SUPABASE, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { DEMO_COOKIE, readSession } from "@/lib/demo/session";

/**
 * Next 16 renamed the `middleware` convention to `proxy`. Two jobs here:
 *  1. Refresh the Supabase auth cookie on every request so Server Components see a
 *     live session.
 *  2. Bounce unauthenticated requests away from portal routes.
 *
 * This is a cheap first gate, NOT the authorisation boundary. It only asks "is there
 * a valid session token". Per the Next docs, Server Functions are POST requests to the
 * route that uses them, so a matcher change can silently drop proxy coverage — which
 * is why every server action calls `requireSession()`/`requireAdmin()` itself, the
 * allow-list is re-checked on each session read, and RLS is what actually guards rows.
 */

const PUBLIC_PATHS = ["/login", "/auth", "/api/cron"];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  let signedIn = false;

  if (HAS_SUPABASE) {
    const supabase = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });
    // getUser(), not getSession() — this validates the token with the auth server
    // instead of trusting whatever is in the cookie.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } else {
    signedIn = Boolean(await readSession(request.cookies.get(DEMO_COOKIE)?.value));
  }

  if (!signedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
