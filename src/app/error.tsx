"use client";

import { useEffect } from "react";
import { btn } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal] unhandled error", error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Something broke</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          That&apos;s on us. Try again — if it keeps happening, message us in chat and mention
          {error.digest ? (
            <>
              {" "}
              reference <span className="font-mono text-xs">{error.digest}</span>.
            </>
          ) : (
            " what you were doing."
          )}
        </p>
        <button type="button" onClick={reset} className={btn("primary", "mt-6")}>
          Try again
        </button>
      </div>
    </main>
  );
}
