import { DEMO_MODE } from "@/lib/config";
import { requireSession } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { MadeBy } from "@/components/MadeBy";
import { CartProvider } from "@/components/cart/CartProvider";
import { signOut } from "../login/actions";

/**
 * Every route inside this group is behind `requireSession()`. The proxy already
 * redirects anonymous requests, but this is the check that actually matters — it also
 * re-validates the allow-list, so revoked access takes effect on the next page load.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <CartProvider>
      <AppNav
        email={session.email}
        fullName={session.fullName}
        isAdmin={session.isAdmin}
        demoMode={DEMO_MODE}
        signOut={signOut}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-line py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <MadeBy />
        </div>
      </footer>
    </CartProvider>
  );
}
