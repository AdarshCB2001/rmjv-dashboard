import "server-only";
import { INVOICES_BUCKET } from "@/lib/config";
import { lineTotals, round2 } from "@/lib/money";
import { adminSupabase } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

/**
 * GST invoices are issued on SWIPE (the accounting platform), not rendered here. When an
 * order reaches Shipped — i.e. the project management app moved it from Production to
 * Completed — `issueInvoices` creates the invoice on SWIPE and saves its id on the order;
 * the portal's "Download GST invoice" then streams SWIPE's own PDF.
 *
 * API: https://developers.getswipe.in (Bearer key, 1 request/second, 100 calls a month). So the
 * portal never reads SWIPE per page view: invoice details live in the `swipe_docs` table and
 * PDFs in the `invoices` bucket, filled when an invoice is created, on first open of a PDF, or
 * by the admin's "Refresh from SWIPE". Calls act on the live
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

const isoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

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
async function createInvoice(order: Order): Promise<{ hashId: string; serial: string; total: number }> {
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
  return { hashId: data.hash_id, serial: data.serial_number, total: round2(items.reduce((n, i) => n + i.total_amount, 0)) };
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
      const { hashId, serial, total } = await createInvoice(order);
      const patch = { swipe_hash_id: hashId, swipe_invoice_number: serial };
      await save(order.id, patch);
      await remember([{ hashId, number: serial, date: isoToday(), reference: order.order_number, total, pending: total }]).catch(
        (e) => console.error("[swipe] could not cache invoice", serial, e),
      );
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
  /** Estimates only come from the PDF import; SWIPE sync lists invoices. */
  kind?: "invoice" | "estimate";
  /** Who it was billed to, when known (imported PDFs). */
  customer?: string | null;
};

type SwipeListRow = {
  serial_number: string;
  document_date: string;
  reference?: string;
  total_amount: number;
  amount_pending: number;
  hash_id: string;
};

const toRow = (d: SwipeDoc) => ({
  hash_id: d.hashId, number: d.number, doc_date: d.date, reference: d.reference, total: d.total, pending: d.pending,
  kind: d.kind ?? "invoice", customer: d.customer ?? null,
  synced_at: new Date().toISOString(),
});

async function remember(docs: SwipeDoc[]) {
  const supabase = adminSupabase();
  if (!supabase || docs.length === 0) return;
  const { error } = await supabase.from("swipe_docs").upsert(docs.map(toRow));
  if (error) throw error;
}

const byNewest = (a: SwipeDoc, b: SwipeDoc) =>
  b.date.localeCompare(a.date) || b.number.localeCompare(a.number, undefined, { numeric: true });

/** Invoices for the RMJV customer, newest first, from our own copy. Makes no SWIPE call. */
export async function listCustomerDocs(): Promise<SwipeDoc[]> {
  const supabase = adminSupabase();
  if (!HAS_SWIPE || !supabase) return [];
  const { data, error } = await supabase.from("swipe_docs").select("*");
  if (error) throw error;
  return (data ?? [])
    .map((r) => ({
      hashId: r.hash_id as string, number: r.number as string, date: r.doc_date as string,
      reference: (r.reference as string | null) ?? "", total: Number(r.total), pending: Number(r.pending),
      kind: r.kind as "invoice" | "estimate", customer: r.customer as string | null,
    }))
    .sort(byNewest);
}

/**
 * Pulls every invoice from SWIPE into our copy (10 per call, 1 call/second) — about
 * ceil(n / 10) API calls, so it only runs when an admin asks. Returns how many were synced.
 */
export async function refreshCustomerDocs(): Promise<number> {
  if (!HAS_SWIPE) return 0;
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
  // A PDF imported earlier is superseded once SWIPE lists the same invoice number.
  const supabase = adminSupabase();
  if (supabase && docs.length > 0) {
    await supabase.from("swipe_docs").delete().like("hash_id", "import-%").in("number", docs.map((d) => d.number));
  }
  await remember(docs);
  return docs.length;
}

async function fetchPdfFromSwipe(hashId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API}/doc/pdf/${encodeURIComponent(hashId)}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SWIPE ${res.status} fetching the invoice PDF`);
  const pdf = await res.arrayBuffer();
  // SWIPE can answer 200 with a JSON error (e.g. quota used up); never store or serve that as a PDF.
  if (new TextDecoder().decode(pdf.slice(0, 4)) !== "%PDF") throw new Error("SWIPE did not return a PDF");
  return pdf;
}

/** An invoice PDF: from our bucket if we have it, else fetched from SWIPE once (1 call) and kept. */
export async function getInvoicePdf(hashId: string): Promise<ArrayBuffer> {
  const supabase = adminSupabase();
  const key = `${hashId.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
  if (supabase) {
    const { data } = await supabase.storage.from(INVOICES_BUCKET).download(key);
    if (data) return data.arrayBuffer();
  }
  const pdf = await fetchPdfFromSwipe(hashId);
  if (supabase) {
    const { error } = await supabase.storage.from(INVOICES_BUCKET).upload(key, pdf, { contentType: "application/pdf", upsert: true });
    if (error) console.error("[swipe] could not store invoice PDF", key, error.message);
  }
  return pdf;
}
