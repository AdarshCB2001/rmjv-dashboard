"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Thumbnail that opens full screen on click and stays open until closed (button or Esc). */
export function PreviewLightbox({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${alt} full screen`}
        className="block w-full cursor-zoom-in"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="mx-auto max-h-56 w-auto rounded border border-line bg-white object-contain"
        />
      </button>
      {caption ? <p className="mt-2 text-center text-xs text-muted nums">{caption}</p> : null}

      {/* Portaled to <body>: inside the sticky sidebar it was stacked beneath the page header. */}
      {open
        ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-black shadow"
          >
            Close ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-full max-w-full rounded bg-white object-contain" />
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
