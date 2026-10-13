import { HAS_RAZORPAY } from "@/lib/config";
import { getSession } from "@/lib/auth";
import { getOrder, markOrderPaid } from "@/lib/data/orders";
import { ensureInvoice } from "@/lib/data/invoices";

/**
 * Settles an order without a real payment, so the post-payment half of the app
 * (invoice, status, tracking) is walkable before Razorpay is set up.
 *
 * Hard-refuses whenever Razorpay keys are present, which means it cannot exist as a
 * free-order backdoor in a configured deployment.
 */
export async function POST(request: Request) {
  if (HAS_RAZORPAY) {
    return Response.json(
      { error: "Simulated payments are disabled once Razorpay is configured." },
      { status: 403 },
    );
  }

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
  if (order.payment_status === "paid") return Response.json({ ok: true, alreadyPaid: true });

  const stamp = Date.now().toString(36);
  await markOrderPaid(order.id, `pay_sim_${stamp}`, `order_sim_${stamp}`);
  await ensureInvoice(order.id);

  return Response.json({ ok: true, simulated: true });
}
