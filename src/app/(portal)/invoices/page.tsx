import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { HAS_SWIPE, listCustomerDocs, type SwipeDoc } from "@/lib/swipe";
import { Badge, btn, Card, cx, EmptyState, formatDate, Notice, PageHeader } from "@/components/ui";
import { refreshInvoices } from "./actions";

export const metadata: Metadata = { title: "Invoices" };

/** Whole days from the invoice date to today (IST). */
const daysSince = (iso: string) =>
  Math.max(0, Math.floor((Date.parse(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })) - Date.parse(iso)) / 864e5));

const sinceText = (iso: string) => {
  const n = daysSince(iso);
  return `Pending since ${n} ${n === 1 ? "day" : "days"}`;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; refreshed?: string }>;
}) {
  const [{ f, refreshed }] = await Promise.all([searchParams, requireAdmin()]);

  let all: SwipeDoc[] = [];
  let failed = false;
  try {
    all = await listCustomerDocs();
  } catch (error) {
    console.error("[invoices] could not load invoices", error);
    failed = true;
  }
  const rows = all;
  const active = rows.find((x) => x.hashId === f) ?? rows[0] ?? null;
  const href = (hash: string) => `?f=${encodeURIComponent(hash)}`;

  return (
    <>
      <PageHeader
        title="Invoices"
        actions={
          HAS_SWIPE ? (
            <form action={refreshInvoices}>
              <button type="submit" className={btn("secondary")}>Refresh from SWIPE</button>
            </form>
          ) : undefined
        }
      />
      {refreshed ? (
        <div className="mb-4">
          <Notice tone={refreshed === "failed" ? "warning" : "info"}>
            {refreshed === "failed"
              ? "Could not reach SWIPE (the monthly API limit may be used up). Showing the saved list."
              : `Synced ${refreshed.replace("ok-", "")} invoices from SWIPE.`}
          </Notice>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title={!HAS_SWIPE ? "SWIPE is not connected" : failed ? "Could not load invoices" : "No invoices here yet"}
          description={
            !HAS_SWIPE
              ? "Set SWIPE_API_KEY to list invoices from SWIPE."
              : failed
                ? "Reload in a moment."
                : "New invoices appear here automatically. Use “Refresh from SWIPE” to pull in older ones."
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
          <Card className="max-h-[75vh] overflow-y-auto">
            <ul className="divide-y divide-line">
              {rows.map((x) => (
                <li key={x.hashId}>
                  <Link
                    href={href(x.hashId)}
                    replace
                    scroll={false}
                    className={cx(
                      "block px-4 py-3 hover:bg-surface-2",
                      x.hashId === active?.hashId && "bg-accent-soft",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone={x.pending > 0 ? "warning" : "positive"}>{x.pending > 0 ? "Pending" : "Paid"}</Badge>
                      <span className="font-medium text-ink nums">{x.number}</span>
                      <span className="ml-auto text-xs text-muted nums">{formatDate(x.date)}</span>
                    </div>
                    <p className="mt-1 flex justify-between gap-2 text-sm text-muted">
                      <span className="truncate">
                        {x.pending > 0 ? sinceText(x.date) : x.reference || "—"}
                      </span>
                      <span className="nums">{inr(x.total)}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {active ? (
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="truncate text-sm text-muted">
                  {active.number} · {inr(active.total)}
                  {active.pending > 0
                    ? ` · ${inr(active.pending)} · ${sinceText(active.date)}`
                    : " · paid"}
                </p>
                <a href={`/api/swipe-docs/${active.hashId}?dl=1`} className={btn("secondary")}>
                  Download
                </a>
              </div>
              <Card className="overflow-hidden">
                <iframe
                  key={active.hashId}
                  src={`/api/swipe-docs/${active.hashId}`}
                  title={active.number}
                  className="h-[75vh] min-h-[480px] w-full bg-surface-2"
                />
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
