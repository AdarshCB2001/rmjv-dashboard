"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { upsertProduct, type ProductInput } from "@/lib/data/products";
import { updateOrderAdmin } from "@/lib/data/orders";
import { addAllowedUser, updateAllowedUser } from "@/lib/data/users";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

export type ActionState = { error?: string; ok?: string };

/**
 * Every action here calls `requireAdmin()` first. Server functions are POSTs to
 * whatever route rendered the form, so proxy matchers are not a reliable gate for
 * them — the check has to live in the function itself.
 */

const text = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : null;
};

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const name = text(formData.get("name"));
  if (!name) return { error: "A product needs a name." };

  const basePrice = Number(formData.get("base_price"));
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return { error: "Enter a valid price." };
  }

  const gstRate = Number(formData.get("gst_rate"));
  if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 28) {
    return { error: "GST rate should be between 0 and 28." };
  }

  const input: ProductInput = {
    name,
    description: text(formData.get("description")),
    base_price: basePrice,
    unit: text(formData.get("unit")),
    hsn_code: text(formData.get("hsn_code")),
    gst_rate: gstRate,
    image_url: text(formData.get("image_url")),
    active: formData.get("active") === "on",
  };

  const id = text(formData.get("id"));

  try {
    await upsertProduct(input, id ?? undefined);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the product." };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: id ? `Updated ${name}.` : `Added ${name}.` };
}

export async function updateOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const orderId = text(formData.get("order_id"));
  if (!orderId) return { error: "Missing order." };

  const status = String(formData.get("status") ?? "");
  const valid: string[] = [...ORDER_STATUSES, "cancelled"];
  if (!valid.includes(status)) return { error: "Unknown status." };

  try {
    await updateOrderAdmin(orderId, {
      status: status as OrderStatus,
      courier: text(formData.get("courier")),
      tracking_number: text(formData.get("tracking_number")),
      notes: text(formData.get("notes")),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the order." };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: "Order updated." };
}

export async function addStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const email = text(formData.get("email"));
  if (!email) return { error: "Enter an email address." };

  try {
    await addAllowedUser({
      email,
      full_name: text(formData.get("full_name")),
      is_admin: formData.get("is_admin") === "on",
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add that person." };
  }

  revalidatePath("/admin/staff");
  return { ok: `${email} can now sign in.` };
}

export async function toggleStaffActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const id = text(formData.get("id"));
  const email = text(formData.get("email"));
  const active = formData.get("active") === "true";
  if (!id) return { error: "Missing staff member." };

  // Deactivating yourself would lock you out of the only screen that can undo it.
  if (email && email === admin.email && !active) {
    return { error: "You can't deactivate your own account." };
  }

  try {
    await updateAllowedUser(id, { active });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update access." };
  }

  revalidatePath("/admin/staff");
  return { ok: active ? "Access restored." : "Access revoked." };
}
