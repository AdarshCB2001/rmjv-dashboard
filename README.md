# Spintly Order Portal

Customer portal for FunKustoms' client Spintly / RMJV. Staff sign in with their `@spintly.com`
address, order from the product folders (drill templates, one-page manuals, UV stickers) or
send a custom order with their own artwork, and track each job through to delivery. FunKustoms
gets an admin side for orders, products and access.

Next.js 16 (App Router) · Supabase (auth, database, file storage) · Firebase Admin (link to the
internal project management app) · `@react-pdf/renderer` (GST invoices).

## How it works

- **Catalog** is the `Products/<Category>/<Product>/` folder tree (PDF + PNG only; CorelDRAW sources
  stay out of it), mirrored in the private `catalog` Supabase bucket and described by
  `src/lib/catalog-manifest.json`. After adding or changing files run `npm run thumbs && npm run
  catalog:push`, then redeploy. A layout PDF named `... - 10ps.pdf` sets pieces per 12×18" sheet
  (₹60/sheet ÷ pieces), a PNG named `... - 2.6 by 5.7 inches.png` is the preview. One Page
  Manuals sell 16 per sheet; UV stickers are sold by A4/A3 sheet (`src/lib/catalog.ts`).
- **Orders** start Pending. The customer confirms (no upfront payment). Confirming creates a task
  under **Spintly Orders** in the project management app; moving the task's stage there updates the
  order here (`src/lib/pm-sync.ts`).
- **Payment** is after delivery: the order page shows the UPI QR and bank details
  (`src/lib/payment.ts`). Admin (or the `payment` stage in the PM app) marks it paid.
- **GST invoices** are created on **SWIPE** (`src/lib/swipe.ts`) when the order reaches Completed in
  the PM app; the portal's download streams SWIPE's PDF. Stage changes are pulled whenever the portal
  is opened, and by a scheduler hitting `GET /api/cron/sync` with `Authorization: Bearer $CRON_SECRET`
  (every ~5 minutes) so invoices don't wait for a page view. Without a SWIPE key the old built-in
  draft PDF (`SELLER_*` / `BUYER_*`) is used.
- **Invoices tab** (admin) lists every invoice and estimate on SWIPE for the RMJV customer, with PDF preview.

## Run locally

```bash
npm install
npm run dev
```

With no Supabase keys it runs in **demo mode** (in-memory data, account picker as
`admin@spintly.com`) — for development only. A production build without Supabase refuses to
sign anyone in.

## Going live

1. **Supabase** — create a project, run `supabase/migrations/*.sql` in order, then edit and run
   `supabase/seed.sql` (put a real admin email in it). Set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`
   (the deployed origin) and `ADMIN_EMAILS`. Add the site URL to Supabase Auth → URL configuration.
2. **Catalog** — run migration `0006_catalog_bucket.sql`, then `npm run catalog:push` to upload
   `Products/` to the `catalog` bucket. Then, as admin, open Admin → Products → **Sync products**.
3. **SWIPE + scheduler** — set `SWIPE_API_KEY` and `CRON_SECRET`, run
   `supabase/migrations/0005_swipe_invoice.sql`, and schedule the `/api/cron/sync` call.
4. **Project management link** — set `FIREBASE_SERVICE_ACCOUNT_PATH` (key file kept outside the
   repo) or `FIREBASE_SERVICE_ACCOUNT`.
5. After changing PDFs run `npm run thumbs` (card pictures in `public/thumbs/`), then `npm run catalog:push`.
6. `npm run build && npm start`.

See `.env.example` for every variable. Never commit `.env*` or the Firebase key.
