"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { btn, inputClass, Notice } from "@/components/ui";
import { demoSignIn, sendMagicLink, type LoginState } from "./actions";

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btn("primary", "w-full")}>
      {pending ? "Working…" : children}
    </button>
  );
}

export function MagicLinkForm({ domain, next }: { domain: string; next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(sendMagicLink, {});

  if (state.sent) {
    return (
      <Notice tone="positive" title="Check your inbox">
        We sent a sign-in link to <strong>{state.sent}</strong>. It expires in an hour — open it
        on this device to stay signed in here.
      </Notice>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder={`you@${domain}`}
          className={inputClass}
          aria-describedby="email-hint"
        />
        <p id="email-hint" className="text-xs text-muted">
          Only @{domain} addresses on the FunKustoms allow-list can sign in.
        </p>
      </div>

      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

      <SubmitButton>Email me a sign-in link</SubmitButton>
    </form>
  );
}

export function DemoSignInForm({
  users,
  next,
}: {
  users: { email: string; full_name: string | null; is_admin: boolean }[];
  next: string;
}) {
  const [state, action] = useActionState<LoginState, FormData>(demoSignIn, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <label htmlFor="demo-email" className="block text-sm font-medium text-ink">
          Sign in as
        </label>
        <select id="demo-email" name="email" className={inputClass} defaultValue={users[0]?.email}>
          {users.map((u) => (
            <option key={u.email} value={u.email}>
              {u.full_name ?? u.email} {u.is_admin ? "— admin" : ""}
            </option>
          ))}
        </select>
      </div>

      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

      <SubmitButton>Enter the demo</SubmitButton>
    </form>
  );
}
