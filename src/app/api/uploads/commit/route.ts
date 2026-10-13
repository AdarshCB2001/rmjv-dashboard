import { getSession } from "@/lib/auth";
import { findOrderByItem } from "@/lib/data/orders";
import { commitUpload, validateUpload } from "@/lib/data/files";

/**
 * Records a completed upload as the next artwork version.
 *
 * Re-checks ownership and file rules rather than trusting that the client came from
 * `/api/uploads/sign`, and re-derives the storage path from verified ids so a caller
 * can't point an order line at some other object in the bucket.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const { orderItemId, path, fileName, fileSize, version } = body;
  if (
    typeof orderItemId !== "string" ||
    typeof path !== "string" ||
    typeof fileName !== "string"
  ) {
    return Response.json({ error: "Missing upload details." }, { status: 400 });
  }

  const size = Number(fileSize);
  const invalid = validateUpload(fileName, size);
  if (invalid) return Response.json(invalid, { status: 400 });

  const versionNumber = Number(version);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return Response.json({ error: "Invalid version." }, { status: 400 });
  }

  const order = await findOrderByItem(orderItemId, session.email);
  if (!order) return Response.json({ error: "That order line wasn't found." }, { status: 404 });

  // The path must sit under this order's own prefix.
  if (!path.startsWith(`${order.id}/${orderItemId}/`)) {
    return Response.json({ error: "Invalid upload path." }, { status: 400 });
  }

  try {
    const file = await commitUpload({
      orderItemId,
      path,
      fileName,
      fileSize: size,
      version: versionNumber,
      uploadedBy: session.email,
    });
    return Response.json({ ok: true, file });
  } catch (error) {
    console.error("[uploads/commit] failed", error);
    return Response.json({ error: "Could not save the upload." }, { status: 500 });
  }
}
