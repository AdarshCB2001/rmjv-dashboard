import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getCatalog, pdfThumbUrl, UV_CATEGORY, UV_SHEETS } from "@/lib/catalog";
import { listProducts } from "@/lib/data/products";
import { formatINR } from "@/lib/money";
import { btn, Card, EmptyState, PageHeader, ProductThumb } from "@/components/ui";

export const metadata: Metadata = { title: "Catalog" };

export default async function ProductsPage() {
  await requireSession();
  const catalog = getCatalog();
  const priced = new Map((await listProducts()).map((p) => [p.name, p]));

  return (
    <>
      <PageHeader
        title="Catalog"
        description="Pick a product to see its artwork and place an order."
        actions={
          <Link href="/products/new-order" className={btn("primary")}>
            + Add new order
          </Link>
        }
      />

      {catalog.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Add folders under Products/ (category → product) and they appear here."
        />
      ) : (
        <div className="space-y-10">
          {catalog.map((category) => (
            <section key={category.slug} aria-labelledby={`cat-${category.slug}`}>
              <h2 id={`cat-${category.slug}`} className="mb-3 text-lg font-semibold text-ink">
                {category.name}{" "}
                <span className="text-sm font-normal text-muted">
                  ({category.products.length})
                </span>
                {category.name === UV_CATEGORY ? (
                  <Link
                    href="/products/uv-stickers"
                    className="ml-3 text-sm font-medium text-accent hover:underline"
                  >
                    Order UV sticker sheets →
                  </Link>
                ) : null}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {category.products.map((product) => {
                  const db = priced.get(product.dbName);
                  const imageUrl = product.preview
                    ? `/api/catalog/file?c=${category.slug}&p=${product.slug}&f=${encodeURIComponent(product.preview.file)}`
                    : pdfThumbUrl(product);
                  return (
                    <Card as="li" key={product.slug} className="overflow-hidden">
                      <Link
                        href={`/products/${category.slug}/${product.slug}`}
                        className="block transition-shadow hover:shadow-md"
                      >
                        <div className="group/preview h-40 overflow-hidden bg-surface-2">
                          <ProductThumb name={product.name} imageUrl={imageUrl} contain />
                          {imageUrl ? (
                            // Full-screen view while hovering the thumbnail. pointer-events-none
                            // keeps it from counting as hover, so it closes the moment the cursor leaves.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl}
                              alt=""
                              aria-hidden
                              className="pointer-events-none fixed inset-0 z-[100] hidden h-full w-full bg-black/80 object-contain p-8 group-hover/preview:block"
                            />
                          ) : null}
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-ink">{product.name}</h3>
                          <p className="mt-0.5 text-xs text-muted">
                            {product.files.length} file{product.files.length === 1 ? "" : "s"}
                            {product.files.some((f) => f.isPdf) ? " · PDF preview" : ""}
                          </p>
                          {product.packSize ? (
                            <p className="mt-0.5 text-xs text-muted">
                              {product.packSize} per sheet
                              {product.preview?.widthIn
                                ? ` · ${product.preview.widthIn} × ${product.preview.heightIn} in`
                                : ""}
                            </p>
                          ) : null}
                          <p className="mt-3 text-sm text-ink nums">
                            {category.name === UV_CATEGORY ? (
                              <span className="text-xs text-muted">
                                Sold by the sheet:{" "}
                                {UV_SHEETS.map((s) => `${s.key} ${formatINR(s.price)}`).join(" · ")}
                              </span>
                            ) : db ? (
                              <>
                                <span className="font-semibold">{formatINR(db.base_price)}</span>{" "}
                                <span className="text-xs text-muted">{db.unit}</span>
                              </>
                            ) : (
                              <span className="text-xs font-medium text-danger">Price yet to be set</span>
                            )}
                          </p>
                        </div>
                      </Link>
                    </Card>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
