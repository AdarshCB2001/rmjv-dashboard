"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_BYTES, isAllowedFileName } from "@/lib/config";
import { ORDER_TYPES } from "@/lib/order-types";
import { btn, inputClass, Notice } from "./ui";
import { uploadArtwork } from "./FileUpload";
import { placeCustomOrder } from "@/app/(portal)/products/new-order/actions";

export function NewOrderForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const fileError = file
    ? !isAllowedFileName(file.name)
      ? `Accepted formats: ${ALLOWED_FILE_EXTENSIONS.join(", ")}.`
      : file.size > MAX_FILE_BYTES
        ? "That file is over the 50MB limit."
        : null
    : null;
  const needsCategory = type === "Others";
  const valid =
    file && !fileError && title.trim() && type && (!needsCategory || category.trim()) && quantity >= 1 && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !file) return;
    setBusy(true);
    setError(null);
    const res = await placeCustomOrder({ title, type, category, quantity, notes });
    if (res.error || !res.orderId || !res.itemId) {
      setError(res.error ?? "Could not place the order.");
      setBusy(false);
      return;
    }
    try {
      await uploadArtwork(res.itemId, file);
      router.push(`/orders/${res.orderId}`);
    } catch (err) {
      // The order exists; the file can still be attached from its page.
      setOrderId(res.orderId);
      setError(`Order created, but the file didn't upload: ${err instanceof Error ? err.message : "try again"}.`);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="order-title" className="block text-xs font-medium text-ink">
          Order Title <span className="text-danger">*</span>
        </label>
        <input
          id="order-title"
          type="text"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Kreo box sticker – May batch"
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-ink">
          Artwork file <span className="text-danger">*</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_FILE_EXTENSIONS.join(",")}
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface-2 p-4">
          <button type="button" className={btn("secondary")} onClick={() => fileRef.current?.click()}>
            {file ? "Change file" : "Choose file"}
          </button>
          <span className="min-w-0 truncate text-sm text-body">{file?.name ?? "No file chosen"}</span>
          <span className="text-xs text-muted">{ALLOWED_FILE_EXTENSIONS.join(", ")} · up to 50MB</span>
        </div>
        {fileError ? <p className="text-xs font-medium text-danger">{fileError}</p> : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="order-type" className="block text-xs font-medium text-ink">
          Order type <span className="text-danger">*</span>
        </label>
        <select id="order-type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
          <option value="" disabled>
            Select an order type
          </option>
          {ORDER_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {needsCategory ? (
        <div className="space-y-1.5">
          <label htmlFor="order-category" className="block text-xs font-medium text-ink">
            Category name <span className="text-danger">*</span>
          </label>
          <input
            id="order-category"
            type="text"
            maxLength={60}
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Brochure, Visiting cards"
            className={inputClass}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="order-qty" className="block text-xs font-medium text-ink">
          Quantity <span className="text-danger">*</span>
        </label>
        <input
          id="order-qty"
          type="number"
          min={1}
          max={100000}
          value={quantity || ""}
          onChange={(e) => setQuantity(Math.floor(Number(e.target.value)) || 0)}
          className={`${inputClass} max-w-40`}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="order-notes" className="block text-xs font-medium text-ink">
          Notes
        </label>
        <textarea
          id="order-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Sizes, colours, finish, anything we should know"
          className={inputClass}
        />
      </div>

      {error ? (
        <Notice tone="danger">
          {error}{" "}
          {orderId ? (
            <a href={`/orders/${orderId}`} className="font-medium underline">
              Open the order
            </a>
          ) : null}
        </Notice>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-muted">We&apos;ll share the price once we&apos;ve seen your file.</p>
        <button type="submit" disabled={!valid} className={btn("primary")}>
          {busy ? "Placing order…" : "Place order"}
        </button>
      </div>
    </form>
  );
}
