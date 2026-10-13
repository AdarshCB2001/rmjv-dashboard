import { getSession } from "@/lib/auth";
import { findOrderByItem } from "@/lib/data/orders";
import { createUploadTarget, validateUpload } from "@/lib/data/files";

/**
 * Issues a signed, single-use upload URL for one order line.
 *
 * Ownership is established by resolving the line id scoped to the caller's email, and
 * the storage path is built server-side from ids we just verified — the client never
 * gets to choose where its bytes land. Type and size are re-validated here because the
 * client-side check is only a convenience.
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

  const { orderItemId, fileName, fileSize } = body;
  if (typeof orderItemId !== "string" || typeof fileName !== "string") {
    return Response.json({ error: "Missing file details." }, { status: 400 });
  }

  const invalid = validateUpload(fileName, Number(fileSize));
  if (invalid) return Response.json(invalid, { status: 400 });

  const order = await findOrderByItem(orderItemId, session.email);
  if (!order) return Response.json({ error: "That order line wasn't found." }, { status: 404 });

  try {
    const target = await createUploadTarget(order.id, orderItemId, fileName);
    return Response.json(target);
  } catch (error) {
    console.error("[uploads/sign] failed", error);
    return Response.json({ error: "Could not prepare the upload." }, { status: 500 });
  }
}
