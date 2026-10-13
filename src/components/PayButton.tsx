"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { btn, Notice } from "./ui";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = { open: () => void; close: () => void };
type RazorpayOptions = Record<string, unknown>;

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

/** Injects the hosted checkout script once and resolves when it's usable. */
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("load failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment window."));
    document.head.appendChild(script);
  });
}

type Props = {
  orderId: string;
  orderNumber: string;
  email: string;
  fullName: string | null;
  /** Open the payment sheet as soon as the page loads (arriving from checkout). */
  autoOpen?: boolean;
};

/**
 * Opens Razorpay's hosted checkout, so no card data ever touches this app.
 *
 * When Razorpay keys aren't configured the server returns `simulated: true` and we
 * settle the order through a dev-only endpoint instead — that keeps the whole flow
 * walkable in demo mode without pretending a real payment happened.
 */
export function PayButton({ orderId, orderNumber, email, fullName, autoOpen = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoOpened = useRef(false);

  const pay = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const created = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await created.json();
      if (!created.ok) throw new Error(data?.error ?? "Could not start the payment.");

      if (data.simulated) {
        const settled = await fetch("/api/payments/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const settledData = await settled.json();
        if (!settled.ok) throw new Error(settledData?.error ?? "Could not settle the order.");
        router.refresh();
        return;
      }

      await loadCheckout();
      if (!window.Razorpay) throw new Error("The payment window is unavailable.");

      const rzp = new window.Razorpay({
        key: data.keyId,
        order_id: data.razorpayOrderId,
        amount: data.amount,
        currency: data.currency,
        name: "FunKustoms",
        description: `Order ${orderNumber}`,
        prefill: { email, name: fullName ?? undefined },
        theme: { color: "#5b4be8" },
        handler: async (response: RazorpayHandlerResponse) => {
          // The order is only marked paid after the server verifies this signature.
          const verified = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, ...response }),
          });
          if (!verified.ok) {
            const body = await verified.json().catch(() => null);
            setError(
              body?.error ??
                "We couldn't confirm that payment. Don't pay again — message us in chat and we'll check.",
            );
            setBusy(false);
            return;
          }
          router.refresh();
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });

      rzp.open();
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong starting the payment.");
    }
    setBusy(false);
    // The amount is intentionally not a prop — /api/payments/create recomputes it
    // from the stored order, so the client can't influence what is charged.
  }, [orderId, orderNumber, email, fullName, router]);

  useEffect(() => {
    if (autoOpen && !autoOpened.current) {
      autoOpened.current = true;
      void pay();
    }
  }, [autoOpen, pay]);

  return (
    <div className="space-y-3">
      <button type="button" onClick={pay} disabled={busy} className={btn("primary", "w-full")}>
        {busy ? "Opening payment…" : "Pay now"}
      </button>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  );
}
