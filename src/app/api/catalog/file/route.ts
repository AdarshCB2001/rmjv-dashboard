import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { findCatalogProduct } from "@/lib/catalog";
import { serveCatalogFile } from "@/lib/serve-file";

/** Product file by (category, product, file) — all three are checked against the catalog manifest. */
export async function GET(request: NextRequest) {
  await requireSession();
  const q = request.nextUrl.searchParams;
  const found = findCatalogProduct(q.get("c") ?? "", q.get("p") ?? "");
  const file = found?.product.files.find((f) => f.name === q.get("f"));
  if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return serveCatalogFile(file, q.get("dl") === "1");
}
