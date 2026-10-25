import type { Metadata } from "next";
import { listProducts } from "@/lib/data/products";
import { formatINR } from "@/lib/money";
import { Badge, btn, Card, ProductThumb } from "@/components/ui";
import { syncCatalog } from "../actions";
import { NewProductCard, ProductForm } from "./ProductForm";

export const metadata: Metadata = { title: "Admin · Catalog" };

export default async function AdminProductsPage() {
  const products = await listProducts({ includeInactive: true });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">
          Catalog{" "}
          <span className="text-sm font-normal text-muted">({products.length})</span>
        </h2>

        <form action={syncCatalog}>
          <button type="submit" className={btn("secondary")}>
            Sync products from Products/ folders
          </button>
        </form>

        {products.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted">
            No products yet. Add the first one on the right.
          </Card>
        ) : (
          products.map((product) => (
            <Card key={product.id} className="p-4">
              <div className="flex gap-4">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  <ProductThumb name={product.name} imageUrl={product.image_url} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-ink">{product.name}</h3>
                    {product.active ? (
                      <Badge tone="positive">Live</Badge>
                    ) : (
                      <Badge tone="warning">Hidden</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted nums">
                    {formatINR(product.base_price)} {product.unit ?? "per unit"} · +
                    {product.gst_rate}% GST
                    {product.hsn_code ? ` · HSN ${product.hsn_code}` : ""}
                  </p>
                  <div className="mt-2">
                    <ProductForm product={product} collapsible />
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="lg:sticky lg:top-20">
        <NewProductCard />
      </div>
    </div>
  );
}
