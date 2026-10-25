import type { AllowedUser, Invoice, Order, OrderFile, OrderItem, Product } from "@/lib/types";
import { catalogProductInputs } from "@/lib/catalog";

export type DemoDb = {
  allowed_users: AllowedUser[];
  products: Product[];
  orders: Order[];
  order_items: OrderItem[];
  order_files: OrderFile[];
  invoices: Invoice[];
  invoiceSeq: number;
  orderSeq: number;
};

/**
 * Local-dev store (no Supabase configured). No sample orders or invoices: it starts
 * with one admin account and the priced products from the Products/ folders.
 */
export function buildSeed(): DemoDb {
  const now = new Date().toISOString();

  return {
    allowed_users: [
      {
        id: "u-0001",
        email: "admin@spintly.com",
        full_name: "FunKustoms Admin",
        is_admin: true,
        active: true,
        created_at: now,
      },
    ],
    products: catalogProductInputs().map((input, i) => ({
      ...input,
      id: `pc-${String(i + 1).padStart(4, "0")}`,
      created_at: now,
    })),
    orders: [],
    order_items: [],
    order_files: [],
    invoices: [],
    invoiceSeq: 0,
    orderSeq: 0,
  };
}
