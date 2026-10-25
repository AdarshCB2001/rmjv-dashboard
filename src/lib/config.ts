/**
 * Single source of truth for "which integrations are actually configured".
 *
 * Nothing in the app throws at import time because a key is missing. Instead each
 * subsystem degrades: no Supabase keys => demo mode (seeded in-memory data), no
 * chat keys => no chat widget.
 */

const val = (v: string | undefined) => (v && v.trim().length > 0 ? v.trim() : undefined);

export const SUPABASE_URL = val(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = val(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** True when Supabase is wired up. When false the whole app runs on the demo store. */
export const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Demo mode is simply "Supabase is not configured". */
export const DEMO_MODE = !HAS_SUPABASE;

/**
 * Demo mode keeps data in memory and offers an account picker instead of real sign-in,
 * so it is for local development only. A production build without Supabase refuses to
 * sign anyone in (set ALLOW_DEMO_MODE=1 to override for a staging smoke test).
 */
export const DEMO_LOCKED =
  DEMO_MODE && process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_MODE !== "1";

/** Only ever read on the server. */
export const SUPABASE_SERVICE_ROLE_KEY = val(process.env.SUPABASE_SERVICE_ROLE_KEY);


/** Shown as a "Chat on WhatsApp" link on each catalog product. Digits only, country code first. */
export const SUPPORT_WHATSAPP_NUMBER =
  val(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER) ?? "918237603202";

/** Sign-in is limited to this email domain. */
export const ALLOWED_EMAIL_DOMAIN =
  val(process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN) ?? "spintly.com";

/**
 * Bootstrap admins. The real source of truth is `allowed_users.is_admin`, but you
 * need at least one admin before you can edit the table through the UI.
 */
export const BOOTSTRAP_ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const SITE_URL =
  val(process.env.NEXT_PUBLIC_SITE_URL) ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const ORDER_FILES_BUCKET = "order-files";
export const INVOICES_BUCKET = "invoices";

/** Upload rules. Enforced client-side for UX and re-enforced server-side for real. */
export const ALLOWED_FILE_EXTENSIONS = [".ai", ".pdf", ".png", ".eps"] as const;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const isAllowedFileName = (name: string) =>
  ALLOWED_FILE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

export const isAllowedEmail = (email: string) =>
  email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
