/**
 * Auto-packs stickers onto sheets (inches) for the UV sheet preview. Shelf packing: rows
 * run left to right, each as tall as its first sticker, tallest stickers first; a sticker
 * may be rotated 90° when that is the only way it fits. A new sheet opens when nothing fits.
 */

export type StickerSpec = { id: number; w: number; h: number; qty: number };
export type Placed = { id: number; x: number; y: number; w: number; h: number };
export type PackResult = {
  sheets: Placed[][];
  /** Spec ids whose sticker is larger than the sheet in both orientations. */
  tooBig: number[];
};

/** Unprintable edge and the gap kept between stickers, in inches. */
export const MARGIN = 0.2;
export const GAP = 0.1;

export function packStickers(specs: StickerSpec[], sheetW: number, sheetH: number): PackResult {
  const maxW = sheetW - 2 * MARGIN;
  const maxH = sheetH - 2 * MARGIN;
  const fits = (w: number, h: number) => w <= maxW && h <= maxH;

  const tooBig = specs.filter((s) => !fits(s.w, s.h) && !fits(s.h, s.w)).map((s) => s.id);
  const items = specs
    .filter((s) => !tooBig.includes(s.id))
    .flatMap((s) => Array.from({ length: s.qty }, () => s))
    .sort((a, b) => b.h - a.h || b.w - a.w);

  type Shelf = { y: number; h: number; x: number };
  const sheets: { placed: Placed[]; shelves: Shelf[]; bottom: number }[] = [];

  const tryPlace = (sheet: (typeof sheets)[number], id: number, w: number, h: number) => {
    if (w > maxW || h > maxH) return false;
    for (const shelf of sheet.shelves) {
      if (h <= shelf.h && shelf.x + w <= maxW) {
        sheet.placed.push({ id, x: MARGIN + shelf.x, y: MARGIN + shelf.y, w, h });
        shelf.x += w + GAP;
        return true;
      }
    }
    if (sheet.bottom + h <= maxH) {
      sheet.shelves.push({ y: sheet.bottom, h, x: w + GAP });
      sheet.placed.push({ id, x: MARGIN, y: MARGIN + sheet.bottom, w, h });
      sheet.bottom += h + GAP;
      return true;
    }
    return false;
  };

  for (const it of items) {
    let done = false;
    for (const sheet of sheets) {
      done = tryPlace(sheet, it.id, it.w, it.h) || tryPlace(sheet, it.id, it.h, it.w);
      if (done) break;
    }
    if (!done) {
      const sheet = { placed: [], shelves: [], bottom: 0 };
      sheets.push(sheet);
      if (!tryPlace(sheet, it.id, it.w, it.h)) tryPlace(sheet, it.id, it.h, it.w);
    }
  }
  return { sheets: sheets.map((s) => s.placed), tooBig };
}

const lastSheetDepth = (r: PackResult) => Math.max(0, ...(r.sheets.at(-1) ?? []).map((p) => p.y + p.h));

/**
 * Tries each sticker as drawn and turned 90° (every combination up to 6 designs, otherwise
 * all-as-drawn / all-turned) and keeps the layout that needs the fewest sheets, then the
 * least of the last one.
 */
export function packBest(specs: StickerSpec[], sheetW: number, sheetH: number): PackResult {
  const turned = (s: StickerSpec) => ({ ...s, w: s.h, h: s.w });
  const masks =
    specs.length <= 6
      ? Array.from({ length: 2 ** specs.length }, (_, m) => m)
      : [0, 2 ** specs.length - 1];
  let best: PackResult | null = null;
  for (const m of masks) {
    const r = packStickers(specs.map((s, i) => (m & (1 << i) ? turned(s) : s)), sheetW, sheetH);
    if (
      !best ||
      r.sheets.length < best.sheets.length ||
      (r.sheets.length === best.sheets.length && lastSheetDepth(r) < lastSheetDepth(best))
    ) {
      best = r;
    }
  }
  return best ?? { sheets: [], tooBig: [] };
}
