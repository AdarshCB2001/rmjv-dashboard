import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listOrders } from "@/lib/data/orders";
import { listProducts } from "@/lib/data/products";
import { formatINR } from "@/lib/money";
import { Badge, btn, Card, EmptyState, formatDate, PageHeader } from "@/components/ui";
import { PaymentBadge, StatusBadge } from "@/components/status";

export const metadata: Metadata = { title: "Overview" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-ink nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const [orders, products] = await Promise.all([listOrders(session.email), listProducts()]);

  const openOrders = orders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled",
  );
  const awaitingPayment = orders.filter((o) => o.payment_status === "unpaid");
  const outstanding = awaitingPayment.reduce((sum, o) => sum + o.total_amount, 0);
  const recent = orders.slice(0, 5);

  const firstName = session.fullName?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : "Overview"}
        description="Your open jobs, anything waiting on payment, and a one-click way back to the catalog."
        actions={
          <Link href="/products" className={btn("primary")}>
            Browse catalog
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Open orders"
          value={String(openOrders.length)}
          hint={openOrders.length ? "In progress with us" : "Nothing in the queue"}
        />
        <Stat
          label="Awaiting payment"
          value={String(awaitingPayment.length)}
          hint={outstanding > 0 ? `${formatINR(outstanding)} outstanding` : "All settled"}
        />
        <Stat label="Products available" value={String(products.length)} hint="In your catalog" />
      </div>

      {awaitingPayment.length > 0 ? (
        <Card className="mt-6 border-warning/40 bg-warning-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                {awaitingPayment.length === 1
                  ? "One order is waiting on payment"
                  : `${awaitingPayment.length} orders are waiting on payment`}
              </p>
              <p className="mt-0.5 text-sm text-body">
                We start production once payment clears — {formatINR(outstanding)} outstanding.
              </p>
            </div>
            <Link href={`/orders/${awaitingPayment[0].id}`} className={btn("primary")}>
              Pay now
            </Link>
          </div>
        </Card>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Recent orders</h2>
          {orders.length > 0 ? (
            <Link href="/orders" className="text-sm font-medium text-accent hover:underline">
              View all
            </Link>
          ) : null}
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Pick something from the catalog and your reorder history will start building up here."
            action={
              <Link href="/products" className={btn("primary")}>
                Browse catalog
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {recent.map((order) => (
              <Card as="li" key={order.id} className="p-4 transition-colors hover:bg-surface-2">
                <Link href={`/orders/${order.id}`} className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">{order.order_number}</p>
                      <Badge>{formatDate(order.created_at)}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {(order.items ?? [])
                        .map((i) => `${i.product?.name ?? "Item"} ×${i.quantity}`)
                        .join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={order.status} />
                    <PaymentBadge status={order.payment_status} />
                    <span className="w-24 text-right font-medium text-ink nums">
                      {formatINR(order.total_amount)}
                    </span>
                  </div>
                </Link>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
