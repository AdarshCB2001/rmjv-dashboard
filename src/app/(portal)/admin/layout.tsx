import { requireAdmin } from "@/lib/auth";
import { AdminTabs } from "./AdminTabs";

/**
 * FunKustoms-side views. `requireAdmin()` here covers every page in the segment;
 * each server action re-checks independently.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Admin</h1>
        <p className="mt-1 text-sm text-muted">
          FunKustoms-side controls — the catalog, order status and who can sign in.
        </p>
        <AdminTabs />
      </div>
      {children}
    </div>
  );
}
