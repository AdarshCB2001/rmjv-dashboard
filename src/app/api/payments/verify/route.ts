import crypto from "node:crypto";
import { HAS_RAZORPAY, RAZORPAY_KEY_SECRET } from "@/lib/config";
import { getSession } from "@/lib/auth";
import { getOrder, markOrderPaid } from "@/lib/data/orders";
import { ensureInvoice } from "@/lib/data/invoices";

/** Constant-time compare of two hex digests. */
function signatureMatches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Confirms a payment.
 *
 * The order is marked paid only if the HMAC over `{razorpay_order_id}|{razorpay_payment_id}`
 * matches, computed with the key secret that never leaves the server. Trusting the
 * client's word that a payment succeeded is the classic way to get a free order.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in." }, { status: 401 });

  if (!HAS_RAZORPAY) {
    return Response.json({ error: "Razorpay is not configured." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const orderId = body.orderId;
  const rpOrderId = body.razorpay_order_id;
  const rpPaymentId = body.razorpay_payment_id;
  const rpSignature = body.razorpay_signature;

  if (
    typeof orderId !== "string" ||
    typeof rpOrderId !== "string" ||
    typeof rpPaymentId !== "string" ||
    typeof rpSignature !== "string"
  ) {
    return Response.json({ error: "Missing payment details." }, { status: 400 });
  }

  const order = await getOrder(orderId, session.email);
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });

  // Already settled (e.g. the webhook got here first) — succeed idempotently.
  if (order.payment_status === "paid") {
    return Response.json({ ok: true, alreadyPaid: true });
  }

  const expected = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET!)
    .update(`${rpOrderId}|${rpPaymentId}`)
    .digest("hex");

  if (!signatureMatches(expected, rpSignature)) {
    console.warn("[payments/verify] signature mismatch", { orderId, rpOrderId });
    return Response.json({ error: "That payment could not be verified." }, { status: 400 });
  }

  await markOrderPaid(order.id, rpPaymentId, rpOrderId);

  // Payment confirmed is the trigger for issuing the invoice.
  try {
    await ensureInvoice(order.id);
  } catch (error) {
    // The payment is real and recorded; a failed invoice number shouldn't 500 the
    // customer's checkout. It gets created on first download instead.
    console.error("[payments/verify] invoice creation failed", error);
  }

  return Response.json({ ok: true });
}
