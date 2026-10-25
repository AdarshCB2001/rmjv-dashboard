// Scans ../Products (PDF + PNG only), uploads each file to the private `catalog` bucket and
// writes src/lib/catalog-manifest.json, which is what the storefront reads.
// Run after adding or changing files:  npm run thumbs && npm run catalog:push   (then redeploy)
// Without Supabase keys it only rewrites the manifest.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const PRODUCTS = path.resolve("..", "Products");
const TYPES = { ".pdf": "application/pdf", ".png": "image/png" };
// Storage keys reject characters like [ ] # %; keep the real name in `path`, upload under `key`.
const safe = (rel) => rel.split("/").map((s) => s.replace(/[^A-Za-z0-9._() -]/g, "_")).join("/");

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );

const files = walk(PRODUCTS)
  .filter((f) => path.extname(f).toLowerCase() in TYPES)
  .map((abs) => {
    const rel = path.relative(PRODUCTS, abs).split(path.sep).join("/");
    const st = statSync(abs);
    return { abs, path: rel, key: safe(rel), size: st.size, modifiedAt: st.mtime.toISOString() };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && sk) {
  const bucket = createClient(url, sk).storage.from("catalog");
  for (const f of files) {
    const { error } = await bucket.upload(f.key, readFileSync(f.abs), {
      upsert: true,
      contentType: TYPES[path.extname(f.abs).toLowerCase()],
    });
    console.log(error ? `FAIL ${f.path}: ${error.message}` : `ok   ${f.path}`);
    if (error) process.exitCode = 1;
  }
} else {
  console.log("No Supabase keys — manifest only, nothing uploaded.");
}

const thumbs = readdirSync(path.resolve("public", "thumbs")).filter((n) => n.endsWith(".png")).sort();
writeFileSync(
  path.resolve("src", "lib", "catalog-manifest.json"),
  JSON.stringify({ files: files.map(({ abs, ...f }) => f), thumbs }, null, 2) + "\n",
);
console.log(`manifest: ${files.length} files, ${thumbs.length} thumbnails`);
