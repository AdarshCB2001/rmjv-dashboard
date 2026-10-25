"use server";

import { requireSession } from "@/lib/auth";
import { createOrder } from "@/lib/data/orders";
import { listProducts } from "@/lib/data/products";
import { isValidQuantity } from "@/lib/packs";
import type { CartLine } from "@/lib/types";

export type PlaceOrderResult = { orderId?: string; error?: string };

/**
 * Turns the client-side cart into a real order.
 *
 * The client sends product ids, quantities and notes only — never prices. `createOrder`
 * reads the price from the catalog server-side, so a tampered payload can't discount
 * anything. Auth is checked here rather than relying on the proxy, since server
 * functions are POSTs to the calling route and can fall outside the proxy matcher.
 */
export async function placeOrder(lines: CartLine[]): Promise<PlaceOrderResult> {
  const session = await requireSession();

  if (!Array.isArray(lines) || lines.length === 0) {
    return { error: "Your cart is empty." };
  }

  const draft = lines
    .filter((l) => typeof l?.productId === "string")
    .map((l) => ({
      product_id: l.productId,
      // Clamp rather than trust: quantity comes from a number input the user controls.
      quantity: Math.min(100_000, Math.max(1, Math.floor(Number(l.quantity) || 0))),
      notes: l.notes?.trim() ? l.notes.trim().slice(0, 2000) : null,
    }));

  if (draft.length === 0) return { error: "Your cart is empty." };

  const products = new Map((await listProducts()).map((p) => [p.id, p]));
  for (const l of draft) {
    const p = products.get(l.product_id);
    const pack = p?.pack_size ?? 1;
    if (p && !isValidQuantity(l.quantity, pack)) {
      return { error: `${p.name} is sold in multiples of ${pack} (one sheet). Adjust the quantity.` };
    }
  }

  try {
    const order = await createOrder(session.email, draft);
    return { orderId: order.id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not place the order. Try again.",
    };
  }
}
