"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cx } from "./ui";
import { useCart } from "./cart/CartProvider";

type Props = {
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  demoMode: boolean;
  signOut: () => Promise<void>;
};

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/products", label: "Catalog" },
  { href: "/orders", label: "Orders" },
];

export function AppNav({ email, fullName, isAdmin, signOut }: Props) {
  const pathname = usePathname();
  const { count, ready } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const navLinks = isAdmin
    ? [...LINKS, { href: "/invoices", label: "Invoices" }, { href: "/admin", label: "Admin" }]
    : LINKS;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/spintly-logo.png" alt="Spintly" className="h-7 w-auto" />
          <span className="hidden text-sm sm:inline">Order Portal</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Main">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cx(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive(l.href)
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">

          <Link
            href="/cart"
            className={cx(
              "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              isActive("/cart")
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            Cart
            {ready && count > 0 ? (
              <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold text-on-accent nums">
                {count}
              </span>
            ) : null}
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink"
            >
              <span className="sr-only">Account menu for {email}</span>
              {(fullName ?? email).slice(0, 1).toUpperCase()}
            </button>

            {menuOpen ? (
              <>
                {/* Click-away layer so the menu closes on any outside click. */}
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-card border border-line bg-surface shadow-lg"
                >
                  <div className="border-b border-line px-3 py-2.5">
                    <p className="truncate text-sm font-medium text-ink">{fullName ?? email}</p>
                    <p className="truncate text-xs text-muted">{email}</p>
                  </div>
                  <nav className="p-1 md:hidden" aria-label="Main (compact)">
                    {navLinks.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-md px-2.5 py-1.5 text-sm text-body hover:bg-surface-2"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </nav>
                  <form action={signOut} className="border-t border-line p-1">
                    <button
                      type="submit"
                      role="menuitem"
                      className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-body hover:bg-surface-2"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
