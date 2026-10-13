import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  HAS_SUPABASE,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "@/lib/config";

/**
 * Request-scoped client that carries the signed-in user's session, so every query
 * it runs is subject to Row Level Security. This is what all user-facing reads and
 * writes go through.
 */
export async function serverSupabase() {
  if (!HAS_SUPABASE) return null;
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. The middleware refreshes the session
          // on every request, so a failure here is safe to swallow.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Only ever import this from server-only code, and only for operations that
 * legitimately need to cross user boundaries: the admin views, the allow-list check
 * at sign-in, and payment/invoice writes triggered by verified webhooks. Every
 * caller must do its own authorisation check first.
 */
export function adminSupabase() {
  if (!HAS_SUPABASE || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createServerClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
