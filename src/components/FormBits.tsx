"use client";

import { useFormStatus } from "react-dom";
import { btn, Notice } from "./ui";

/** Submit button that reflects the enclosing form's pending state. */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  className,
}: {
  children: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btn(variant, className)}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ state }: { state: { error?: string; ok?: string } }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.ok) return <Notice tone="positive">{state.ok}</Notice>;
  return null;
}
