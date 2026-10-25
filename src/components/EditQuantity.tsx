"use client";

import { useState, useTransition } from "react";
import { isValidQuantity } from "@/lib/packs";
import { btn, inputClass } from "./ui";
import { updateItemQuantity } from "@/app/(portal)/orders/[id]/actions";

/** Inline quantity editor for an item on a still-pending order. */
export function EditQuantity({
  orderId,
  itemId,
  quantity,
  pack,
}: {
  orderId: string;
  itemId: string;
  quantity: number;
  pack: number;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(quantity);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const valid = isValidQuantity(value, pack);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(quantity);
          setError(null);
          setOpen(true);
        }}
        className="text-xs font-medium text-accent hover:underline"
      >
        Edit quantity
      </button>
    );
  }

  const save = () =>
    startTransition(async () => {
      const result = await updateItemQuantity(orderId, itemId, value);
      if (result.error) setError(result.error);
      else setOpen(false);
    });

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-surface-2 p-3">
      <label htmlFor={`edit-qty-${itemId}`} className="block text-xs font-medium text-ink">
        Quantity
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`edit-qty-${itemId}`}
          type="number"
          min={pack}
          step={pack}
          value={value}
          onChange={(e) => setValue(Math.floor(Number(e.target.value)) || 0)}
          className={`${inputClass} max-w-32`}
        />
        <button type="button" onClick={save} disabled={!valid || pending} className={btn("primary")}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btn("ghost")}>
          Cancel
        </button>
      </div>
      {pack > 1 ? (
        <p className={valid ? "text-xs text-muted" : "text-xs font-medium text-danger"}>
          Minimum {pack}, in multiples of {pack} (one sheet)
        </p>
      ) : null}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}
