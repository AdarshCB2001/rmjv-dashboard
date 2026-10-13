import crypto from "node:crypto";
import { RAZORPAY_WEBHOOK_SECRET } from "@/lib/config";
import { getOrder, markOrderPaid } from "@/lib/data/orders";
import { ensureInvoice } from "@/lib/data/invoices";

/**
 * Razorpay webhook — the authoritative settlement path.
 *
 * The browser callback in `/api/payments/verify` can be lost (tab closed, network
 * dropped, UPI confirmed late), which would leave a paid order showing as unpaid. This
 * endpoint closes that gap, so it must be unauthenticated — the webhook signature over
 * the raw body is what authenticates it. Both paths are idempotent.
 *
 * Configure it in the Razorpay dashboard: POST {SITE_URL}/api/razorpay-webhook,
 * event `payment.captured`, with RAZORPAY_WEBHOOK_SECRET matching.
 */
export async function POST(request: Request) {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    return Response.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });

  // Signature is over the exact bytes received, so read the body as text and only
  // parse it after the check passes.
  const raw = await request.text();
  const expected = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(raw)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.warn("[razorpay-webhook] signature mismatch");
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; notes?: Record<string, string> } } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Malformed payload." }, { status: 400 });
  }

  if (event.event !== "payment.captured" && event.event !== "order.paid") {
    // Acknowledge anything we don't act on, so Razorpay stops retrying it.
    return Response.json({ ok: true, ignored: event.event });
  }

  const payment = event.payload?.payment?.entity;
  const ourOrderId = payment?.notes?.order_id;
  if (!payment?.id || !ourOrderId) {
    return Response.json({ ok: true, ignored: "no order reference" });
  }

  // null = admin scope: a webhook has no session to scope the lookup to.
  const order = await getOrder(ourOrderId, null);
  if (!order) return Response.json({ ok: true, ignored: "unknown order" });
  if (order.payment_status === "paid") return Response.json({ ok: true, alreadyPaid: true });

  await markOrderPaid(order.id, payment.id, payment.order_id ?? "");
  try {
    await ensureInvoice(order.id);
  } catch (error) {
    console.error("[razorpay-webhook] invoice creation failed", error);
  }

  return Response.json({ ok: true });
}
