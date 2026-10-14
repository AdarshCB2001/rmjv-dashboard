import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { findDrillTemplateModel } from "@/lib/drill-templates/data";

const PREVIEWS_ROOT = path.join(process.cwd(), "src/lib/drill-templates/previews");

/**
 * Serves a model's preview PNG (extracted from its current-revision CDR) to a
 * signed-in RMJV user. `slug` is checked against the known model list — not read
 * from disk directly — so there's nothing here for path traversal to reach.
 */
export async function GET(request: NextRequest) {
  await requireSession();

  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  const model = findDrillTemplateModel(slug);
  if (!model) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const bytes = await readFile(path.join(PREVIEWS_ROOT, `${model.slug}.png`));
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
