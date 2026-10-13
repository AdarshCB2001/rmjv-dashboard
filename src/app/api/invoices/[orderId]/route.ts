import { getSession } from "@/lib/auth";
import { getOrder } from "@/lib/data/orders";
import { ensureInvoice } from "@/lib/data/invoices";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

/**
 * Streams the GST invoice for a paid order.
 *
 * Rendered on demand rather than stored: the numbers come from the order's own line
 * items, so there's no stale-PDF problem, and the invoice number is allocated once and
 * reused. Only paid orders get one — an unpaid order has no taxable event yet.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in." }, { status: 401 });

  const order = await getOrder(orderId, session.isAdmin ? null : session.email);
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });

  if (order.payment_status !== "paid") {
    return Response.json(
      { error: "An invoice is issued once the order is paid." },
      { status: 409 },
    );
  }

  try {
    const invoice = await ensureInvoice(order.id);
    const pdf = await renderInvoicePdf(order, invoice);
    const fileName = `${invoice.invoice_number.replace(/[^\w.-]+/g, "-")}.pdf`;

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        // Invoices are per-user documents; never let a shared cache hold one.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[invoices] render failed", error);
    return Response.json({ error: "Could not generate the invoice." }, { status: 500 });
  }
}
