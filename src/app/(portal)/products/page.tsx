import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { listProducts } from "@/lib/data/products";
import { lastSpecMap } from "@/lib/data/orders";
import { formatINR } from "@/lib/money";
import { SUPPORT_WHATSAPP_NUMBER } from "@/lib/config";
import { Badge, btn, Card, EmptyState, PageHeader, ProductThumb } from "@/components/ui";
import { AddToCart } from "@/components/cart/AddToCart";

export const metadata: Metadata = { title: "Catalog" };

export default async function ProductsPage() {
  const session = await requireSession();
  const [products, lastSpecs] = await Promise.all([
    listProducts(),
    lastSpecMap(session.email),
  ]);

  const reorderable = products.filter((p) => lastSpecs.has(p.id));

  return (
    <>
      <PageHeader
        title="Catalog"
        description={
          reorderable.length > 0
            ? `${reorderable.length} of these you've ordered before — reorder the same spec in one click.`
            : "Everything FunKustoms currently produces for RMJV."
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title="The catalog is empty"
          description="FunKustoms hasn't published any products yet. Ping us in chat and we'll get them added."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const lastSpec = lastSpecs.get(product.id) ?? null;
            return (
              <Card as="li" key={product.id} className="flex flex-col overflow-hidden">
                <div className="relative h-32 shrink-0 bg-surface-2">
                  <ProductThumb name={product.name} imageUrl={product.image_url} />
                  {lastSpec ? (
                    <span className="absolute top-2 right-2">
                      <Badge tone="accent">Ordered before</Badge>
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex-1">
                    <h2 className="font-semibold text-ink">{product.name}</h2>
                    {product.description ? (
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {product.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-baseline justify-between gap-2 border-t border-line pt-3">
                    <span className="text-lg font-semibold text-ink nums">
                      {formatINR(product.base_price)}
                    </span>
                    <span className="text-xs text-muted">
                      {product.unit ?? "per unit"} · +{product.gst_rate}% GST
                    </span>
                  </div>

                  <AddToCart
                    productId={product.id}
                    unit={product.unit}
                    lastSpec={lastSpec}
                  />

                  <a
                    href={`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
                      `Hi, I have a question about "${product.name}" on the RMJV portal.`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btn("secondary", "w-full")}
                  >
                    Chat on WhatsApp
                  </a>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </>
  );
}
