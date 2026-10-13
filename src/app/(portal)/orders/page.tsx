import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listOrders } from "@/lib/data/orders";
import { formatINR } from "@/lib/money";
import { btn, Card, EmptyState, formatDate, PageHeader } from "@/components/ui";
import { PaymentBadge, StatusBadge } from "@/components/status";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const session = await requireSession();
  const orders = await listOrders(session.email);

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every job you've placed, with status, artwork and invoices."
        actions={
          <Link href="/products" className={btn("secondary")}>
            New order
          </Link>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Once you place an order it'll show up here with its status, uploaded artwork and GST invoice."
          action={
            <Link href="/products" className={btn("primary")}>
              Browse catalog
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {/* The table scrolls inside its own container so the page never scrolls sideways. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-line bg-surface-2 text-left">
                <tr className="text-xs font-medium tracking-wide text-muted uppercase">
                  <th scope="col" className="px-4 py-2.5">Order</th>
                  <th scope="col" className="px-4 py-2.5">Placed</th>
                  <th scope="col" className="px-4 py-2.5">Items</th>
                  <th scope="col" className="px-4 py-2.5">Status</th>
                  <th scope="col" className="px-4 py-2.5">Payment</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="max-w-[18rem] px-4 py-3">
                      <span className="line-clamp-1 text-body">
                        {(order.items ?? [])
                          .map((i) => `${i.product?.name ?? "Item"} ×${i.quantity}`)
                          .join(", ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PaymentBadge status={order.payment_status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-ink nums whitespace-nowrap">
                      {formatINR(order.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
