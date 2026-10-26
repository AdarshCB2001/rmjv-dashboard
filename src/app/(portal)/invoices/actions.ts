"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { refreshCustomerDocs } from "@/lib/swipe";

/** Admin-only: re-reads the invoice list from SWIPE (costs ~1 API call per 10 invoices of a 100/month cap). */
export async function refreshInvoices() {
  await requireAdmin();
  let result: string;
  try {
    result = `ok-${await refreshCustomerDocs()}`;
  } catch (error) {
    console.error("[invoices] refresh from SWIPE failed", error);
    result = "failed";
  }
  redirect(`/invoices?refreshed=${result}`);
}
