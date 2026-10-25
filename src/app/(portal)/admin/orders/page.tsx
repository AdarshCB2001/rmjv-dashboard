import type { Metadata } from "next";
import { listAllOrders } from "@/lib/data/orders";
import { defaultPdfUrl } from "@/lib/catalog";
import { Card } from "@/components/ui";
import { OrderAdminForm } from "./OrderAdminForm";

export const metadata: Metadata = { title: "Admin · Orders" };

export default async function AdminOrdersPage() {
  const orders = await listAllOrders();

  return (
    <div className="space-y-3">
      {orders.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">No orders yet.</Card>
      ) : (
        orders.map((order) => <OrderAdminForm
            key={order.id}
            order={order}
            defaultFiles={Object.fromEntries(
              (order.items ?? []).map((i) => [i.id, defaultPdfUrl(i.product?.name ?? "")]),
            )}
          />)
      )}
    </div>
  );
}
