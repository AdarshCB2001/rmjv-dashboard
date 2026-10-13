# RMJV Portal — `rmjv.funkustoms.com`

Customer portal for FunKustoms' client RMJV. RMJV staff sign in with their `@spintly.com`
address, reorder from a fixed catalog in one click, upload artwork, pay online, track the
job, and download GST invoices. FunKustoms gets an admin side for the catalog, order
status and access control.

Built per `../rmjv-dashboard-build-guide.md`. Next.js 16 (App Router) · Supabase ·
Razorpay · Crisp/Tawk.to · `@react-pdf/renderer`.

---

## Run it right now

```bash
npm install
npm run dev
```

Open http://localhost:3000. **With no `.env.local` at all it runs in demo mode**: seeded
sample data in memory, an account-picker instead of magic links, and simulated payments.
Everything is walkable — catalog, reorder, cart, checkout, artwork versions, invoice PDF,
order tracking, admin. Sign in as `demo@spintly.com` (customer) or `admin@spintly.com`
(FunKustoms admin).

Demo data lives in one process and resets when the dev server restarts. It is a
development aid, not a deployment mode.

## Going live

Copy `.env.example` to `.env.local` and fill in whichever blocks you have. Each
integration switches on independently, and `/admin` shows you which are live:

| Missing | Behaviour |
|---|---|
| Supabase keys | Demo mode: in-memory data, account-picker sign-in |
| Razorpay keys | Payments simulated (`/api/payments/simulate` refuses to run once keys are set) |
| GST details | Invoices render stamped **DRAFT — NOT A VALID TAX INVOICE** |
| Crisp/Tawk ID | Chat widget hidden |

### 1. Supabase

Create a project, then run these in the SQL editor in order:

```
supabase/migrations/0001_schema.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_storage.sql
supabase/seed.sql
```

All four are idempotent. **Edit the emails in `seed.sql` first** — nobody can sign in
until they have an `allowed_users` row, including you.

Then set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. In Supabase Auth settings, add `{SITE_URL}/auth/callback`
as a redirect URL.

If you'd rather not hand-edit `seed.sql`, set `ADMIN_EMAILS=you@spintly.com` to bootstrap
admin access, add staff through `/admin/staff`, then clear the variable.

### 2. Razorpay

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Then **add the webhook** — not optional
in practice: `POST {SITE_URL}/api/razorpay-webhook` for the `payment.captured` event, with
the secret in `RAZORPAY_WEBHOOK_SECRET`. Without it, a UPI payment confirmed after the
customer closes the tab leaves a paid order showing as unpaid.

### 3. GST invoice details

Fill the `SELLER_*` and `BUYER_*` block. These are env-driven with placeholders rather
than hardcoded because a tax invoice carrying an invented GSTIN is a statutory problem —
until they're set, every PDF is watermarked as a draft. Confirm the HSN codes and GST
rates in `seed.sql` with your accountant; the ones there are category guesses.

CGST+SGST vs IGST is chosen by comparing `SELLER_STATE_CODE` to `BUYER_STATE_CODE`.

### 4. Chat

Set `NEXT_PUBLIC_CRISP_WEBSITE_ID` **or** `NEXT_PUBLIC_TAWK_PROPERTY_ID` +
`NEXT_PUBLIC_TAWK_WIDGET_ID`. The signed-in user's email and name are pushed to the
widget, which is what makes conversation history stick to a person across sessions.

### 5. Deploy

Vercel project → import repo → add the env vars → add `rmjv.funkustoms.com` as a custom
domain → in DNS, `CNAME rmjv` → the target Vercel gives you. Set
`NEXT_PUBLIC_SITE_URL=https://rmjv.funkustoms.com` so magic links point at the right
origin.

---

## How it's put together

```
src/
  proxy.ts                  Session refresh + redirect anonymous traffic (Next 16 renamed
                            middleware -> proxy; runs on node, not edge)
  lib/
    config.ts               Which integrations are configured; single source of truth
    auth.ts                 gateEmail() — the one definition of "may this person in"
    money.ts                Rupee/paise arithmetic, per-slab GST grouping
    billing.ts              Invoice parties, intra- vs inter-state
    invoice-pdf.tsx         GST invoice, incl. amount-in-words (Indian numbering)
    data/                   THE data facade — Supabase or demo store; nothing else knows
    demo/                   Seeded in-memory store + signed demo session cookie
    supabase/               Browser / request-scoped / service-role clients
  app/
    login/                  Magic link (real) or account picker (demo)
    auth/callback/          Code exchange, then re-checks the allow-list
    (portal)/               Everything behind requireSession()
      dashboard products cart orders orders/[id]
      admin/                Behind requireAdmin(): orders, catalog, staff access
    api/
      payments/create|verify|simulate    razorpay-webhook
      uploads/sign|commit               files/download    invoices/[orderId]
supabase/migrations, supabase/seed.sql
```

