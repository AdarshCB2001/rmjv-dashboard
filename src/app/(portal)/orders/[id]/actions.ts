"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { getOrder, setItemQuantity, updateOrderAdmin } from "@/lib/data/orders";
import { packSizes } from "@/lib/catalog";
import { isValidQuantity } from "@/lib/packs";
import { HAS_PM_SYNC, pushOrderToPm } from "@/lib/pm-sync";

/**
 * Customer confirms their own pending order — no payment involved. Scoped to the
 * caller's email, so someone else's order id is "not found" rather than editable.
 */
export async function confirmOrder(orderId: string): Promise<void> {
  const session = await requireSession();
  const order = await getOrder(orderId, session.email);
  if (!order || order.status !== "pending") return;
  await updateOrderAdmin(orderId, { status: "confirmed" });
  if (HAS_PM_SYNC) {
    // The order is confirmed either way; a PM outage must not undo the customer's click.
    try {
      await updateOrderAdmin(orderId, { pm_task_id: await pushOrderToPm(order) });
    } catch (error) {
      console.error("[pm-sync] could not create the PM task for", order.order_number, error);
    }
  }
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/dashboard");
}

/** Customer edits a line's quantity while the order is still pending. Re-validates server-side. */
export async function updateItemQuantity(
  orderId: string,
  itemId: string,
  quantity: number,
): Promise<{ error?: string }> {
  const session = await requireSession();
  const order = await getOrder(orderId, session.email);
  if (!order) return { error: "Order not found." };
  if (order.status !== "pending") return { error: "This order is already confirmed and can't be edited." };

  const item = order.items?.find((i) => i.id === itemId);
  if (!item) return { error: "Item not found." };

  const pack = packSizes().get(item.product?.name ?? "") ?? 1;
  if (!isValidQuantity(quantity, pack) || quantity > 100_000) {
    return { error: pack > 1 ? `Quantity must be a multiple of ${pack}.` : "Enter a valid quantity." };
  }

  await setItemQuantity(orderId, itemId, quantity);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return {};
}
