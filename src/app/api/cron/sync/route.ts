import { timingSafeEqual } from "node:crypto";
import { listAllOrders } from "@/lib/data/orders";

/**
 * Lets a scheduler (cron-job.org, Vercel Cron, ...) run the order sync without anyone
 * opening the portal: pulls project-management stages and issues SWIPE invoices for orders
 * that have reached Completed. Call GET with `Authorization: Bearer $CRON_SECRET`, e.g.
 * every 5 minutes. Off (404) until CRON_SECRET is set.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return new Response(null, { status: 404 });

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const orders = await listAllOrders();
  return Response.json({
    ok: true,
    orders: orders.length,
    invoiced: orders.filter((o) => o.swipe_hash_id).length,
  });
}
