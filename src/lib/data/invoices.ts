import { DEMO_MODE } from "@/lib/config";
import { clone, db, demoId } from "@/lib/demo/store";
import { adminSupabase } from "@/lib/supabase/server";
import { BUYER } from "@/lib/billing";
import type { Invoice } from "@/lib/types";

/** Indian FY label for the invoice series, e.g. 2026-07-30 -> "26-27". */
export function financialYear(date = new Date()): string {
  const year = date.getFullYear();
  // The Indian financial year starts on 1 April.
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}

export async function getInvoiceForOrder(orderId: string): Promise<Invoice | null> {
  if (DEMO_MODE) {
    return clone(db().invoices.find((i) => i.order_id === orderId) ?? null);
  }
  const supabase = adminSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  return (data as Invoice | null) ?? null;
}

/**
 * Returns the invoice for a paid order, creating it on first request.
 *
 * The invoice number comes from a Postgres function backed by a sequence, so two
 * concurrent requests can't be handed the same number. Invoice rows are immutable
 * once issued — regenerating the PDF reuses the existing number.
 */
export async function ensureInvoice(orderId: string): Promise<Invoice> {
  const existing = await getInvoiceForOrder(orderId);
  if (existing) return existing;

  if (DEMO_MODE) {
    const store = db();
    store.invoiceSeq += 1;
    const invoice: Invoice = {
      id: demoId("inv"),
      order_id: orderId,
      invoice_number: `FK/${financialYear()}/${String(store.invoiceSeq).padStart(4, "0")}`,
      pdf_url: null,
      place_of_supply: BUYER.state,
      issued_at: new Date().toISOString(),
    };
    store.invoices.push(invoice);
    return clone(invoice);
  }

  const supabase = adminSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to issue invoices.");

  const { data: number, error: seqError } = await supabase.rpc("next_invoice_number");
  if (seqError) throw seqError;

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      order_id: orderId,
      invoice_number: number as string,
      place_of_supply: BUYER.state,
    })
    .select("*")
    .single();

  if (error) {
    // A concurrent request may have won the race on the unique order_id constraint.
    const raced = await getInvoiceForOrder(orderId);
    if (raced) return raced;
    throw error;
  }
  return data as Invoice;
}
