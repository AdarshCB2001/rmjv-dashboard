"use client";

import { useActionState } from "react";
import { DEMO_MODE } from "@/lib/config";
import { ORDER_STATUSES, type Order } from "@/lib/types";
import { formatINR } from "@/lib/money";
import { statusLabel, PaymentBadge } from "@/components/status";
import { Badge, Card, formatDate, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { updateOrder, type ActionState } from "../actions";

const STATUS_OPTIONS = [...ORDER_STATUSES, "cancelled" as const];

/**
 * One editable row per order: status, courier and tracking number.
 *
 * v1 is deliberately manual. If a courier API gets wired in later (Shiprocket,
 * Delhivery), a scheduled job can write the same fields and this form stays the
 * override.
 */
export function OrderAdminForm({ order }: { order: Order }) {
  const [state, action] = useActionState<ActionState, FormData>(updateOrder, {});

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-ink">{order.order_number}</h2>
            <PaymentBadge status={order.payment_status} />
            <Badge>{formatDate(order.created_at)}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">{order.user_email}</p>
        </div>
        <p className="font-semibold text-ink nums">{formatINR(order.total_amount)}</p>
      </div>

      <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
        {(order.items ?? []).map((item) => (
          <li key={item.id} className="flex flex-wrap justify-between gap-2">
            <span className="text-body">
              {item.product?.name ?? "Item"} × {item.quantity}
              {item.notes ? <span className="text-muted"> — {item.notes}</span> : null}
            </span>
            <span className="text-muted">
              {item.file_version > 0 ? (
                DEMO_MODE ? (
                  <span className="text-xs">artwork v{item.file_version} (demo)</span>
                ) : (
                  <a
                    href={`/api/files/download?path=${encodeURIComponent(item.file_url ?? "")}`}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    artwork v{item.file_version}
                  </a>
                )
              ) : (
                <span className="text-xs text-warning">no artwork yet</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <form action={action} className="mt-4 space-y-3 border-t border-line pt-4">
        <input type="hidden" name="order_id" value={order.id} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor={`status-${order.id}`} className="block text-xs font-medium text-ink">
              Status
            </label>
            <select
              id={`status-${order.id}`}
              name="status"
              defaultValue={order.status}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={`courier-${order.id}`} className="block text-xs font-medium text-ink">
              Courier
            </label>
            <input
              id={`courier-${order.id}`}
              name="courier"
              defaultValue={order.courier ?? ""}
              placeholder="Delhivery"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`tracking-${order.id}`} className="block text-xs font-medium text-ink">
              Tracking number
            </label>
            <input
              id={`tracking-${order.id}`}
              name="tracking_number"
              defaultValue={order.tracking_number ?? ""}
              placeholder="AWB / docket no."
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor={`notes-${order.id}`} className="block text-xs font-medium text-ink">
            Note to the customer
          </label>
          <input
            id={`notes-${order.id}`}
            name="notes"
            defaultValue={order.notes ?? ""}
            placeholder="Shown on their order page"
            className={inputClass}
          />
        </div>

        <FormMessage state={state} />

        <SubmitButton variant="secondary">Save changes</SubmitButton>
      </form>
    </Card>
  );
}