**Every page and route goes through `lib/data/*`.** That's what lets demo mode exist
without a parallel implementation of the app.

---

## Decisions worth knowing

**Sign-in requires two things** (guide §16 left this open): an `@spintly.com` address
*and* an active `allowed_users` row. Checked in the login action, in the auth callback,
and on every session read — so revoking access in `/admin/staff` takes effect on that
person's next request rather than whenever their token happens to expire.

**Customers can't mutate orders.** RLS grants `select` and `insert` only; there is no
`update` or `delete` policy on any table. Marking paid, changing status, and recording
uploads all happen server-side through the service-role key after an explicit check. A
tampered client cannot move an order to "delivered" or mark itself paid.

**Prices are never sent by the client.** Checkout posts product ids, quantities and notes;
the server reads the price from the catalog and snapshots it onto the line item. So a later
catalog price change doesn't rewrite history, and a forged payload can't discount anything.
`/api/payments/create` likewise recomputes the amount from stored line items.

**Artwork is versioned, never overwritten.** `order_files` keeps every upload;
`order_items.file_version` just points at the newest. Bytes go browser → Supabase Storage
via a short-lived signed URL (so a 50MB `.ai` never passes through a route handler), with
the path chosen server-side and confined to `{orderId}/{itemId}/`.

**Order and invoice numbers come from Postgres sequences** via `next_order_number()` /
`next_invoice_number()`, so two concurrent checkouts can't collide. Invoice numbers are
scoped to the Indian financial year.

**Invoices render on demand** rather than being stored, so they can't go stale against the
order. The number is allocated once and reused.

**Tracking is manual for v1** (guide §10). `updateOrderAdmin` is the only writer, so a
Shiprocket/Delhivery poller can later write the same fields, with the admin form as
override.

### Where this extends the guide's schema

The guide's tables didn't quite cover a compliant GST invoice or versioned artwork, so:

- `orders.subtotal` / `tax_amount` alongside `total_amount` — an invoice must show taxable
  value and tax separately
- `products.hsn_code`, `products.gst_rate`, `order_items.gst_rate` — required per line
- `order_items.unit_price` is a snapshot, not a live lookup
- `order_files` as its own table — the guide requires keeping every version, which one
  `file_url` column can't do
- `allowed_users.is_admin` / `active` — admin views and revocation
- `orders.order_number` + sequences — human-readable, collision-free references

Each is commented in `0001_schema.sql`.

---

## Security checklist (guide §15)

- [x] RLS enabled on all six tables; select/insert only, scoped to the caller's email
- [x] Domain + allow-list enforced server-side (login action, auth callback, every session read)
- [x] Service role key server-only — never `NEXT_PUBLIC_`, never sent to the browser
- [x] Razorpay signature verified server-side (HMAC, constant-time) before marking paid;
      webhook signature verified over the raw body
- [x] Uploads re-validated server-side for type, size, ownership and path prefix
- [x] Signed URLs only — both buckets private, with no `authenticated` storage policies at all
- [x] HTTPS enforced by Vercel on the custom domain
- [x] Portal excluded from search indexing (`robots: noindex`)

Server actions call `requireSession()`/`requireAdmin()` themselves rather than trusting the
proxy, because server functions are POSTs to the calling route and a matcher change can
silently drop proxy coverage.

### Verified against a running server

Anonymous → redirected to `/login`. Tampered cookie signature → rejected. A correctly
signed cookie *claiming* `isAdmin: true` for a non-admin → still refused, because the
session re-reads the allow-list instead of trusting the cookie. Customer reading another
customer's order, invoice, or upload target → 404. `.exe` upload → rejected. 60MB upload →
rejected. Commit outside the order's own prefix, or containing `../` → rejected. Webhook
without a signature → refused. Admin revoking their own access → refused.

---

## Checks

```bash
npx tsc --noEmit     # clean
npx eslint .         # clean
npm run build        # clean
```

No automated tests yet — the flows above were verified by hand against a running server.
Worth adding before this grows: unit tests on `lib/money.ts` (GST rounding and slab
grouping) and route-handler tests on the payment and upload authorisation paths.

`npm audit` reports advisories in dev-only transitive dependencies (ESLint's `minimatch`
chain, and `postcss`/`sharp` under `next`). Nothing from those ships to the browser;
re-check after the next `next` release rather than force-upgrading.

## Still to do before RMJV UAT

- Real values in the `SELLER_*` / `BUYER_*` block, HSN/GST rates confirmed by an accountant
- Razorpay live-mode keys + webhook registered
- Trial Crisp vs Tawk.to and pick one (guide §16)
- Replace the seeded catalog copy and prices with the real ones
- Product images, if you want them instead of the generated tiles
