import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { findRevisionByStorageKey } from "@/lib/drill-templates/data";

const FILES_ROOT = path.join(process.cwd(), "src/lib/drill-templates/files");

const CONTENT_TYPES: Record<string, string> = {
  CDR: "application/octet-stream",
  PDF: "application/pdf",
  ZIP: "application/zip",
};

/**
 * Streams a current-revision drill template file to a signed-in RMJV user.
 *
 * `key` must match a `storageKey` from the hardcoded revision list — that's the
 * allow-list, not the request, so there's nothing here for path traversal to reach.
 */
export async function GET(request: NextRequest) {
  await requireSession();

  const key = request.nextUrl.searchParams.get("key") ?? "";
  const revision = findRevisionByStorageKey(key);
  if (!revision) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const bytes = await readFile(path.join(FILES_ROOT, revision.storageKey));
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": CONTENT_TYPES[revision.type],
      "Content-Disposition": `attachment; filename="${revision.fileName}"`,
    },
  });
}
