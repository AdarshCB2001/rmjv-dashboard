"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_BYTES } from "@/lib/config";
import { btn, Notice } from "./ui";

const ACCEPT = ALLOWED_FILE_EXTENSIONS.join(",");

/**
 * Uploads artwork for one order line.
 *
 * The bytes go straight from the browser to Supabase Storage using a short-lived
 * signed URL, so a 50MB .ai file never passes through a route handler. The two
 * server round-trips either side (`sign`, then `commit`) are what re-validate type and
 * size and record the new version — the checks here are only for fast feedback.
 */
export function FileUpload({
  orderItemId,
  currentVersion,
}: {
  orderItemId: string;
  currentVersion: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    setDone(null);

    if (!ALLOWED_FILE_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setError(`Accepted formats: ${ALLOWED_FILE_EXTENSIONS.join(", ")}.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over the 50MB limit.");
      return;
    }

    setBusy(true);
    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId, fileName: file.name, fileSize: file.size }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign?.error ?? "Could not start the upload.");

      if (sign.signedUrl) {
        const put = await fetch(sign.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) throw new Error("The upload didn't complete. Try again.");
      }

      const commitRes = await fetch("/api/uploads/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderItemId,
          path: sign.path,
          version: sign.version,
          fileName: file.name,
          fileSize: file.size,
        }),
      });
      const commit = await commitRes.json();
      if (!commitRes.ok) throw new Error(commit?.error ?? "Could not save the upload.");

      setDone(
        sign.signedUrl
          ? `Uploaded as v${sign.version}.`
          : `Recorded as v${sign.version}. (Demo mode stores the filename, not the file.)`,
      );
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={`file-${orderItemId}`}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={btn("secondary")}
        >
          {busy
            ? "Uploading…"
            : currentVersion > 0
              ? `Upload new version (v${currentVersion + 1})`
              : "Upload artwork"}
        </button>
        <span className="text-xs text-muted">
          {ALLOWED_FILE_EXTENSIONS.join(", ")} · up to 50MB
        </span>
      </div>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {done ? <Notice tone="positive">{done}</Notice> : null}
    </div>
  );
}
