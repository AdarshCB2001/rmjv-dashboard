import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { HAS_SUPABASE } from "@/lib/config";
import { adminSupabase } from "@/lib/supabase/server";
import { CATALOG_BUCKET, type CatalogFile } from "@/lib/catalog";

const TYPES: Record<string, string> = { pdf: "application/pdf", png: "image/png" };

/** Bytes of a catalog file: from the `catalog` bucket, or ../Products when Supabase isn't configured (dev). */
async function catalogBytes(file: CatalogFile): Promise<Uint8Array | null> {
  if (!HAS_SUPABASE) {
    const root = process.env.CATALOG_ROOT ?? path.join(process.cwd(), "..");
    return readFile(path.join(root, "Products", file.path)).catch(() => null);
  }
  const { data } = (await adminSupabase()?.storage.from(CATALOG_BUCKET).download(file.key)) ?? {};
  return data ? new Uint8Array(await data.arrayBuffer()) : null;
}

/** Streams a catalog file resolved from the allow-list, inline unless `download`. */
export async function serveCatalogFile(file: CatalogFile, download: boolean) {
  const bytes = await catalogBytes(file);
  if (!bytes) return NextResponse.json({ error: "File not found." }, { status: 404 });
  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": TYPES[file.ext] ?? "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
