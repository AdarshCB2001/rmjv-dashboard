"use client";

import { useActionState } from "react";
import type { AllowedUser } from "@/lib/types";
import { Card, Field, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { addStaff, toggleStaffActive, type ActionState } from "../actions";

export function AddStaffCard({ domain }: { domain: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addStaff, {});

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-ink">Give someone access</h2>
      <p className="mt-1 mb-4 text-sm text-muted">
        Sign-in needs both: an @{domain} address <em>and</em>{" "}a row here. Adding someone
        doesn&apos;t email them — they request their own magic link.
      </p>

      <form action={action} className="space-y-3">
        <Field label="Email" htmlFor="staff-email">
          <input
            id="staff-email"
            name="email"
            type="email"
            required
            placeholder={`name@${domain}`}
            className={inputClass}
          />
        </Field>
        <Field label="Name" htmlFor="staff-name" hint="Optional — shown in the portal and chat">
          <input id="staff-name" name="full_name" className={inputClass} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-body">
          <input type="checkbox" name="is_admin" className="h-4 w-4 rounded border-line-strong" />
          FunKustoms admin (can see every order and edit the catalog)
        </label>

        <FormMessage state={state} />
        <SubmitButton>Add to allow-list</SubmitButton>
      </form>
    </Card>
  );
}

export function StaffRow({ user, isSelf }: { user: AllowedUser; isSelf: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(toggleStaffActive, {});

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {user.full_name ?? user.email}
          {isSelf ? <span className="ml-1.5 text-xs font-normal text-muted">(you)</span> : null}
        </p>
        <p className="truncate text-xs text-muted">{user.email}</p>
        {state.error ? <p className="mt-1 text-xs text-danger">{state.error}</p> : null}
      </div>

      <div className="flex items-center gap-2">
        {user.is_admin ? (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
            Admin
          </span>
        ) : null}
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            user.active ? "bg-positive-soft text-positive" : "bg-surface-2 text-muted"
          }`}
        >
          {user.active ? "Active" : "Revoked"}
        </span>

        <form action={action}>
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="email" value={user.email} />
          <input type="hidden" name="active" value={user.active ? "false" : "true"} />
          <SubmitButton
            variant={user.active ? "danger" : "secondary"}
            pendingLabel="…"
            className="px-2.5 py-1 text-xs"
          >
            {user.active ? "Revoke" : "Restore"}
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
