import Razorpay from "razorpay";
import { HAS_RAZORPAY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "@/lib/config";
import { getSession } from "@/lib/auth";
import { getOrder, setRazorpayOrderId } from "@/lib/data/orders";
import { orderTotals, toPaise } from "@/lib/money";

/**
 * Starts a payment for an order.
 *
 * The amount is recomputed from the stored line items — the client sends only an order
 * id. Anything else would let a caller name their own price.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in." }, { status: 401 });

  let orderId: unknown;
  try {
    ({ orderId } = await request.json());
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }
  if (typeof orderId !== "string") {
    return Response.json({ error: "Missing order id." }, { status: 400 });
  }

  const order = await getOrder(orderId, session.email);
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  if (order.payment_status === "paid") {
    return Response.json({ error: "This order is already paid." }, { status: 409 });
  }

  const total = orderTotals(order.items ?? []).total;
  if (total <= 0) {
    return Response.json({ error: "This order has nothing to pay for." }, { status: 400 });
  }

  // No keys configured: tell the client to use the simulated path instead of failing.
  if (!HAS_RAZORPAY) {
    return Response.json({ simulated: true, amount: toPaise(total), currency: "INR" });
  }

  try {
    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID!,
      key_secret: RAZORPAY_KEY_SECRET!,
    });

    const rpOrder = await razorpay.orders.create({
      amount: toPaise(total),
      currency: "INR",
      receipt: order.order_number,
      notes: { order_id: order.id, user_email: order.user_email },
    });

    // Stored so the webhook can map a Razorpay order back to ours.
    await setRazorpayOrderId(order.id, rpOrder.id);

    return Response.json({
      simulated: false,
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("[payments/create] Razorpay order failed", error);
    return Response.json({ error: "Could not reach the payment gateway." }, { status: 502 });
  }
}
