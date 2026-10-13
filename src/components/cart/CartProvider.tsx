"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CartLine } from "@/lib/types";

const STORAGE_KEY = "rmjv.cart.v1";

/**
 * The cart lives in localStorage, read through `useSyncExternalStore`.
 *
 * Doing it this way rather than `useState` + an effect avoids a state update during
 * hydration, and gets cross-tab sync for free: the `storage` event fires in other tabs,
 * so two open windows can't disagree about what's in the cart.
 */

const listeners = new Set<() => void>();

// getSnapshot must return a referentially stable value while nothing has changed, or
// React re-renders forever. Cache the parsed array against the raw string it came from.
let cachedRaw: string | null = null;
let cachedLines: CartLine[] = [];

function parse(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l): l is CartLine =>
          typeof l?.productId === "string" && Number.isFinite(l?.quantity) && l.quantity > 0,
      )
      .map((l) => ({
        productId: l.productId,
        quantity: Math.floor(l.quantity),
        notes: typeof l.notes === "string" ? l.notes : "",
      }));
  } catch {
    return [];
  }
}

function getSnapshot(): CartLine[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLines = parse(raw);
  }
  return cachedLines;
}

/** The server has no localStorage, so it always renders an empty cart. */
const EMPTY: CartLine[] = [];
const getServerSnapshot = (): CartLine[] => EMPTY;

const emit = () => listeners.forEach((l) => l());

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === STORAGE_KEY) emit();
}

function write(next: CartLine[]): void {
  cachedRaw = JSON.stringify(next);
  cachedLines = next;
  window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  emit();
}

/** Resolves false on the server and during hydration, true afterwards — no effect needed. */
const subscribeNever = () => () => {};
const alwaysTrue = () => true;
const alwaysFalse = () => false;

type CartApi = {
  lines: CartLine[];
  /** Total pieces across all lines — what the nav badge shows. */
  count: number;
  /** False until the browser has taken over, so the UI can avoid a misleading flash. */
  ready: boolean;
  addLine: (line: CartLine) => void;
  setLine: (productId: string, patch: Partial<Omit<CartLine, "productId">>) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(subscribeNever, alwaysTrue, alwaysFalse);

  const addLine = useCallback((line: CartLine) => {
    const current = getSnapshot();
    const exists = current.some((l) => l.productId === line.productId);
    // Re-adding a product replaces its spec rather than stacking a second row, so
    // "reorder last spec" is idempotent.
    write(exists ? current.map((l) => (l.productId === line.productId ? line : l)) : [...current, line]);
  }, []);

  const setLine = useCallback(
    (productId: string, patch: Partial<Omit<CartLine, "productId">>) => {
      write(getSnapshot().map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
    },
    [],
  );

  const removeLine = useCallback((productId: string) => {
    write(getSnapshot().filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => write([]), []);

  const value = useMemo<CartApi>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      ready,
      addLine,
      setLine,
      removeLine,
      clear,
    }),
    [lines, ready, addLine, setLine, removeLine, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
