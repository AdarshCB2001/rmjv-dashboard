import path from "node:path";
import { SHEET_PRICE } from "@/lib/packs";
import manifest from "./catalog-manifest.json";

/**
 * The storefront catalog is the folder tree: Products/<Category>/<Product>/<files>.
 * Files sitting loose in a category folder are grouped into one product per base name
 * (so "x v17.cdr" and "x.pdf" land together).
 *
 * The folder tree is mirrored in the private `catalog` Supabase bucket and described by
 * catalog-manifest.json. Both are written by `npm run catalog:push`, so adding or changing a
 * file means running that and redeploying. ponytail: manifest is static; if staff need to add
 * products without a deploy, list the bucket at request time instead.
 */

export const CATALOG_BUCKET = "catalog";

export type CatalogFile = {
  /** Path under Products/, and the (sanitised) key it is stored under in the bucket. */
  path: string;
  key: string;
  name: string;
  ext: string;
  size: number;
  modifiedAt: string;
  isPdf: boolean;
  isImage: boolean;
};

export type CatalogProduct = {
  slug: string;
  name: string;
  category: CatalogCategory["slug"];
  categoryName: string;
  /** Name of the DB product row that carries price/GST for this item. */
  dbName: string;
  files: CatalogFile[];
  /** Pieces per 12x18 sheet, from a "... - 10ps.pdf" filename; null when not sheet-sold. */
  packSize: number | null;
  /** The "... - 2.6 by 5.7 inches.png" preview, if the folder has one. */
  preview: { file: string; widthIn: number; heightIn: number } | null;
};

export type CatalogCategory = {
  slug: string;
  name: string;
  products: CatalogProduct[];
};

/**
 * Real per-piece prices, excl. GST, for products not sold by the sheet (those are priced
 * SHEET_PRICE / pieces-per-sheet). A product with no price has none yet and can't be
 * ordered — the storefront says so instead of guessing.
 */
const GST = { hsn_code: "4911", gst_rate: 18 };
const PRICES: Record<string, number> = {
  "One Page Manual/FR Mobile": 3.75,
  "One Page Manual/Kreo": 3.75,
  "One Page Manual/Mesh IO": 3.75,
  "One Page Manual/Zeon": 3.75,
  // Overrides the sheet-derived price (60 / 9 = 6.67).
  "Drill Templates/Zeon Drill Template": 6.5,
};

/** Pieces per 12x18 sheet for categories whose filenames don't say (16 x ₹3.75 = the ₹60 sheet). */
const CATEGORY_PACK: Record<string, number> = { "One Page Manual": 16 };

/** UV stickers are sold by the sheet, not per design: A4 / A3 products carry the price. */
export const UV_CATEGORY = "UV Stickers";
export const UV_SHEETS = [
  { key: "A4", size: "8 × 11 in", w: 8, h: 11, price: 650, dbName: "UV Stickers — A4 Sheet" },
  { key: "A3", size: "11 × 16 in", w: 11, h: 16, price: 900, dbName: "UV Stickers — A3 Sheet" },
] as const;

/** Placeholder product behind "Add new order": no price until the team quotes it. */
export const CUSTOM_ORDER_NAME = "Custom Order";

const FILE_EXTS = new Set([".pdf", ".cdr", ".ai", ".png"]);

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

type Entry = (typeof manifest.files)[number];
const inDir = (prefix: string[]) => (e: Entry) => {
  const segs = e.path.split("/");
  return prefix.every((p, i) => segs[i] === p) && segs.length > prefix.length;
};

/** Immediate sub-folders of a folder (given as path segments under Products/). */
const dirs = (prefix: string[]) =>
  [...new Set(manifest.files.filter(inDir(prefix)).map((e) => e.path.split("/")).filter((s) => s.length > prefix.length + 1).map((s) => s[prefix.length]))].sort();

function filesIn(prefix: string[]): CatalogFile[] {
  return manifest.files
    .filter(inDir(prefix))
    .filter((e) => e.path.split("/").length === prefix.length + 1 && FILE_EXTS.has(path.extname(e.path).toLowerCase()))
    .map((e) => {
      const name = path.basename(e.path);
      const ext = path.extname(name).slice(1).toLowerCase();
      return {
        path: e.path,
        key: e.key,
        name,
        ext,
        size: e.size,
        modifiedAt: e.modifiedAt,
        isPdf: ext === "pdf",
        isImage: ext === "png",
      };
    })
    // PDFs first so the embedded viewer has something to show.
    .sort((a, b) => Number(b.isPdf) - Number(a.isPdf) || a.name.localeCompare(b.name));
}

