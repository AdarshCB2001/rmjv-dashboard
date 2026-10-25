"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btn, inputClass } from "@/components/ui";
import { isValidQuantity } from "@/lib/packs";
import { useCart } from "./CartProvider";

type Props = {
  productId: string;
  unit: string | null;
  /** Minimum order quantity; quantity must be a multiple of it. */
  pack?: number;
  /** Quantity and notes from this user's most recent order of this product. */
  lastSpec: { quantity: number; notes: string } | null;
};

/**
 * The catalog card's ordering control.
 *
 * When the user has ordered this product before, the primary action is a one-click
 * "Reorder last spec" that carries the previous quantity and notes across — the whole
 * point of the portal for repeat orders. Editing is available behind a disclosure so
 * the common path stays one click.
 */
export function AddToCart({ productId, unit, pack = 1, lastSpec }: Props) {
  const { addLine, lines } = useCart();
  const router = useRouter();

  const inCart = lines.find((l) => l.productId === productId);
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(
    lastSpec && isValidQuantity(lastSpec.quantity, pack) ? lastSpec.quantity : pack,
  );
  const valid = isValidQuantity(quantity, pack);
  const [notes, setNotes] = useState(lastSpec?.notes ?? "");
  const [justAdded, setJustAdded] = useState(false);

  const add = (line: { quantity: number; notes: string }) => {
    if (!isValidQuantity(line.quantity, pack)) return;
    addLine({ productId, quantity: line.quantity, notes: line.notes });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2000);
    setOpen(false);
  };

  const label = inCart
    ? `Update cart (${inCart.quantity})`
    : lastSpec
      ? "Reorder last spec"
      : "Add to cart";

  return (
    <div className="space-y-3">
      {!open ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!valid}
            className={btn("primary", "flex-1")}
            onClick={() => add({ quantity, notes })}
          >
            {justAdded ? "Added ✓" : label}
          </button>
          <button type="button" className={btn("secondary")} onClick={() => setOpen(true)}>
            Edit
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg bg-surface-2 p-3">
          <div className="space-y-1.5">
            <label
              htmlFor={`qty-${productId}`}
              className="block text-xs font-medium text-ink"
            >
              Quantity {unit ? <span className="text-muted">({unit})</span> : null}
            </label>
            <input
              id={`qty-${productId}`}
              type="number"
              min={pack}
              step={pack}
              value={quantity}
              onChange={(e) => setQuantity(Math.floor(Number(e.target.value)) || 0)}
              className={inputClass}
            />
            {pack > 1 ? (
              <p className={valid ? "text-xs text-muted" : "text-xs font-medium text-danger"}>
                Minimum {pack}, in multiples of {pack} (one sheet)
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor={`notes-${productId}`}
              className="block text-xs font-medium text-ink"
            >
              Spec notes
            </label>
            <textarea
              id={`notes-${productId}`}
              rows={2}
              value={notes}
              placeholder="Colours, sizes, finish, anything we should know"
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!valid}
              className={btn("primary", "flex-1")}
              onClick={() => add({ quantity, notes })}
            >
              {inCart ? "Update cart" : "Add to cart"}
            </button>
            <button type="button" className={btn("ghost")} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {lastSpec && !open ? (
        <p className="text-xs text-muted">
          Last ordered: {lastSpec.quantity}
          {lastSpec.notes ? ` — ${lastSpec.notes}` : ""}
        </p>
      ) : null}

      {inCart && !open ? (
        <button
          type="button"
          onClick={() => router.push("/cart")}
          className="text-xs font-medium text-accent hover:underline"
        >
          Go to cart →
        </button>
      ) : null}
    </div>
  );
}
