import { NextResponse, type NextRequest } from "next/server";
import { gateEmail } from "@/lib/auth";
import { serverSupabase } from "@/lib/supabase/server";

/**
 * Magic-link landing route.
 *
 * Exchanges the one-time code for a session, then re-runs the allow-list check. The
 * check at link-request time isn't enough on its own: access could have been revoked
 * between the email being sent and the link being clicked, and a link could be
 * forwarded. A session that fails the gate is torn down immediately.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next") ?? "/dashboard";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);

  const supabase = await serverSupabase();
  if (!supabase) return fail("not-configured");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("link-invalid");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "email",
    });
    if (error) return fail("link-invalid");
  } else {
    return fail("link-invalid");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return fail("link-invalid");

  const gate = await gateEmail(user.email);
  if (!gate.ok) {
    await supabase.auth.signOut();
    return fail(gate.reason === "domain" ? "domain" : "not-listed");
  }

  // Only ever redirect to a path on this origin — an open redirect here would be
  // handing out freshly minted sessions.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
