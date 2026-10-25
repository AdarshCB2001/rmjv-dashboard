// Renders page 1 of every PDF under Products/ to public/thumbs/<slug>.png for the catalog cards.
// Run `npm run thumbs` after adding or changing a PDF.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const PRODUCTS = path.resolve("..", "Products");
const OUT = path.resolve("public", "thumbs");
const WIDTH = 800;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fontDir = pathToFileURL(path.resolve("node_modules/pdfjs-dist/standard_fonts") + path.sep).href;

const pdfs = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pdfs(path.join(dir, e.name)) : e.name.toLowerCase().endsWith(".pdf") ? [path.join(dir, e.name)] : [],
  );

for (const file of pdfs(PRODUCTS)) {
  const name = path.basename(file);
  try {
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(readFileSync(file)),
      standardFontDataUrl: fontDir,
      verbosity: 0,
    }).promise;
    const page = await doc.getPage(1);
    const scale = WIDTH / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    writeFileSync(path.join(OUT, `${slugify(path.relative(PRODUCTS, file))}.png`), canvas.toBuffer("image/png"));
    console.log("ok  ", name);
  } catch (e) {
    console.log("FAIL", name, String(e).slice(0, 100));
  }
}
