import type { Metadata } from "next";
import { ALLOWED_EMAIL_DOMAIN, DEMO_MODE } from "@/lib/config";
import { listAllowedUsers } from "@/lib/data/users";
import { Card, Notice } from "@/components/ui";
import { DemoSignInForm, MagicLinkForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  domain: `Access is limited to @${ALLOWED_EMAIL_DOMAIN} accounts.`,
  "not-listed":
    "That address isn't set up for this portal. Ask FunKustoms to add you to the allow-list.",
  "link-invalid": "That sign-in link has expired or was already used. Request a new one.",
  "not-configured": "This deployment isn't connected to Supabase yet.",
  "admin-only": "That area is for FunKustoms staff only.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  // In demo mode the seeded allow-list doubles as the account picker.
  const demoUsers = DEMO_MODE ? await listAllowedUsers() : [];

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span
            aria-hidden
            className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-sm font-bold text-on-accent"
          >
            FK
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">RMJV Portal</h1>
          <p className="mt-1.5 text-sm text-muted">
            Reorder print jobs, upload artwork, pay and track — all in one place.
          </p>
        </div>

        <Card className="p-6">
          {error && ERRORS[error] ? (
            <div className="mb-5">
              <Notice tone="danger">{ERRORS[error]}</Notice>
            </div>
          ) : null}

          {DEMO_MODE ? (
            <div className="space-y-5">
              <Notice tone="warning" title="Demo mode">
                Supabase isn&apos;t configured, so the portal is running on seeded sample data
                held in memory. Pick an account below to look around — no email needed. Add your
                Supabase keys to <code className="font-mono text-xs">.env.local</code> to switch
                on the real magic-link sign-in.
              </Notice>
              <DemoSignInForm users={demoUsers} next={safeNext} />
            </div>
          ) : (
            <MagicLinkForm domain={ALLOWED_EMAIL_DOMAIN} next={safeNext} />
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-faint">
          FunKustoms · {new Date().getFullYear()}
        </p>
      </div>
    </main>
  );
}
