"use client";

import { createBrowserClient } from "@supabase/ssr";
import { HAS_SUPABASE, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

/**
 * Browser client. Returns null in demo mode instead of throwing, so client
 * components can branch on it rather than crashing the render.
 */
export function browserSupabase() {
  if (!HAS_SUPABASE) return null;
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}
