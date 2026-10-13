/**
 * Single source of truth for "which integrations are actually configured".
 *
 * Nothing in the app throws at import time because a key is missing. Instead each
 * subsystem degrades: no Supabase keys => demo mode (seeded in-memory data), no
 * Razorpay keys => simulated payment, no chat keys => no chat widget.
 */

const val = (v: string | undefined) => (v && v.trim().length > 0 ? v.trim() : undefined);

export const SUPABASE_URL = val(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = val(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** True when Supabase is wired up. When false the whole app runs on the demo store. */
export const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Demo mode is simply "Supabase is not configured". */
export const DEMO_MODE = !HAS_SUPABASE;

/** Only ever read on the server. */
export const SUPABASE_SERVICE_ROLE_KEY = val(process.env.SUPABASE_SERVICE_ROLE_KEY);

export const RAZORPAY_KEY_ID = val(process.env.RAZORPAY_KEY_ID);
export const RAZORPAY_KEY_SECRET = val(process.env.RAZORPAY_KEY_SECRET);
export const HAS_RAZORPAY = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

/** Set this in the Razorpay dashboard when you add the webhook endpoint. */
export const RAZORPAY_WEBHOOK_SECRET = val(process.env.RAZORPAY_WEBHOOK_SECRET);

/** Exposed to the browser so checkout can decide between real and simulated payment. */
export const PUBLIC_RAZORPAY_KEY_ID = val(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);

export const CRISP_WEBSITE_ID = val(process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID);
export const TAWK_PROPERTY_ID = val(process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID);
export const TAWK_WIDGET_ID = val(process.env.NEXT_PUBLIC_TAWK_WIDGET_ID) ?? "1i00000000";

export type ChatProvider = "crisp" | "tawk" | "none";
export const CHAT_PROVIDER: ChatProvider = CRISP_WEBSITE_ID
  ? "crisp"
  : TAWK_PROPERTY_ID
    ? "tawk"
    : "none";

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
