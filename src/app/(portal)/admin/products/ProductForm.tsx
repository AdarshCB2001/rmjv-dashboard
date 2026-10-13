"use client";

import { useActionState, useState } from "react";
import type { Product } from "@/lib/types";
import { Card, Field, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { saveProduct, type ActionState } from "../actions";

/**
 * Add/edit form for one catalog product. Used both for the "new product" card and,
 * collapsed, for each existing row.
 */
export function ProductForm({
  product,
  collapsible = false,
}: {
  product?: Product;
  collapsible?: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveProduct, {});
  const [open, setOpen] = useState(!collapsible);

  const id = product?.id ?? "new";

  if (collapsible && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-accent hover:underline"
      >
        Edit details
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor={`name-${id}`}>
          <input
            id={`name-${id}`}
            name="name"
            required
            defaultValue={product?.name ?? ""}
            placeholder="UV Stickers"
            className={inputClass}
          />
        </Field>
        <Field label="Unit" htmlFor={`unit-${id}`} hint="How the price is quoted">
          <input
            id={`unit-${id}`}
            name="unit"
            defaultValue={product?.unit ?? ""}
            placeholder="per 100 pcs"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Description" htmlFor={`desc-${id}`}>
        <textarea
          id={`desc-${id}`}
          name="description"
          rows={2}
          defaultValue={product?.description ?? ""}
          placeholder="Material, finish, durability — whatever RMJV needs to pick the right one."
          className={inputClass}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Price (₹)" htmlFor={`price-${id}`} hint="Excluding GST">
          <input
            id={`price-${id}`}
            name="base_price"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={product?.base_price ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="GST %" htmlFor={`gst-${id}`}>
          <input
            id={`gst-${id}`}
            name="gst_rate"
            type="number"
            min={0}
            max={28}
            step="0.01"
            required
            defaultValue={product?.gst_rate ?? 18}
            className={inputClass}
          />
        </Field>
        <Field label="HSN code" htmlFor={`hsn-${id}`} hint="Shown on the invoice">
          <input
            id={`hsn-${id}`}
            name="hsn_code"
            defaultValue={product?.hsn_code ?? ""}
            placeholder="4911"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Image URL" htmlFor={`img-${id}`} hint="Optional — a tinted tile is used if blank">
        <input
          id={`img-${id}`}
          name="image_url"
          type="url"
          defaultValue={product?.image_url ?? ""}
          placeholder="https://…"
          className={inputClass}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-body">
        <input
          type="checkbox"
          name="active"
          defaultChecked={product?.active ?? true}
          className="h-4 w-4 rounded border-line-strong"
        />
        Visible in the RMJV catalog
      </label>

      <FormMessage state={state} />

      <div className="flex gap-2">
        <SubmitButton>{product ? "Save product" : "Add product"}</SubmitButton>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Close
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function NewProductCard() {
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-semibold text-ink">Add a product</h2>
      <ProductForm />
    </Card>
  );
}
