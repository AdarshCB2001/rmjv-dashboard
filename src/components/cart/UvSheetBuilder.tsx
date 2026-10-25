"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { btn, inputClass } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { packBest } from "@/lib/gang";
import { useCart } from "./CartProvider";

export type UvSheet = {
  productId: string | null;
  key: string;
  size: string;
  w: number;
  h: number;
  price: number | null;
};

type Row = { design: string; w: number; h: number; qty: number };

const OTHER = "Other (new design)";
const MAX_ROWS = 15;
const MAX_QTY = 1000;
const num = (v: string) => Math.max(0, Number(v) || 0);
const hue = (i: number) => (i * 67 + 215) % 360;

/**
 * UV stickers are sold by the sheet (A4 / A3). The customer lists the stickers they need
 * (design, size, quantity); they are auto-packed onto sheets in a live preview, and the
 * number of sheets needed — and so the price — follows from that. The list rides on the
 * cart line's notes.
 */
export function UvSheetBuilder({
  sheets,
  designs,
  images,
  initialDesign,
}: {
  sheets: UvSheet[];
  designs: string[];
  /** Design name -> preview image drawn inside its stickers on the sheet. */
  images: Record<string, string>;
  initialDesign?: string;
}) {
  const { addLine } = useCart();
  const router = useRouter();
  const [sheetKey, setSheetKey] = useState(sheets[0]?.key ?? "");
  const [view, setView] = useState(0);
  const [rows, setRows] = useState<Row[]>([
    { design: designs.includes(initialDesign ?? "") ? initialDesign! : (designs[0] ?? OTHER), w: 0, h: 0, qty: 0 },
  ]);

  const sheet = sheets.find((s) => s.key === sheetKey) ?? sheets[0];
  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const rowOk = (r: Row) => r.w > 0 && r.h > 0 && r.qty >= 1;
  const complete = rows.filter(rowOk);

  const pack = useMemo(
    () => packBest(complete.map((r) => ({ id: rows.indexOf(r), w: r.w, h: r.h, qty: r.qty })), sheet.w, sheet.h),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, sheet.w, sheet.h],
  );
  const count = pack.sheets.length;
  const shown = pack.sheets[Math.min(view, Math.max(count - 1, 0))] ?? [];
  const used = shown.reduce((n, p) => n + p.w * p.h, 0) / (sheet.w * sheet.h);

  const valid = Boolean(sheet.productId) && rows.every(rowOk) && count >= 1 && pack.tooBig.length === 0;

  const add = () => {
    if (!valid || !sheet.productId) return;
    const notes = [
      `UV sticker sheet: ${sheet.key} (${sheet.size}) × ${count}`,
      "Stickers needed:",
      ...rows.map((r) => `• ${r.design} — ${r.w} × ${r.h} in × ${r.qty}`),
    ].join("\n");
    addLine({ productId: sheet.productId, quantity: count, notes });
    router.push("/cart");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {sheets.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setSheetKey(s.key);
                setView(0);
              }}
              aria-pressed={s.key === sheet.key}
              className={`rounded-card border p-4 text-left transition-colors ${
                s.key === sheet.key ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2"
              }`}
            >
              <p className="text-sm font-semibold text-ink">{s.key} sheet</p>
              <p className="text-xs text-muted">{s.size}</p>
              {s.price != null ? (
                <p className="mt-2 text-lg font-semibold text-ink nums">
                  {formatINR(s.price)} <span className="text-xs font-normal text-muted">per sheet</span>
                </p>
              ) : (
                <p className="mt-2 text-sm font-medium text-danger">Price yet to be set</p>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-ink">Stickers you need</p>
          {rows.map((r, i) => (
            <div key={i} className="space-y-2 rounded-lg bg-surface-2 p-3">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ background: `hsl(${hue(i)} 70% 60%)` }}
                />
                <select
                  aria-label="Sticker design"
                  value={r.design}
                  onChange={(e) => setRow(i, { design: e.target.value })}
                  className={inputClass}
                >
                  {[...designs, OTHER].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={btn("ghost")}
                  disabled={rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  aria-label="Remove sticker"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["w", "Width (in)", 0.1],
                    ["h", "Height (in)", 0.1],
                    ["qty", "Quantity", 1],
                  ] as const
                ).map(([key, label, step]) => (
                  <label key={key} className="block text-xs text-muted">
                    {label}
                    <input
                      type="number"
                      min={0}
                      max={key === "qty" ? MAX_QTY : undefined}
                      step={step}
                      value={r[key] || ""}
                      onChange={(e) =>
                        setRow(i, { [key]: key === "qty" ? Math.min(MAX_QTY, Math.floor(num(e.target.value))) : num(e.target.value) })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                ))}
              </div>
              {pack.tooBig.includes(i) ? (
                <p className="text-xs font-medium text-danger">
                  Too big for an {sheet.key} sheet ({sheet.size}) — pick the larger sheet or a smaller size.
                </p>
              ) : null}
            </div>
          ))}
          {rows.length < MAX_ROWS ? (
            <button
              type="button"
              className="text-sm font-medium text-accent hover:underline"
              onClick={() => setRows((rs) => [...rs, { design: designs[0] ?? OTHER, w: 0, h: 0, qty: 0 }])}
            >
              + Add another sticker
            </button>
          ) : null}
          {!rows.every(rowOk) ? (
            <p className="text-xs text-muted">Each sticker needs a width, height and quantity.</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-ink nums">
            {sheet.price != null && count > 0 ? (
              <>
                <span className="text-lg font-semibold">{formatINR(sheet.price * count)}</span>{" "}
                <span className="text-xs text-muted">
                  {count} {sheet.key} sheet{count === 1 ? "" : "s"} × {formatINR(sheet.price)} · +18% GST
                </span>
              </>
            ) : (
              <span className="text-xs text-muted">Add stickers to see the sheets needed.</span>
            )}
          </p>
          <button type="button" disabled={!valid} className={btn("primary")} onClick={add}>
            Add to cart
          </button>
        </div>
      </div>

      <div className="space-y-2 lg:sticky lg:top-20">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium text-ink">
            Sheet preview{count > 1 ? ` — ${Math.min(view, count - 1) + 1} of ${count}` : ""}
          </p>
          <p className="text-xs text-muted nums">
            {sheet.key} · {sheet.size}
            {count > 0 ? ` · ${Math.round(used * 100)}% used` : ""}
          </p>
        </div>
        <svg
          viewBox={`0 0 ${sheet.w} ${sheet.h}`}
          role="img"
          aria-label={`${sheet.key} sheet with ${shown.length} stickers`}
          className="w-full rounded-lg border border-line-strong bg-white shadow-sm"
        >
          {shown.map((p, k) => {
            const row = rows[p.id];
            const img = row ? images[row.design] : undefined;
            const color = `hsl(${hue(p.id)} 60% 40%)`;
            // The packer may have turned the sticker 90°; draw the art the right way round.
            const turned = row && Math.abs(p.w - row.w) > 0.001 && Math.abs(p.w - row.h) < 0.001;
            return (
              <g key={k}>
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.w}
                  height={p.h}
                  rx={0.04}
                  fill={img ? "#f1f3f5" : `hsl(${hue(p.id)} 70% 60%)`}
                  stroke={color}
                  strokeWidth={0.015}
                />
                {img && row ? (
                  <image
                    href={img}
                    x={-row.w / 2}
                    y={-row.h / 2}
                    width={row.w}
                    height={row.h}
                    preserveAspectRatio="xMidYMid meet"
                    transform={`translate(${p.x + p.w / 2} ${p.y + p.h / 2})${turned ? " rotate(90)" : ""}`}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
        {count > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {pack.sheets.map((_, k) => (
              <button
                key={k}
                type="button"
                onClick={() => setView(k)}
                aria-pressed={k === Math.min(view, count - 1)}
                className={btn(k === Math.min(view, count - 1) ? "primary" : "secondary", "px-2.5 py-1 text-xs")}
              >
                Sheet {k + 1}
              </button>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-muted">
          Auto-arranged to scale; stickers may be rotated to fit. Final layout is checked by our team.
        </p>
      </div>
    </div>
  );
}
