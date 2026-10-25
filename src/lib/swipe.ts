import "server-only";
import { lineTotals, round2 } from "@/lib/money";
import type { Order } from "@/lib/types";

/**
 * GST invoices are issued on SWIPE (the accounting platform), not rendered here. When an
 * order reaches Shipped — i.e. the project management app moved it from Production to
 * Completed — `issueInvoices` creates the invoice on SWIPE and saves its id on the order;
 * the portal's "Download GST invoice" then streams SWIPE's own PDF.
 *
 * API: https://developers.getswipe.in (Bearer key, 1 request/second). Calls act on the live
 * SWIPE account, so an invoice is only ever created once per order (the hash id is stored).
 */

const API = "https://app.getswipe.in/api/partner/v2";
const KEY = process.env.SWIPE_API_KEY?.trim();
/**
 * API id of the existing SWIPE customer the portal bills (RMJV Innovations Private Limited),
 * linked to it once through SWIPE's customer-mapping endpoint. A new id would make SWIPE
 * create a duplicate customer.
 */
const CUSTOMER_ID = "rmjv-portal";
const CUSTOMER_NAME = process.env.SWIPE_CUSTOMER_NAME?.trim() || "RMJV Innovations Private Limited";
const CUSTOMER_GSTIN = process.env.SWIPE_CUSTOMER_GSTIN?.trim() || "30AAOCR9164M1ZS";

export const HAS_SWIPE = Boolean(KEY);

const ddmmyyyy = (d = new Date()) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" })
    .format(d)
    .replace(/\//g, "-");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SwipeResponse<T> = { success: boolean; message?: string; errors?: unknown; data?: T };

async function swipe<T>(path: string, init?: RequestInit): Promise<SwipeResponse<T>> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as SwipeResponse<T> | null;
  if (!res.ok || !json?.success) {
    throw new Error(`SWIPE ${res.status}: ${json?.message ?? "request failed"} ${JSON.stringify(json?.errors ?? {})}`);
  }
  return json;
}

/**
 * SWIPE already has one item per product family with a variant per model/size. Portal
 * products map onto those: the line carries the family's API id (linked to the SWIPE item
 * once, via the mapping endpoints) and the variant in its name, so invoices never create
 * a new SWIPE item per product. Line details apply to that invoice only.
 */
const FAMILIES = [
  { prefix: "Drill Templates", id: "rmjv-spintly-drill-templates", swipeId: "65", name: "Spintly Drill Templates" },
  { prefix: "One Page Manual", id: "rmjv-one-page-manual", swipeId: "109", name: "One Page Manual" },
  { prefix: "UV Stickers", id: "rmjv-uv-dtf-stickers", swipeId: "50", name: "UV DTF Stickers" },
] as const;
const FAMILY_HSN = "4821";

const DRILL_VARIANTS: [RegExp, string][] = [
  [/^fr 031/i, "FR 031"], [/^gateway/i, "Gateway"], [/^halo/i, "HALO"], [/^kreo/i, "KREO"],
  [/mesh/i, "Mesh IO"], [/^nuos/i, "Nuos"], [/^uno/i, "UNO"], [/^zeon/i, "ZEON"],
];

