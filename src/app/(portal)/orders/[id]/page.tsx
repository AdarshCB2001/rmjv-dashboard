import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_MODE } from "@/lib/config";
import { requireSession } from "@/lib/auth";
import { getOrder } from "@/lib/data/orders";
import { listFilesForOrder, formatFileSize } from "@/lib/data/files";
import { formatINR, lineTotals, orderTotals } from "@/lib/money";
import { isIntraState } from "@/lib/billing";
import {
  Badge,
  btn,
  Card,
  DescriptionRow,
  formatDate,
  formatDateTime,
  Notice,
  PageHeader,
} from "@/components/ui";
import { PaymentBadge, StatusBadge, StatusStepper } from "@/components/status";
import { PayButton } from "@/components/PayButton";
import { FileUpload } from "@/components/FileUpload";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pay?: string }>;
}) {
  const [{ id }, { pay }] = await Promise.all([params, searchParams]);
  const session = await requireSession();

  // Scoped to this user's email, so someone else's order id 404s rather than leaking.
  const order = await getOrder(id, session.email);
  if (!order) notFound();

  const items = order.items ?? [];
  const filesByItem = await listFilesForOrder(items.map((i) => i.id));
  const totals = orderTotals(items);
  const unpaid = order.payment_status === "unpaid" || order.payment_status === "failed";
  const intraState = isIntraState();

  return (
    <>
      <div className="mb-1">
        <Link href="/orders" className="text-sm text-muted hover:text-ink">
          ← All orders
        </Link>
      </div>

      <PageHeader
        title={order.order_number}
        description={`Placed ${formatDateTime(order.created_at)}`}
        actions={
          <>
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.payment_status} />
          </>
        }
      />

      <Card className="p-5">
        <StatusStepper status={order.status} />
        {order.tracking_number ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line pt-4 text-sm">
            <span className="text-muted">
              Courier: <span className="font-medium text-ink">{order.courier ?? "—"}</span>
            </span>
            <span className="text-muted">
              Tracking:{" "}
              <span className="font-mono font-medium text-ink">{order.tracking_number}</span>
            </span>
          </div>
        ) : null}
        {order.notes ? (
          <p className="mt-4 border-t border-line pt-4 text-sm text-body">
            <span className="font-medium text-ink">Note on this order: </span>
            {order.notes}
          </p>
        ) : null}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Items &amp; artwork</h2>

          {items.map((item) => {
            const files = filesByItem.get(item.id) ?? [];
            const line = lineTotals(item.unit_price, item.quantity, item.gst_rate);

            return (
              <Card key={item.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-ink">{item.product?.name ?? "Item"}</h3>
                    <p className="mt-0.5 text-sm text-muted nums">
                      {item.quantity} × {formatINR(item.unit_price)}{" "}
                      {item.product?.unit ? `(${item.product.unit})` : ""} · +{item.gst_rate}% GST
                    </p>
                  </div>
                  <p className="font-medium text-ink nums">{formatINR(line.total)}</p>
                </div>

                {item.notes ? (
                  <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-body">
                    {item.notes}
                  </p>
                ) : null}

                <div className="mt-4 border-t border-line pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-medium text-ink">Artwork</h4>
                    {files.length > 0 ? (
                      <Badge>
                        {files.length} version{files.length === 1 ? "" : "s"}
                      </Badge>
                    ) : null}
                  </div>

                  {files.length === 0 ? (
                    <p className="mb-3 text-sm text-muted">
                      No artwork uploaded yet. We can&apos;t start this line until we have it.
                    </p>
                  ) : (
                    <ul className="mb-3 divide-y divide-line">
                      {files.map((file) => (
                        <li
                          key={file.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Badge tone={file.version === item.file_version ? "accent" : "neutral"}>
                              v{file.version}
                            </Badge>
                            <span className="truncate font-medium text-ink">{file.file_name}</span>
                          </span>
                          <span className="flex items-center gap-3 text-xs text-muted">
                            <span className="nums">{formatFileSize(file.file_size)}</span>
                            <span>{formatDate(file.created_at)}</span>
                            {DEMO_MODE ? (
                              <span className="text-faint">demo — no file stored</span>
                            ) : (
                              <a
                                href={`/api/files/download?path=${encodeURIComponent(file.storage_path)}`}
                                className="font-medium text-accent hover:underline"
                              >
                                Download
                              </a>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <FileUpload orderItemId={item.id} currentVersion={item.file_version} />
                </div>
              </Card>
            );
          })}
        </section>

        <div className="space-y-4 lg:sticky lg:top-20">
          <Card className="p-5">
            <h2 className="font-semibold text-ink">Summary</h2>
            <dl className="mt-3 divide-y divide-line">
              <DescriptionRow label="Taxable value">
                <span className="nums">{formatINR(totals.subtotal)}</span>
              </DescriptionRow>
              {totals.byRate.map((slab) =>
                intraState ? (
                  [
                    <DescriptionRow key={`c${slab.rate}`} label={`CGST @ ${slab.rate / 2}%`}>
                      <span className="nums">{formatINR(slab.taxAmount / 2)}</span>
                    </DescriptionRow>,
                    <DescriptionRow key={`s${slab.rate}`} label={`SGST @ ${slab.rate / 2}%`}>
                      <span className="nums">{formatINR(slab.taxAmount / 2)}</span>
                    </DescriptionRow>,
                  ]
                ) : (
                  <DescriptionRow key={slab.rate} label={`IGST @ ${slab.rate}%`}>
                    <span className="nums">{formatINR(slab.taxAmount)}</span>
                  </DescriptionRow>
                ),
              )}
              <DescriptionRow label="Total">
                <span className="text-base nums">{formatINR(totals.total)}</span>
              </DescriptionRow>
            </dl>

            <div className="mt-5">
              {unpaid ? (
                <PayButton
                  orderId={order.id}
                  orderNumber={order.order_number}
                  email={session.email}
                  fullName={session.fullName}
                  autoOpen={pay === "1"}
                />
              ) : order.payment_status === "paid" ? (
                <div className="space-y-3">
                  <Notice tone="positive">
                    Paid
                    {order.payment_id ? (
                      <>
                        {" "}
                        · ref <span className="font-mono text-xs">{order.payment_id}</span>
                      </>
                    ) : null}
                  </Notice>
                  <a href={`/api/invoices/${order.id}`} className={btn("secondary", "w-full")}>
                    Download GST invoice
                  </a>
                  {order.invoice ? (
                    <p className="text-center text-xs text-muted">
                      Invoice {order.invoice.invoice_number}
                    </p>
                  ) : null}
                </div>
              ) : (
                <Notice tone="neutral">This order was refunded.</Notice>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Need a change?</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Upload a new artwork version above — we always use the latest one and keep the
              older versions on file. For anything else, message us in chat and it stays
              attached to your history.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
