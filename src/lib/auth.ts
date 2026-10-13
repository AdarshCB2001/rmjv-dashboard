import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BOOTSTRAP_ADMIN_EMAILS, DEMO_MODE, isAllowedEmail } from "@/lib/config";
import { DEMO_COOKIE, readSession } from "@/lib/demo/session";
import { clone, db } from "@/lib/demo/store";
import { adminSupabase, serverSupabase } from "@/lib/supabase/server";
import type { AllowedUser, Session } from "@/lib/types";

/**
 * Looks up the allow-list entry for an email, bypassing RLS.
 *
 * This has to run before the user has a session (at magic-link request time), so it
 * uses the service-role client. It only ever reads, and only the row for the email
 * it was handed.
 */
export async function findAllowedUser(email: string): Promise<AllowedUser | null> {
  const normalised = email.trim().toLowerCase();

  if (DEMO_MODE) {
    return clone(db().allowed_users.find((u) => u.email === normalised) ?? null);
  }

  const supabase = adminSupabase();
  if (!supabase) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — the allow-list check cannot run server-side.",
    );
  }
  const { data } = await supabase
    .from("allowed_users")
    .select("*")
    .eq("email", normalised)
    .maybeSingle();
  return (data as AllowedUser | null) ?? null;
}

export type GateResult =
  | { ok: true; user: AllowedUser }
  | { ok: false; reason: "domain" | "not-listed" | "deactivated" };

/**
 * The single definition of "may this email use the portal".
 *
 * Both conditions are checked: the address must be on the allowed domain *and* be an
 * active row in `allowed_users`. Called from the login action, the auth callback, and
 * on every session read — so revoking access in the admin table takes effect on the
 * user's next request rather than when their token happens to expire.
 */
export async function gateEmail(email: string): Promise<GateResult> {
  if (!isAllowedEmail(email)) return { ok: false, reason: "domain" };
  const user = await findAllowedUser(email);
  if (!user) return { ok: false, reason: "not-listed" };
  if (!user.active) return { ok: false, reason: "deactivated" };
  return { ok: true, user };
}

const resolveAdmin = (user: AllowedUser | null, email: string) =>
  Boolean(user?.is_admin) || BOOTSTRAP_ADMIN_EMAILS.includes(email.toLowerCase());

/**
 * Current session, or null. Cached per request so layouts and pages that each need
 * the session don't each pay for the lookup.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  if (DEMO_MODE) {
    const raw = (await cookies()).get(DEMO_COOKIE)?.value;
    const session = await readSession(raw);
    if (!session) return null;
    // Re-check the allow-list rather than trusting the cookie's copy of it.
    const gate = await gateEmail(session.email);
    if (!gate.ok) return null;
    return {
      email: gate.user.email,
      fullName: gate.user.full_name,
      isAdmin: resolveAdmin(gate.user, gate.user.email),
    };
  }

  const supabase = await serverSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const gate = await gateEmail(user.email);
  if (!gate.ok) return null;

  return {
    email: gate.user.email,
    fullName: gate.user.full_name,
    isAdmin: resolveAdmin(gate.user, gate.user.email),
  };
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!session.isAdmin) redirect("/dashboard?error=admin-only");
  return session;
}
