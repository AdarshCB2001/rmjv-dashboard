-- Our own copy of the RMJV customer's SWIPE invoices. SWIPE's API is capped (100 calls a
-- month), so the portal reads this table and the `invoices` bucket instead of calling SWIPE
-- on every page view. Written by the app with the service role only: RLS is on, no policies.
create table if not exists swipe_docs (
  hash_id   text primary key,
  number    text not null,
  doc_date  date not null,
  reference text,
  total     numeric(12, 2) not null default 0,
  pending   numeric(12, 2) not null default 0,
  synced_at timestamptz not null default now()
);

alter table swipe_docs enable row level security;
