import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getCatalog, pdfThumbUrl, UV_CATEGORY, UV_SHEETS } from "@/lib/catalog";
import { listProducts } from "@/lib/data/products";
import { Card, PageHeader } from "@/components/ui";
import { UvSheetBuilder } from "@/components/cart/UvSheetBuilder";

export const metadata: Metadata = { title: "UV Stickers" };

export default async function UvStickersPage({
  searchParams,
}: {
  searchParams: Promise<{ design?: string }>;
}) {
  const [{ design }] = await Promise.all([searchParams, requireSession()]);
  const category = getCatalog().find((c) => c.name === UV_CATEGORY);
  const db = new Map((await listProducts()).map((p) => [p.name, p]));

  const sheets = UV_SHEETS.map((s) => ({
    key: s.key,
    size: s.size,
    w: s.w,
    h: s.h,
    productId: db.get(s.dbName)?.id ?? null,
    price: db.get(s.dbName)?.base_price ?? null,
  }));
  const designs = category?.products.map((p) => p.name) ?? [];
  const imageOf = (p: NonNullable<typeof category>["products"][number]) =>
    p.preview
      ? `/api/catalog/file?c=${category!.slug}&p=${p.slug}&f=${encodeURIComponent(p.preview.file)}`
      : pdfThumbUrl(p);
  const images = Object.fromEntries(
    (category?.products ?? []).flatMap((p) => {
      const url = imageOf(p);
      return url ? [[p.name, url]] : [];
    }),
  );

  return (
    <>
      <PageHeader
        title="UV Stickers"
        description="Sold by the sheet — choose A4 or A3, list the stickers you need, and see them laid out on the sheet."
        actions={
          <Link href="/products" className="text-sm font-medium text-accent hover:underline">
            ← Back to catalog
          </Link>
        }
      />
      <Card className="p-5">
        <UvSheetBuilder sheets={sheets} designs={designs} images={images} initialDesign={design} />
      </Card>

      {category && category.products.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-ink">Existing designs</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {category.products.map((p) => {
              const thumb = imageOf(p);
              return (
                <Card as="li" key={p.slug} className="overflow-hidden">
                  <Link href={`/products/${category.slug}/${p.slug}`} className="block hover:shadow-md">
                    <div className="flex h-32 items-center justify-center bg-surface-2">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-contain" />
                      ) : null}
                    </div>
                    <p className="p-3 text-sm font-medium text-ink">{p.name}</p>
                  </Link>
                </Card>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
