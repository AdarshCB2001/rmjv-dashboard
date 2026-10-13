import { buildSeed, type DemoDb } from "./seed";

/**
 * In-memory stand-in for Postgres, used when Supabase is not configured.
 *
 * Held on globalThis so it survives Next's dev-server module reloads — otherwise
 * every hot reload would wipe the order you just placed. It is per-process and not
 * shared between serverless instances, which is exactly why this is a demo aid and
 * not a production path.
 */

const KEY = Symbol.for("rmjv.demo.db");

type Global = typeof globalThis & { [KEY]?: DemoDb };

export function db(): DemoDb {
  const g = globalThis as Global;
  if (!g[KEY]) g[KEY] = buildSeed();
  return g[KEY];
}

export function resetDb(): void {
  (globalThis as Global)[KEY] = buildSeed();
}

let counter = 0;
/** Ids only need to be unique within the process. */
export const demoId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Deep-copies rows on the way out so callers can't mutate the store by accident. */
export const clone = <T>(v: T): T => structuredClone(v);
