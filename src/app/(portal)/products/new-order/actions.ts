"use server";

import { requireSession } from "@/lib/auth";
import { createOrder } from "@/lib/data/orders";
import { listProducts } from "@/lib/data/products";
import { CUSTOM_ORDER_NAME } from "@/lib/catalog";
import { ORDER_TYPES } from "@/lib/order-types";

export type NewOrderInput = {
  title: string;
  type: string;
  category: string;
  quantity: number;
  notes: string;
};
export type NewOrderResult = { orderId?: string; itemId?: string; error?: string };

/**
 * A free-form order (own artwork, any product type). It is a normal pending order for the
 * "Custom Order" placeholder product — no price yet; the team quotes it. The caller then
 * uploads the artwork against the returned item id, the same way an order line does.
 */
export async function placeCustomOrder(input: NewOrderInput): Promise<NewOrderResult> {
  const session = await requireSession();

  const title = String(input?.title ?? "").trim().slice(0, 80);
  if (!title) return { error: "Enter an order title." };

  const type = String(input?.type ?? "");
  if (!(ORDER_TYPES as readonly string[]).includes(type)) return { error: "Choose an order type." };

  const category = String(input.category ?? "").trim().slice(0, 60);
  if (type === "Others" && !category) return { error: "Enter a category name for this order." };

  const quantity = Math.floor(Number(input.quantity) || 0);
  if (quantity < 1 || quantity > 100_000) return { error: "Enter a valid quantity." };

  const product = (await listProducts()).find((p) => p.name === CUSTOM_ORDER_NAME);
  if (!product) return { error: "Custom orders aren't available right now." };

  const notes = [
    `Order title: ${title}`,
    `Order type: ${type}`,
    type === "Others" ? `Category: ${category}` : null,
    String(input.notes ?? "").trim().slice(0, 1500) || null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const order = await createOrder(session.email, [{ product_id: product.id, quantity, notes }]);
    return { orderId: order.id, itemId: order.items?.[0]?.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not place the order. Try again." };
  }
}
