import type { Metadata } from "next";
import { MadeBy } from "@/components/MadeBy";
import { ALLOWED_EMAIL_DOMAIN, DEMO_LOCKED, DEMO_MODE } from "@/lib/config";
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
          <div className="mb-5 flex items-center justify-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/spintly-logo.png" alt="Spintly" className="h-14 w-auto" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Spintly Order Portal</h1>
          <p className="mt-1.5 text-sm text-muted">
            Order print jobs, upload artwork and track delivery — all in one place.
          </p>
        </div>

        <Card className="p-6">
          {error && ERRORS[error] ? (
            <div className="mb-5">
              <Notice tone="danger">{ERRORS[error]}</Notice>
            </div>
          ) : null}

          {DEMO_LOCKED ? (
            <Notice tone="danger" title="Sign-in isn't set up">
              This deployment isn&apos;t connected to Supabase yet, so nobody can sign in. Please contact
              FunKustoms.
            </Notice>
          ) : DEMO_MODE ? (
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

        <div className="mt-6">
          <MadeBy />
        </div>
      </div>
    </main>
  );
}
