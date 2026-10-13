"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { Product } from "@/lib/types";
import { formatINR, lineTotals, round2 } from "@/lib/money";
import {
  btn,
  Card,
  DescriptionRow,
  EmptyState,
  inputClass,
  Notice,
  ProductThumb,
} from "@/components/ui";
import { useCart } from "@/components/cart/CartProvider";
import { placeOrder } from "./actions";

export function CartView({ products }: { products: Product[] }) {
  const { lines, ready, setLine, removeLine, clear } = useCart();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const catalog = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // A product can be retired between adding it and checking out.
  const priced = lines.flatMap((line) => {
    const product = catalog.get(line.productId);
    if (!product) return [];
    return [{ line, product, totals: lineTotals(product.base_price, line.quantity, product.gst_rate) }];
  });
  const missing = lines.filter((l) => !catalog.has(l.productId));

  const subtotal = round2(priced.reduce((s, p) => s + p.totals.taxable, 0));
  const tax = round2(priced.reduce((s, p) => s + p.totals.taxAmount, 0));
  const total = round2(subtotal + tax);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await placeOrder(priced.map((p) => p.line));
      if (result.error || !result.orderId) {
        setError(result.error ?? "Could not place the order.");
        return;
      }
      clear();
      // Land on the order with the payment sheet primed.
      router.push(`/orders/${result.orderId}?pay=1`);
    });
  };

  if (!ready) {
    return <div className="h-32 animate-pulse rounded-card bg-surface-2" aria-hidden />;
  }

  if (priced.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Pick products from the catalog — anything you've ordered before can be reordered at the same spec in one click."
        action={
          <Link href="/products" className={btn("primary")}>
            Browse catalog
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <ul className="space-y-3">
        {missing.length > 0 ? (
          <li>
            <Notice tone="warning">
              {missing.length === 1 ? "An item" : `${missing.length} items`} in your cart{" "}
              {missing.length === 1 ? "is" : "are"} no longer in the catalog and{" "}
              {missing.length === 1 ? "was" : "were"} left out of this order.
            </Notice>
          </li>
        ) : null}

        {priced.map(({ line, product, totals }) => (
          <Card as="li" key={line.productId} className="overflow-hidden p-4">
            <div className="flex gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                <ProductThumb name={product.name} imageUrl={product.image_url} />
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-medium text-ink">{product.name}</h2>
                    <p className="text-xs text-muted">
                      {formatINR(product.base_price)} {product.unit ?? "per unit"} · +
                      {product.gst_rate}% GST
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.productId)}
                    className="text-xs font-medium text-muted hover:text-danger"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
                  <div className="space-y-1">
                    <label
                      htmlFor={`cart-qty-${line.productId}`}
                      className="block text-xs font-medium text-ink"
                    >
                      Quantity
                    </label>
                    <input
                      id={`cart-qty-${line.productId}`}
                      type="number"
                      min={1}
                      step={1}
                      value={line.quantity}
                      onChange={(e) =>
                        setLine(line.productId, {
                          quantity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor={`cart-notes-${line.productId}`}
                      className="block text-xs font-medium text-ink"
                    >
                      Spec notes
                    </label>
                    <input
                      id={`cart-notes-${line.productId}`}
                      type="text"
                      value={line.notes}
                      placeholder="Colours, sizes, finish…"
                      onChange={(e) => setLine(line.productId, { notes: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <p className="text-right text-sm font-medium text-ink nums">
                  {formatINR(totals.total)}
                  <span className="ml-1.5 text-xs font-normal text-muted">incl. GST</span>
                </p>
              </div>
            </div>
          </Card>
        ))}
      </ul>

      <Card className="p-5 lg:sticky lg:top-20">
        <h2 className="font-semibold text-ink">Order summary</h2>
        <dl className="mt-3 divide-y divide-line">
          <DescriptionRow label="Taxable value">
            <span className="nums">{formatINR(subtotal)}</span>
          </DescriptionRow>
          <DescriptionRow label="GST">
            <span className="nums">{formatINR(tax)}</span>
          </DescriptionRow>
          <DescriptionRow label="Total">
            <span className="text-base nums">{formatINR(total)}</span>
          </DescriptionRow>
        </dl>

        {error ? (
          <div className="mt-4">
            <Notice tone="danger">{error}</Notice>
          </div>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className={btn("primary", "mt-5 w-full")}
        >
          {pending ? "Placing order…" : "Place order"}
        </button>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          You&apos;ll pay and upload artwork on the next screen. Nothing goes to production
          until payment clears.
        </p>

        <button
          type="button"
          onClick={clear}
          className="mt-4 w-full text-xs font-medium text-muted hover:text-danger"
        >
          Empty cart
        </button>
      </Card>
    </div>
  );
}