function swipeItem(productName: string): { id: string; name: string; hsn?: string } {
  const [category, ...rest] = productName.split(" — ");
  const variant = rest.join(" — ");
  const family = FAMILIES.find((f) => f.prefix === category);
  if (!family || !variant) {
    return { id: `rmjv-${productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, name: productName };
  }
  const label =
    family.prefix === "Drill Templates"
      ? (DRILL_VARIANTS.find(([re]) => re.test(variant))?.[1] ?? variant.replace(/ Drill Template$/i, ""))
      : family.prefix === "UV Stickers"
        ? variant.replace(/ Sheet$/i, " - Single")
        : variant === "FR Mobile"
          ? "Mobile FR"
          : variant;
  return { id: family.id, name: `${family.name} - ${label}`, hsn: FAMILY_HSN };
}

/** Creates the invoice for an order. Throws if a line has no price yet. */
async function createInvoice(order: Order): Promise<{ hashId: string; serial: string }> {
  const items = (order.items ?? []).map((i) => {
    const name = i.product?.name ?? "Item";
    if (!(i.unit_price > 0)) throw new Error(`${name} has no price yet`);
    const line = lineTotals(i.unit_price, i.quantity, i.gst_rate);
    const item = swipeItem(name);
    return {
      id: item.id,
      item_type: "Product",
      name: item.name,
      description: i.notes?.slice(0, 500) ?? undefined,
      quantity: i.quantity,
      unit_price: i.unit_price,
      tax_rate: i.gst_rate,
      price_with_tax: round2(i.unit_price * (1 + i.gst_rate / 100)),
      net_amount: line.taxable,
      total_amount: line.total,
      hsn_code: item.hsn ?? i.product?.hsn_code ?? "4911",
    };
  });
  if (items.length === 0) throw new Error("order has no items");

  const { data } = await swipe<{ hash_id: string; serial_number: string }>("/doc", {
    method: "POST",
    body: JSON.stringify({
      document_type: "invoice",
      document_date: ddmmyyyy(),
      reference: order.order_number,
      notes: `RMJV portal order ${order.order_number}`,
      party: { id: CUSTOMER_ID, type: "customer", name: CUSTOMER_NAME, gstin: CUSTOMER_GSTIN },
      items,
    }),
  });
  if (!data?.hash_id) throw new Error("SWIPE returned no document id");
  return { hashId: data.hash_id, serial: data.serial_number };
}

/** Orders being invoiced right now, so two page views can't both create one. */
const inFlight = new Set<string>();

/**
 * Creates the SWIPE invoice for every PM-linked, shipped/delivered order that doesn't have one yet.
 * Never throws: a SWIPE outage or an unpriced order is logged and retried on the next sync.
 */
export async function issueInvoices(
  orders: Order[],
  save: (orderId: string, patch: { swipe_hash_id: string; swipe_invoice_number: string }) => Promise<void>,
): Promise<Order[]> {
  if (!HAS_SWIPE) return orders;
  const due = orders.filter(
    (o) =>
      // Only orders the project management app is driving: a deliberate Completed there is the trigger.
      o.pm_task_id && (o.status === "shipped" || o.status === "delivered") && !o.swipe_hash_id && !inFlight.has(o.id),
  );
  if (due.length === 0) return orders;

  const done = new Map<string, { swipe_hash_id: string; swipe_invoice_number: string }>();
  for (const [n, order] of due.entries()) {
    inFlight.add(order.id);
    try {
      if (n > 0) await sleep(1100); // SWIPE allows one request per second
      const { hashId, serial } = await createInvoice(order);
      const patch = { swipe_hash_id: hashId, swipe_invoice_number: serial };
      await save(order.id, patch);
      done.set(order.id, patch);
    } catch (error) {
      console.error("[swipe] could not invoice", order.order_number, error);
    } finally {
      inFlight.delete(order.id);
    }
  }
  return orders.map((o) => (done.has(o.id) ? { ...o, ...done.get(o.id)! } : o));
}

export type SwipeDoc = {
  hashId: string;
  number: string;
  /** ISO date. */
  date: string;
  reference: string;
  total: number;
  pending: number;
};

type SwipeListRow = {
  serial_number: string;
  document_date: string;
  reference?: string;
  total_amount: number;
  amount_pending: number;
  hash_id: string;
};

let docsCache: { at: number; docs: SwipeDoc[] } | null = null;

/**
 * Every invoice on SWIPE for the RMJV customer, newest first. SWIPE returns 10 a
 * page at one request per second, so the result is kept for a minute.
 */
export async function listCustomerDocs(): Promise<SwipeDoc[]> {
  if (!HAS_SWIPE) return [];
  if (docsCache && Date.now() - docsCache.at < 60_000) return docsCache.docs;

  const docs: SwipeDoc[] = [];
  for (let page = 1; ; page++) {
    if (page > 1) await sleep(1100);
    const q = new URLSearchParams({
      document_type: "invoice", customer_id: CUSTOMER_ID, start_date: "01-01-2020", end_date: ddmmyyyy(), page: String(page),
    });
    const { data } = await swipe<{ transactions: SwipeListRow[]; total_records: number }>(`/doc/list?${q}`);
    const rows = data?.transactions ?? [];
    for (const r of rows) {
      const [d, m, y] = r.document_date.split("-");
      docs.push({
        hashId: r.hash_id, number: r.serial_number, date: `${y}-${m}-${d}`,
        reference: r.reference ?? "", total: r.total_amount, pending: r.amount_pending,
      });
    }
    if (rows.length === 0 || docs.length >= (data?.total_records ?? 0)) break;
  }
  docs.sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number, undefined, { numeric: true }));
  docsCache = { at: Date.now(), docs };
  return docs;
}

/** SWIPE's own PDF for an invoice. */
export async function fetchInvoicePdf(hashId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API}/doc/pdf/${encodeURIComponent(hashId)}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SWIPE ${res.status} fetching the invoice PDF`);
  return res.arrayBuffer();
}
