import type { DraftLine, OrderItem, Product } from "./types";

/** Rupees, rounded to paise. Money is never carried around as a float mid-calculation. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const toPaise = (rupees: number) => Math.round(rupees * 100);

export const formatINR = (rupees: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(rupees);

export type LineTotals = {
  taxable: number;
  gstRate: number;
  taxAmount: number;
  total: number;
};

export const lineTotals = (unitPrice: number, quantity: number, gstRate: number): LineTotals => {
  const taxable = round2(unitPrice * quantity);
  const taxAmount = round2((taxable * gstRate) / 100);
  return { taxable, gstRate, taxAmount, total: round2(taxable + taxAmount) };
};

export type CartTotals = {
  subtotal: number;
  taxAmount: number;
  total: number;
  /** Tax grouped by rate — an invoice has to show a breakdown per slab. */
  byRate: { rate: number; taxable: number; taxAmount: number }[];
};

const emptyTotals: CartTotals = { subtotal: 0, taxAmount: 0, total: 0, byRate: [] };

const sumLines = (lines: LineTotals[]): CartTotals => {
  if (lines.length === 0) return emptyTotals;

  const grouped = new Map<number, { rate: number; taxable: number; taxAmount: number }>();
  for (const l of lines) {
    const bucket = grouped.get(l.gstRate) ?? { rate: l.gstRate, taxable: 0, taxAmount: 0 };
    bucket.taxable = round2(bucket.taxable + l.taxable);
    bucket.taxAmount = round2(bucket.taxAmount + l.taxAmount);
    grouped.set(l.gstRate, bucket);
  }

  const subtotal = round2(lines.reduce((a, l) => a + l.taxable, 0));
  const taxAmount = round2(lines.reduce((a, l) => a + l.taxAmount, 0));
  return {
    subtotal,
    taxAmount,
    total: round2(subtotal + taxAmount),
    byRate: [...grouped.values()].sort((a, b) => a.rate - b.rate),
  };
};

/** Totals for a draft order, priced from the live catalog. */
export const draftTotals = (lines: DraftLine[], products: Map<string, Product>): CartTotals =>
  sumLines(
    lines.flatMap((l) => {
      const p = products.get(l.product_id);
      if (!p) return [];
      return [lineTotals(p.base_price, l.quantity, p.gst_rate)];
    }),
  );

/**
 * Totals for a saved order. Recomputed from the stored line items rather than the
 * catalog, so historical orders keep the price they were placed at.
 */
export const orderTotals = (items: OrderItem[]): CartTotals =>
  sumLines(items.map((i) => lineTotals(i.unit_price, i.quantity, i.gst_rate)));
