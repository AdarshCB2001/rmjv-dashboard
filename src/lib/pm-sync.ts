import "server-only";
import { readFileSync } from "node:fs";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defaultPdfUrl } from "@/lib/catalog";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/types";

/**
 * Two-way link with the FunKustoms project management app (Firestore project
 * finquest-6faed). Confirming an order creates a task under "Spintly Orders"; the
 * task's stage there drives the order's status here. Off unless a service account is
 * configured, so a bare checkout still runs.
 *
 * The PM app is live with real orders, so this only ever touches tasks it created
 * itself (ids "rmjv-<order number>") and never edits its shared project list.
 */

const ORG = "orgs/funkustoms-main";
export const PM_PROJECT = "Spintly Orders";

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
export const HAS_PM_SYNC = Boolean(SERVICE_ACCOUNT_PATH || SERVICE_ACCOUNT_JSON);

function firestore() {
  if (getApps().length === 0) {
    const raw = SERVICE_ACCOUNT_JSON ?? readFileSync(SERVICE_ACCOUNT_PATH!, "utf8");
    initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
  }
  return getFirestore();
}

const tasks = () => firestore().collection(`${ORG}/tasks`);

/** PM stage -> what it means for the portal order. Replacement leaves the order alone. */
export function mapStage(stage: string): { status?: OrderStatus; payment?: PaymentStatus } {
  switch (stage) {
    case "new_request":
    case "design":
      return { status: "confirmed" };
    case "production":
      return { status: "printing" };
    case "completed":
      return { status: "shipped" };
    case "delivered":
      return { status: "delivered" };
    case "payment":
      return { payment: "paid" };
    case "discarded":
      return { status: "cancelled" };
    default:
      return {};
  }
}

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

/** Creates the PM task for a confirmed order. Idempotent: the id is derived from the order. */
export async function pushOrderToPm(order: Order): Promise<string> {
  const id = `rmjv-${order.order_number}`;
  const items = order.items ?? [];
  const pieces = items.reduce((n, i) => n + i.quantity, 0);
  const allDrill = items.length > 0 && items.every((i) => i.product?.name.startsWith("Drill Templates"));

  const lines = items.map((i) => {
    const name = i.product?.name ?? "Item";
    const art = i.file_version > 0 ? "customer artwork uploaded" : defaultPdfUrl(name) ? "standard product PDF" : "no artwork";
    return `• ${name} × ${i.quantity}${i.notes ? ` — ${i.notes}` : ""} (${art})`;
  });
  const description = [
    `RMJV portal order ${order.order_number} from ${order.user_email}.`,
    ...lines,
    order.notes ? `Order note: ${order.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const customTitle = /^Order title: (.+)$/m.exec(items[0]?.notes ?? "")?.[1];

  const ref = tasks().doc(id);
  if ((await ref.get()).exists) return id;

  await ref.set({
    title: `${order.order_number} · ${
      customTitle ??
      (items.length === 1 ? `${items[0].product?.name ?? "Order"} × ${items[0].quantity}` : `${items.length} items`)
    }`,
    project: PM_PROJECT,
    stage: "new_request",
    priority: "Normal",
    customer: "Spintly",
    assignees: [],
    assigneeUids: [],
    tags: ["RMJV Portal"],
    quantity: pieces,
    printType: allDrill ? "Drill Templates" : "Other",
    deadline: "",
    description,
    createdAt: today(),
    subtasks: [],
    activity: [],
    source: "rmjv-portal",
    updatedBy: "rmjv-portal",
    updatedAt: FieldValue.serverTimestamp(),
  });
  return id;
}

/**
 * Brings linked orders in line with their PM task's stage (one batched read). Returns
 * the orders with any changes applied, plus what to persist. A PM read failure must
 * never break the portal, so errors fall back to the orders as stored.
 */
export async function pullStages(
  orders: Order[],
): Promise<{ orders: Order[]; changes: { id: string; patch: { status?: OrderStatus; payment_status?: PaymentStatus } }[] }> {
  const linked = orders.filter((o) => o.pm_task_id);
  if (!HAS_PM_SYNC || linked.length === 0) return { orders, changes: [] };

  try {
    const snaps = await firestore().getAll(...linked.map((o) => tasks().doc(o.pm_task_id!)));
    const stageByTask = new Map(snaps.filter((s) => s.exists).map((s) => [s.id, String(s.data()?.stage)]));

    const changes: { id: string; patch: { status?: OrderStatus; payment_status?: PaymentStatus } }[] = [];
    const next = orders.map((o) => {
      const stage = o.pm_task_id ? stageByTask.get(o.pm_task_id) : undefined;
      if (!stage) return o;
      const { status, payment } = mapStage(stage);
      const patch: { status?: OrderStatus; payment_status?: PaymentStatus } = {};
      if (status && status !== o.status) patch.status = status;
      if (payment && payment !== o.payment_status) patch.payment_status = payment;
      if (Object.keys(patch).length === 0) return o;
      changes.push({ id: o.id, patch });
      return { ...o, ...patch };
    });
    return { orders: next, changes };
  } catch (error) {
    console.error("[pm-sync] could not read PM stages", error);
    return { orders, changes: [] };
  }
}
