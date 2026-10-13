import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { listProducts } from "@/lib/data/products";
import { PageHeader } from "@/components/ui";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  await requireSession();
  // The cart itself lives in the browser; the catalog comes from the server so prices
  // shown at checkout are the real ones.
  const products = await listProducts();

  return (
    <>
      <PageHeader title="Cart" description="Check the specs, then place the order." />
      <CartView products={products} />
    </>
  );
}
