import { ORDER_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/types";
import { Badge, cx, type Tone } from "./ui";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  printing: "In production",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending: "warning",
  confirmed: "info",
  printing: "accent",
  shipped: "info",
  delivered: "positive",
  cancelled: "danger",
};

export const statusLabel = (s: OrderStatus) => STATUS_LABEL[s] ?? s;

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{statusLabel(status)}</Badge>;
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Payment due",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
};

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  unpaid: "warning",
  paid: "positive",
  failed: "danger",
  refunded: "neutral",
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_TONE[status] ?? "neutral"}>{PAYMENT_LABEL[status] ?? status}</Badge>;
}

/**
 * Horizontal progress stepper for the order detail page. A cancelled order leaves the
 * happy path, so it gets its own line rather than a misleading half-filled track.
 */
export function StatusStepper({
  status,
  paymentStatus,
}: {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-danger" />
        <p className="text-sm font-medium text-danger">
          This order was cancelled. Talk to us in chat if that looks wrong.
        </p>
      </div>
    );
  }

  const currentIndex = ORDER_STATUSES.indexOf(status as (typeof ORDER_STATUSES)[number]);

  // Payment is the last step, after Delivered; it can be settled at any point.
  const steps = [...ORDER_STATUSES, "payment"] as const;
  const paid = paymentStatus === "paid";

  return (
    <ol className="flex flex-wrap items-start gap-y-4" aria-label="Order progress">
      {steps.map((step, i) => {
        const isPayment = step === "payment";
        const done = isPayment ? paid : i < currentIndex;
        const active = isPayment ? !paid && status === "delivered" : i === currentIndex;
        const isLast = i === steps.length - 1;

        return (
          <li key={step} className="flex flex-1 items-start gap-2 min-w-[7.5rem]">
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className={cx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold",
                  done && "border-accent bg-accent text-on-accent",
                  active && "border-accent bg-accent-soft text-accent",
                  !done && !active && "border-line-strong bg-surface text-faint",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
            </div>
            <div className="flex flex-1 items-center gap-2 pt-0.5">
              <span
                className={cx(
                  "text-xs font-medium",
                  active ? "text-ink" : done ? "text-body" : "text-faint",
                )}
              >
                {isPayment ? PAYMENT_LABEL[paymentStatus] : statusLabel(step)}
                {active ? <span className="sr-only"> (current step)</span> : null}
              </span>
              {!isLast ? (
                <span
                  aria-hidden
                  className={cx("h-px flex-1", done ? "bg-accent" : "bg-line")}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
