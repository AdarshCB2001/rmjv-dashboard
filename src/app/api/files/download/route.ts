import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getOrder } from "@/lib/data/orders";
import { signedDownloadUrl } from "@/lib/data/files";

/**
 * Redirects to a short-lived signed URL for an order file.
 *
 * The bucket is private, so this is the only way to read one. Authorisation comes from
 * the path's first segment being an order id the caller owns — admins get any order,
 * customers only their own. Never hand out the storage path itself as a public link.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const path = request.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "Missing path." }, { status: 400 });

  // Reject traversal before the path is used for anything.
  if (path.includes("..") || path.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const [orderId] = path.split("/");
  if (!orderId) return NextResponse.json({ error: "Invalid path." }, { status: 400 });

  const order = await getOrder(orderId, session.isAdmin ? null : session.email);
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const url = await signedDownloadUrl(path);
  if (!url) {
    return NextResponse.json(
      { error: "File storage isn't configured on this deployment." },
      { status: 503 },
    );
  }

  return NextResponse.redirect(url);
}