/** Reads pieces-per-sheet and preview size out of the filenames in a product folder. */
function parseSheetInfo(files: CatalogFile[]): Pick<CatalogProduct, "packSize" | "preview"> {
  const pack = files.map((f) => /(\d+)\s*ps\b/i.exec(f.name)).find(Boolean);
  const image = files.find((f) => f.isImage);
  const dims = image && /(\d+(?:\.\d+)?)\s*by\s*(\d+(?:\.\d+)?)\s*inch/i.exec(image.name);
  return {
    packSize: pack ? Number(pack[1]) : null,
    preview: image
      ? { file: image.name, widthIn: dims ? Number(dims[1]) : 0, heightIn: dims ? Number(dims[2]) : 0 }
      : null,
  };
}

/** "Gateway status LED symbols V17 10 MAY 2025.cdr" -> "gateway status led symbols 10 may 2025" */
const groupKey = (file: string) =>
  path
    .basename(file, path.extname(file))
    .replace(/\bv\d+\b/gi, "")
    .replace(/\s*\(\d+\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function getCatalog(): CatalogCategory[] {
  return dirs([]).map((categoryName) => {
    const catDir = [categoryName];
    const category: CatalogCategory = {
      slug: slugify(categoryName),
      name: categoryName,
      products: [],
    };
    const make = (name: string, files: CatalogFile[]): CatalogProduct => ({
      ...parseSheetInfo(files),
      packSize: parseSheetInfo(files).packSize ?? CATEGORY_PACK[categoryName] ?? null,
      slug: slugify(name),
      name,
      category: category.slug,
      categoryName,
      dbName: `${categoryName} — ${name}`,
      files,
    });

    for (const sub of dirs(catDir)) {
      const files = filesIn([...catDir, sub]);
      if (files.length) category.products.push(make(sub, files));
    }

    const loose = new Map<string, CatalogFile[]>();
    for (const f of filesIn(catDir).filter((f) => !f.isImage)) {
      const key = groupKey(f.name);
      loose.set(key, [...(loose.get(key) ?? []), f]);
    }
    for (const files of loose.values()) {
      if (files.every((f) => f.isImage)) continue;
      const display = path
        .basename(files[0].name, path.extname(files[0].name))
        .replace(/\bv\d+\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      category.products.push(make(display, files));
    }

    category.products.sort((a, b) => a.name.localeCompare(b.name));
    return category;
  });
}

export function findCatalogProduct(categorySlug: string, productSlug: string) {
  const category = getCatalog().find((c) => c.slug === categorySlug);
  const product = category?.products.find((p) => p.slug === productSlug);
  return category && product ? { category, product } : null;
}

export const formatBytes = (bytes: number) =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

/** One DB product per folder-catalog item that has a price. */
export function catalogProductInputs() {
  const uvSheets = getCatalog().some((c) => c.name === UV_CATEGORY)
    ? UV_SHEETS.map((s) => ({
        name: s.dbName,
        description: `UV stickers — ${s.key} sheet (${s.size})`,
        base_price: s.price,
        unit: "per sheet",
        ...GST,
        image_url: null,
        active: true,
      }))
    : [];
  const designs = getCatalog().flatMap((c) =>
    c.products
      .filter((p) => p.packSize || `${c.name}/${p.name}` in PRICES)
      .map((p) => ({
        name: p.dbName,
        description: `${c.name} — ${p.name}`,
        base_price:
          PRICES[`${c.name}/${p.name}`] ??
          Math.round((SHEET_PRICE / p.packSize!) * 100) / 100,
        unit: "per piece",
        ...GST,
        image_url: null,
        active: true,
      })),
  );
  const custom = {
    name: CUSTOM_ORDER_NAME,
    description: "Order with your own artwork — priced on request",
    base_price: 0,
    unit: "per piece",
    ...GST,
    image_url: null,
    active: true,
  };
  return [...designs, ...uvSheets, custom];
}

/** Rendered first page of the product's PDF (npm run thumbs + catalog:push), or null if not generated. */
export function pdfThumbUrl(p: CatalogProduct): string | null {
  const pdf = p.files.find((f) => f.isPdf);
  if (!pdf) return null;
  const thumb = `${slugify(pdf.path)}.png`;
  return manifest.thumbs.includes(thumb) ? `/thumbs/${thumb}` : null;
}

/** Pieces-per-sheet by DB product name, scanned once per call. */
export const packSizes = () =>
  new Map(getCatalog().flatMap((c) => c.products.map((p) => [p.dbName, p.packSize ?? 1] as const)));

/** URL of a product's first PDF (its layout) — what an order uses when no artwork is attached. */
export function defaultPdfUrl(dbName: string): string | null {
  for (const c of getCatalog()) {
    const p = c.products.find((x) => x.dbName === dbName);
    const pdf = p?.files.find((f) => f.isPdf);
    if (p && pdf) {
      return `/api/catalog/file?c=${c.slug}&p=${p.slug}&f=${encodeURIComponent(pdf.name)}`;
    }
  }
  return null;
}
