import type { Metadata } from "next";
import { ALLOWED_EMAIL_DOMAIN, BOOTSTRAP_ADMIN_EMAILS } from "@/lib/config";
import { requireAdmin } from "@/lib/auth";
import { listAllowedUsers } from "@/lib/data/users";
import { Card, Notice } from "@/components/ui";
import { AddStaffCard, StaffRow } from "./StaffForms";

export const metadata: Metadata = { title: "Admin · Staff access" };

export default async function AdminStaffPage() {
  const session = await requireAdmin();
  const users = await listAllowedUsers();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">
          Allow-list <span className="text-sm font-normal text-muted">({users.length})</span>
        </h2>

        <Card className="px-5 py-1">
          <ul className="divide-y divide-line">
            {users.map((user) => (
              <StaffRow key={user.id} user={user} isSelf={user.email === session.email} />
            ))}
          </ul>
        </Card>

        <Notice tone="info">
          Revoking access takes effect on that person&apos;s next request — the allow-list is
          re-checked on every page load, not just at sign-in.
        </Notice>

        {BOOTSTRAP_ADMIN_EMAILS.length > 0 ? (
          <Notice tone="warning" title="Bootstrap admins are set">
            <code className="font-mono text-xs">ADMIN_EMAILS</code> grants admin to{" "}
            {BOOTSTRAP_ADMIN_EMAILS.join(", ")} regardless of the table. It exists so you can
            reach this screen on a fresh database — clear it once a real admin row exists.
          </Notice>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-20">
        <AddStaffCard domain={ALLOWED_EMAIL_DOMAIN} />
      </div>
    </div>
  );
}
