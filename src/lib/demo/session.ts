import type { Session } from "@/lib/types";

/**
 * Signed cookie session for demo mode only.
 *
 * Uses Web Crypto so the same code runs in middleware (edge) and in route handlers
 * (node). It is HMAC-signed rather than plaintext so you can't hand yourself
 * `is_admin` by editing a cookie value, but it is still a demo shim — real mode uses
 * Supabase Auth and never touches this file.
 */

export const DEMO_COOKIE = "rmjv_demo_session";

const SECRET =
  process.env.DEMO_SESSION_SECRET ?? "rmjv-demo-only-secret-do-not-use-in-production";

const enc = new TextEncoder();

const b64url = (s: string) =>
  btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const unb64url = (s: string) => {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
};

async function hmacHex(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Length-safe comparison that doesn't leak the mismatch position via early return. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(session: Session): Promise<string> {
  const body = b64url(JSON.stringify(session));
  return `${body}.${await hmacHex(body)}`;
}

export async function readSession(raw: string | undefined): Promise<Session | null> {
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  if (!timingSafeEqual(sig, await hmacHex(body))) return null;
  try {
    const parsed = JSON.parse(unb64url(body)) as Session;
    if (typeof parsed?.email !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
