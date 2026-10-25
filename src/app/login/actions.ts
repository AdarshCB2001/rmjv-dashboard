"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ALLOWED_EMAIL_DOMAIN, DEMO_LOCKED, DEMO_MODE, SITE_URL } from "@/lib/config";
import { gateEmail, type GateResult } from "@/lib/auth";
import { DEMO_COOKIE, signSession } from "@/lib/demo/session";
import { serverSupabase } from "@/lib/supabase/server";

export type LoginState = { error?: string; sent?: string };

/**
 * Deliberately identical wording for "not on the allow-list" and "deactivated".
 * Distinguishing them would let anyone enumerate which staff have portal access.
 */
function gateMessage(result: Extract<GateResult, { ok: false }>): string {
  if (result.reason === "domain") {
    return `Access is limited to @${ALLOWED_EMAIL_DOMAIN} accounts.`;
  }
  return "That address isn't set up for this portal yet. Ask FunKustoms to add you, or use the chat on the login page.";
}

/**
 * Requests a magic link.
 *
 * The domain and allow-list checks run here on the server, not just in the browser —
 * a client-side check alone would be bypassed by anyone calling the API directly.
 */
export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) return { error: "Enter your work email address." };

  const gate = await gateEmail(email);
  if (!gate.ok) return { error: gateMessage(gate) };

  const supabase = await serverSupabase();
  if (!supabase) return { error: "Supabase is not configured on this deployment." };

  const next = String(formData.get("next") ?? "/dashboard");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) return { error: error.message };
  return { sent: email };
}

/**
 * Demo-mode sign-in. Only reachable when Supabase is unconfigured, and still subject
 * to the same `gateEmail` check as the real flow.
 */
export async function demoSignIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!DEMO_MODE || DEMO_LOCKED) return { error: "Demo sign-in is disabled." };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const gate = await gateEmail(email);
  if (!gate.ok) return { error: gateMessage(gate) };

  const cookieStore = await cookies();
  cookieStore.set(
    DEMO_COOKIE,
    await signSession({
      email: gate.user.email,
      fullName: gate.user.full_name,
      isAdmin: gate.user.is_admin,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: SITE_URL.startsWith("https://"),
      path: "/",
      maxAge: 60 * 60 * 8,
    },
  );

  redirect(String(formData.get("next") ?? "/dashboard"));
}

export async function signOut(): Promise<void> {
  if (DEMO_MODE) {
    (await cookies()).delete(DEMO_COOKIE);
  } else {
    const supabase = await serverSupabase();
    await supabase?.auth.signOut();
  }
  redirect("/login");
}
