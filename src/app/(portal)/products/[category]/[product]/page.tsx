import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { findCatalogProduct, formatBytes, UV_CATEGORY, UV_SHEETS } from "@/lib/catalog";
import { listProducts } from "@/lib/data/products";
import { lastSpecMap } from "@/lib/data/orders";
import { formatINR, round2 } from "@/lib/money";
import { SUPPORT_WHATSAPP_NUMBER } from "@/lib/config";
import { btn, Card, cx, EmptyState, PageHeader } from "@/components/ui";
import { AddToCart } from "@/components/cart/AddToCart";
import { PreviewLightbox } from "@/components/PreviewLightbox";

export const metadata: Metadata = { title: "Product" };

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; product: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const [{ category, product: productSlug }, { f }] = await Promise.all([params, searchParams]);
  const session = await requireSession();

  const found = findCatalogProduct(category, productSlug);
  if (!found) notFound();
  const { product } = found;

  const [products, lastSpecs] = await Promise.all([listProducts(), lastSpecMap(session.email)]);
  const db = products.find((p) => p.name === product.dbName) ?? null;

  const pdfs = product.files.filter((x) => x.isPdf);
  const active = pdfs.find((x) => x.name === f) ?? pdfs[0] ?? null;
  const fileUrl = (name: string, dl = false) =>
    `/api/catalog/file?c=${category}&p=${productSlug}&f=${encodeURIComponent(name)}${dl ? "&dl=1" : ""}`;

  return (
    <>
      <PageHeader
        title={product.name}
        description={product.categoryName}
        actions={
          <Link href="/products" className="text-sm font-medium text-accent hover:underline">
            ← Back to catalog
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="min-w-0 space-y-3">
          {active ? (
            <>
              {pdfs.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {pdfs.map((x) => (
                    <Link
                      key={x.name}
                      href={`?f=${encodeURIComponent(x.name)}`}
                      replace
                      scroll={false}
                      aria-current={x.name === active.name ? "true" : undefined}
                      className={btn(x.name === active.name ? "primary" : "secondary", "max-w-full")}
                    >
                      <span className="truncate">{x.name}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              <Card className="overflow-hidden">
                <iframe
                  key={active.name}
                  src={`${fileUrl(active.name)}#view=Fit&pagemode=none`}
                  title={`${product.name} — ${active.name}`}
                  className="h-[75vh] min-h-[480px] w-full bg-surface-2"
                />
              </Card>
            </>
          ) : (
            <EmptyState
              title="No PDF preview for this product"
              description="Only source artwork is on file — download it from the list on the right."
            />
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-20">
          <Card className="space-y-4 p-4">
            {product.categoryName === UV_CATEGORY ? (
              <>
                <p className="text-sm text-body">
                  UV stickers are sold by the sheet:{" "}
                  {UV_SHEETS.map((s) => `${s.key} (${s.size}) ${formatINR(s.price)}`).join(" · ")}{" "}
                  <span className="text-xs text-muted">+ 18% GST</span>
                </p>
                <Link
                  href={`/products/uv-stickers?design=${encodeURIComponent(product.name)}`}
                  className={btn("primary", "w-full")}
                >
                  Add to a sheet
                </Link>
              </>
            ) : db ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-semibold text-ink nums">
                    {formatINR(db.base_price)}
                  </span>
                  <span className="text-xs text-muted">
                    {db.unit ?? "per unit"} · +{db.gst_rate}% GST
                  </span>
                </div>
                {(db.pack_size ?? 1) > 1 ? (
                  <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                    {db.pack_size} pieces fit on one 12×18&quot; sheet (₹{round2(db.base_price * db.pack_size!)}/sheet).
                    Minimum order {db.pack_size}; quantity must be a multiple of {db.pack_size}.
                  </p>
                ) : null}
                <AddToCart
                  productId={db.id}
                  unit={db.unit}
                  pack={db.pack_size}
                  lastSpec={lastSpecs.get(db.id) ?? null}
                />
              </>
            ) : (
              <p className="text-sm font-medium text-danger">Price yet to be set</p>
            )}
            <a
              href={`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
                `Hi, I have a question about "${product.categoryName} — ${product.name}" on the RMJV portal.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className={btn("secondary", "w-full")}
            >
              Chat on WhatsApp
            </a>
          </Card>

          {product.preview ? (
            <Card className="p-4">
              <PreviewLightbox
                src={fileUrl(product.preview.file)}
                alt={`${product.name} preview`}
                caption={
                  product.preview.widthIn
                    ? `${product.preview.widthIn} × ${product.preview.heightIn} inches`
                    : undefined
                }
              />
            </Card>
          ) : null}

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink">Downloads</h2>
            <ul className="divide-y divide-line">
              {product.files.map((x) => (
                <li key={x.name} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className={cx(
                        "truncate text-sm text-ink",
                        x.name === active?.name && "font-medium",
                      )}
                    >
                      {x.name}
                    </p>
                    <p className="text-xs text-muted nums">
                      {x.ext.toUpperCase()} · {formatBytes(x.size)}
                    </p>
                  </div>
                  <a
                    href={fileUrl(x.name, true)}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
