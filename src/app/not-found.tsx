import Link from "next/link";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20 text-center">
      <div>
        <p className="text-sm font-medium text-accent">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          We couldn&apos;t find that
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          The page may have moved, or the order belongs to a different account.
        </p>
        <Link href="/dashboard" className={btn("primary", "mt-6")}>
          Back to the portal
        </Link>
      </div>
    </main>
  );
}
