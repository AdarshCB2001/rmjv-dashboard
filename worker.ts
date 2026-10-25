// Wraps the OpenNext worker to add a Cron Trigger: every 5 minutes it calls our own
// /api/cron/sync (stage pull from the PM app + SWIPE invoices). It also keeps the free
// Supabase project from pausing for inactivity.
import next from "./.open-next/worker.js";

type Env = { CRON_SECRET?: string };

export default {
  fetch: next.fetch,
  scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const req = new Request("https://rmjv.funkustoms.com/api/cron/sync", {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(next.fetch(req, env, ctx));
  },
};
