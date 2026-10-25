import { getSession } from "@/lib/auth";
import { getOrder } from "@/lib/data/orders";
import { ensureInvoice } from "@/lib/data/invoices";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { fetchInvoicePdf, HAS_SWIPE } from "@/lib/swipe";

/**
 * Streams the GST invoice for a shipped or delivered order (payment can follow).
 *
 * Rendered on demand rather than stored: the numbers come from the order's own line
 * items, so there's no stale-PDF problem, and the invoice number is allocated once and
 * reused. Issued when the order ships; payment is tracked separately.
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

  if (order.status !== "shipped" && order.status !== "delivered") {
    return Response.json(
      { error: "An invoice is issued once the order is shipped." },
      { status: 409 },
    );
  }

  if (HAS_SWIPE) {
    // The invoice lives on SWIPE; it is created when the order reaches Completed.
    if (!order.swipe_hash_id) {
      return Response.json({ error: "Your invoice is being prepared. Try again shortly." }, { status: 409 });
    }
    try {
      const pdf = await fetchInvoicePdf(order.swipe_hash_id);
      const name = (order.swipe_invoice_number ?? order.order_number).replace(/[^\w.-]+/g, "-");
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (error) {
      console.error("[invoices] SWIPE pdf failed", error);
      return Response.json({ error: "Could not fetch the invoice." }, { status: 502 });
    }
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
