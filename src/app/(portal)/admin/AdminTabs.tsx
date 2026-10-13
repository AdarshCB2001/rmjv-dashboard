"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Catalog" },
  { href: "/admin/staff", label: "Staff access" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-line" aria-label="Admin sections">
      {TABS.map((tab) => {
        // Exact match for the overview tab, prefix match for the rest.
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
