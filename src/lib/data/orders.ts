import { DEMO_MODE } from "@/lib/config";
import { clone, db, demoId } from "@/lib/demo/store";
import { adminSupabase, serverSupabase } from "@/lib/supabase/server";
import { orderTotals } from "@/lib/money";
import type {
  DraftLine,
  Invoice,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Product,
} from "@/lib/types";
import { pullStages } from "@/lib/pm-sync";
import { issueInvoices } from "@/lib/swipe";

const ORDER_SELECT = "*, items:order_items(*, product:products(*)), invoice:invoices(*)";

type RawOrder = Omit<Order, "invoice"> & { invoice?: Invoice[] | Invoice | null };

/**
 * Supabase returns an embedded one-to-one as an object or a single-element array
 * depending on how it infers the relationship; normalise both to `Invoice | null`.
 */
function normalise(row: RawOrder): Order {
  const invoice = Array.isArray(row.invoice) ? (row.invoice[0] ?? null) : (row.invoice ?? null);
  const items = (row.items ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { ...row, invoice, items };
}

/** Assembles an order from the demo store the same shape the Supabase join produces. */
function demoOrder(order: Order): Order {
  const store = db();
  const products = new Map(store.products.map((p) => [p.id, p]));
  const items = store.order_items
    .filter((i) => i.order_id === order.id)
    .map((i) => ({ ...i, product: products.get(i.product_id) ?? null }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const invoice = store.invoices.find((inv) => inv.order_id === order.id) ?? null;
  return clone({ ...order, items, invoice });
}

const newestFirst = (a: Order, b: Order) => b.created_at.localeCompare(a.created_at);

export const listOrders = async (userEmail: string) => syncStages(await listOrdersRaw(userEmail));
export const listAllOrders = async () => syncStages(await listAllOrdersRaw());
export async function getOrder(id: string, userEmail: string | null): Promise<Order | null> {
  const order = await getOrderRaw(id, userEmail);
  return order ? (await syncStages([order]))[0] : null;
}

/** Applies project-management stage changes to linked orders and saves what changed. */
async function syncStages(orders: Order[]): Promise<Order[]> {
  const { orders: next, changes } = await pullStages(orders);
  for (const c of changes) await updateOrderAdmin(c.id, c.patch);
  return issueInvoices(next, (id, patch) => updateOrderAdmin(id, patch));
}

async function listOrdersRaw(userEmail: string): Promise<Order[]> {
  if (DEMO_MODE) {
    return db()
      .orders.filter((o) => o.user_email === userEmail)
      .map(demoOrder)
      .sort(newestFirst);
  }

  const supabase = await serverSupabase();
  if (!supabase) return [];
  // RLS already restricts to the caller's rows; the filter is belt-and-braces.
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("user_email", userEmail)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RawOrder[]).map(normalise);
}

/** Admin view — every order, regardless of owner. Requires `requireAdmin()`. */
async function listAllOrdersRaw(): Promise<Order[]> {
  if (DEMO_MODE) return db().orders.map(demoOrder).sort(newestFirst);

  const supabase = adminSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for the admin order list.");
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RawOrder[]).map(normalise);
}

/**
 * Fetches one order. Pass `userEmail` for customer access (returns null for someone
 * else's order) or `null` for admin access.
 */
async function getOrderRaw(id: string, userEmail: string | null): Promise<Order | null> {
  if (DEMO_MODE) {
    const order = db().orders.find((o) => o.id === id);
    if (!order) return null;
    if (userEmail && order.user_email !== userEmail) return null;
    return demoOrder(order);
  }

  const supabase = userEmail ? await serverSupabase() : adminSupabase();
  if (!supabase) return null;

  let query = supabase.from("orders").select(ORDER_SELECT).eq("id", id);
  if (userEmail) query = query.eq("user_email", userEmail);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? normalise(data as RawOrder) : null;
}

/**
 * Resolves an order-line id to the order that contains it, scoped to the caller.
 *
 * Returns null when the line belongs to someone else, which is how the upload routes
 * establish that you may write against a given order item.
 */
export async function findOrderByItem(
  orderItemId: string,
  userEmail: string,
): Promise<Order | null> {
  if (DEMO_MODE) {
    const store = db();
    const item = store.order_items.find((i) => i.id === orderItemId);
    if (!item) return null;
    const order = store.orders.find((o) => o.id === item.order_id);
    if (!order || order.user_email !== userEmail) return null;
    return demoOrder(order);
  }

  const supabase = await serverSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("order_items")
    .select("order_id, orders!inner(user_email)")
    .eq("id", orderItemId)
    .eq("orders.user_email", userEmail)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getOrder(data.order_id as string, userEmail);
}

/**
 * The most recent spec this user ordered for a product — quantity and notes.
 * Powers the "Reorder last spec" button, which is the whole point of the portal for
 * repeat orders.
 */
export async function lastSpecFor(
  userEmail: string,
  productId: string,
): Promise<{ quantity: number; notes: string } | null> {
  if (DEMO_MODE) {
    const store = db();
    const ownOrderIds = new Set(
      store.orders.filter((o) => o.user_email === userEmail).map((o) => o.id),
    );
    const item = store.order_items
      .filter((i) => i.product_id === productId && ownOrderIds.has(i.order_id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return item ? { quantity: item.quantity, notes: item.notes ?? "" } : null;
  }

  const supabase = await serverSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("order_items")
    .select("quantity, notes, created_at, orders!inner(user_email)")
    .eq("product_id", productId)
    .eq("orders.user_email", userEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { quantity: data.quantity as number, notes: (data.notes as string | null) ?? "" };
}

/** Last spec for every product this user has ever ordered, in one round trip. */
export async function lastSpecMap(
  userEmail: string,
): Promise<Map<string, { quantity: number; notes: string }>> {
  const result = new Map<string, { quantity: number; notes: string }>();

  if (DEMO_MODE) {
    const store = db();
    const ownOrderIds = new Set(
      store.orders.filter((o) => o.user_email === userEmail).map((o) => o.id),
    );
    for (const item of store.order_items
      .filter((i) => ownOrderIds.has(i.order_id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      // Ascending order means later writes overwrite earlier ones, leaving the newest.
      result.set(item.product_id, { quantity: item.quantity, notes: item.notes ?? "" });
    }
    return result;
  }

  const supabase = await serverSupabase();
  if (!supabase) return result;
  const { data, error } = await supabase
    .from("order_items")
    .select("product_id, quantity, notes, created_at, orders!inner(user_email)")
    .eq("orders.user_email", userEmail)
    .order("created_at", { ascending: true });
  if (error) throw error;
  for (const row of data ?? []) {
    result.set(row.product_id as string, {
      quantity: row.quantity as number,
      notes: (row.notes as string | null) ?? "",
    });
  }
  return result;
}

/**
 * Creates an order from draft lines.
 *
 * Prices are read from the catalog server-side and snapshotted onto the line items —
 * the client never gets to say what something costs, and a later catalog price change
 * doesn't rewrite history.
 */
export async function createOrder(userEmail: string, lines: DraftLine[]): Promise<Order> {
  const clean = lines.filter((l) => l.quantity > 0);
  if (clean.length === 0) throw new Error("Your cart is empty.");

  if (DEMO_MODE) {
    const store = db();
    const products = new Map(store.products.filter((p) => p.active).map((p) => [p.id, p]));
    for (const l of clean) {
      if (!products.has(l.product_id)) throw new Error("A product in your cart is unavailable.");
    }

    const orderId = demoId("o");
    const now = new Date().toISOString();
    const items: OrderItem[] = clean.map((l) => {
      const p = products.get(l.product_id)!;
      return {
        id: demoId("oi"),
        order_id: orderId,
        product_id: p.id,
        quantity: l.quantity,
        unit_price: p.base_price,
        gst_rate: p.gst_rate,
        notes: l.notes,
        file_url: null,
        file_name: null,
        file_version: 0,
        created_at: now,
      };
    });
    const totals = orderTotals(items);
    store.orderSeq += 1;
    const order: Order = {
      id: orderId,
      order_number: `RMJV-${String(store.orderSeq).padStart(4, "0")}`,
      user_email: userEmail,
      status: "pending",
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total_amount: totals.total,
      payment_status: "unpaid",
      payment_id: null,
      razorpay_order_id: null,
      tracking_number: null,
      courier: null,
      notes: null,
      created_at: now,
      updated_at: now,
    };
    store.orders.push(order);
    store.order_items.push(...items);
    return demoOrder(order);
  }

  const supabase = await serverSupabase();
  if (!supabase) throw new Error("Not connected to Supabase.");

  const { data: productRows, error: productError } = await supabase
    .from("products")
    .select("*")
    .in(
      "id",
      clean.map((l) => l.product_id),
    )
    .eq("active", true);
  if (productError) throw productError;

  const products = new Map((productRows as Product[]).map((p) => [p.id, p]));
  if (products.size !== new Set(clean.map((l) => l.product_id)).size) {
    throw new Error("A product in your cart is no longer available.");
  }

  const priced = clean.map((l) => {
    const p = products.get(l.product_id)!;
    return {
      product_id: p.id,
      quantity: l.quantity,
      unit_price: p.base_price,
      gst_rate: p.gst_rate,
      notes: l.notes,
    };
  });
  const totals = orderTotals(
    priced.map((p) => ({ ...p, id: "", order_id: "", file_url: null, file_name: null, file_version: 0, created_at: "" })),
  );

  const { data: orderNumber, error: seqError } = await supabase.rpc("next_order_number");
  if (seqError) throw seqError;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber as string,
      user_email: userEmail,
      status: "pending",
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total_amount: totals.total,
      payment_status: "unpaid",
    })
    .select("id")
    .single();
  if (orderError) throw orderError;

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(priced.map((p) => ({ ...p, order_id: order.id, file_version: 0 })));
  if (itemsError) {
    // Don't leave a payable order with no lines behind.
    await supabase.from("orders").delete().eq("id", order.id);
    throw itemsError;
  }

  const created = await getOrder(order.id as string, userEmail);
  if (!created) throw new Error("Order was created but could not be read back.");
  return created;
}

/** Changes one line's quantity and re-totals the order. Callers check ownership and status. */
export async function setItemQuantity(orderId: string, itemId: string, quantity: number): Promise<void> {
  const retotal = (items: OrderItem[]) => {
    const t = orderTotals(items);
    return { subtotal: t.subtotal, tax_amount: t.taxAmount, total_amount: t.total };
  };

  if (DEMO_MODE) {
    const store = db();
    const item = store.order_items.find((i) => i.id === itemId && i.order_id === orderId);
    const order = store.orders.find((o) => o.id === orderId);
    if (!item || !order) throw new Error("Item not found");
    item.quantity = quantity;
    Object.assign(order, retotal(store.order_items.filter((i) => i.order_id === orderId)), {
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const supabase = adminSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to edit orders.");
  const { error } = await supabase
    .from("order_items")
    .update({ quantity })
    .eq("id", itemId)
    .eq("order_id", orderId);
  if (error) throw error;
  const { data, error: readError } = await supabase.from("order_items").select("*").eq("order_id", orderId);
  if (readError) throw readError;
  const { error: totalError } = await supabase
    .from("orders")
    .update({ ...retotal(data as OrderItem[]), updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (totalError) throw totalError;
}


export type OrderAdminPatch = {
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  pm_task_id?: string | null;
  swipe_hash_id?: string | null;
  swipe_invoice_number?: string | null;
  tracking_number?: string | null;
  courier?: string | null;
  notes?: string | null;
};

/** Admin only — status and tracking updates. */
export async function updateOrderAdmin(orderId: string, patch: OrderAdminPatch): Promise<void> {
  if (DEMO_MODE) {
    const order = db().orders.find((o) => o.id === orderId);
    if (!order) throw new Error("Order not found");
    Object.assign(order, patch, { updated_at: new Date().toISOString() });
    return;
  }

  const supabase = adminSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to update orders.");
  const { error } = await supabase
    .from("orders")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw error;
}
