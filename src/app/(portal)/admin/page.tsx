import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_MODE, HAS_SUPABASE } from "@/lib/config";
import { HAS_SWIPE } from "@/lib/swipe";
import { isBillingConfigured } from "@/lib/billing";
import { listAllOrders } from "@/lib/data/orders";
import { listProducts } from "@/lib/data/products";
import { listAllowedUsers } from "@/lib/data/users";
import { formatINR } from "@/lib/money";
import { Badge, btn, Card, formatDate, Notice } from "@/components/ui";
import { StatusBadge } from "@/components/status";

export const metadata: Metadata = { title: "Admin" };

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      <span
        aria-hidden
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          ok ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning"
        }`}
      >
        {ok ? "✓" : "!"}
      </span>
      <div>
        <p className="text-sm font-medium text-ink">
          {label}{" "}
          <span className="sr-only">{ok ? "configured" : "not configured"}</span>
        </p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </li>
  );
}

export default async function AdminOverviewPage() {
  const [orders, products, staff] = await Promise.all([
    listAllOrders(),
    listProducts({ includeInactive: true }),
    listAllowedUsers(),
  ]);

  const needsAction = orders.filter(
    (o) => o.payment_status === "paid" && o.status !== "delivered" && o.status !== "cancelled",
  );
  const unpaid = orders.filter((o) => o.payment_status === "unpaid");
  const revenue = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div className="space-y-6">
      {DEMO_MODE ? (
        <Notice tone="warning" title="Demo mode">
          Supabase isn&apos;t configured, so everything here is seeded sample data held in
          memory. It resets when the server restarts.
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "To fulfil", value: String(needsAction.length), hint: "Paid, not delivered" },
          { label: "Unpaid", value: String(unpaid.length), hint: "Awaiting payment" },
          { label: "Collected", value: formatINR(revenue), hint: "Across paid orders" },
          { label: "Staff", value: String(staff.filter((s) => s.active).length), hint: "Active logins" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">{stat.label}</p>
            <p className="mt-1.5 text-xl font-semibold text-ink nums">{stat.value}</p>
            <p className="mt-0.5 text-xs text-muted">{stat.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Needs your attention</h2>
            <Link href="/admin/orders" className="text-sm font-medium text-accent hover:underline">
              All orders
            </Link>
          </div>

          {needsAction.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted">
              Nothing waiting on production right now.
            </Card>
          ) : (
            <ul className="space-y-2">
              {needsAction.slice(0, 8).map((order) => (
                <Card as="li" key={order.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href="/admin/orders"
                          className="font-medium text-accent hover:underline"
                        >
                          {order.order_number}
                        </Link>
                        <Badge>{order.user_email}</Badge>
                        <Badge>{formatDate(order.created_at)}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {(order.items ?? [])
                          .map((i) => `${i.product?.name ?? "Item"} ×${i.quantity}`)
                          .join(", ")}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                    <span className="font-medium text-ink nums">
                      {formatINR(order.total_amount)}
                    </span>
                  </div>
                </Card>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold text-ink">Deployment checklist</h2>
            <ul className="mt-2 divide-y divide-line">
              <Check
                ok={HAS_SUPABASE}
                label="Supabase"
                detail={HAS_SUPABASE ? "Connected — live data." : "Missing keys — running on demo data."}
              />
              <Check
                ok={HAS_SWIPE}
                label="SWIPE invoicing"
                detail={
                  HAS_SWIPE
                    ? "GST invoices are issued on SWIPE when an order reaches Completed."
                    : "No API key — invoices fall back to the built-in draft PDF."
                }
              />
              <Check
                ok={isBillingConfigured}
                label="GST invoice details"
                detail={
                  isBillingConfigured
                    ? "Supplier and buyer GSTINs are set."
                    : "Invoices render as DRAFT until GSTINs are set."
                }
              />
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-ink">Catalog</h2>
            <p className="mt-1 text-sm text-muted">
              {products.filter((p) => p.active).length} active ·{" "}
              {products.filter((p) => !p.active).length} hidden
            </p>
            <Link href="/admin/products" className={btn("secondary", "mt-3 w-full")}>
              Manage catalog
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
