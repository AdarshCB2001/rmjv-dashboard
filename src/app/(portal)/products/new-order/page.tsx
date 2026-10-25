import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { NewOrderForm } from "@/components/NewOrderForm";

export const metadata: Metadata = { title: "Add new order" };

export default async function NewOrderPage() {
  await requireSession();
  return (
    <>
      <PageHeader
        title="Add new order"
        description="Upload your file and tell us what you need — for anything not in the catalog."
        actions={
          <Link href="/products" className="text-sm font-medium text-accent hover:underline">
            ← Back to catalog
          </Link>
        }
      />
      <Card className="max-w-2xl p-5">
        <NewOrderForm />
      </Card>
    </>
  );
}
