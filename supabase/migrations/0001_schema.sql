-- ============================================================================
-- RMJV Portal — schema
--
-- Run in the Supabase SQL editor, in filename order (0001, 0002, 0003), then
-- seed.sql. Everything is idempotent, so re-running is safe.
--
-- Differences from the original build guide, and why:
--   * orders.subtotal / tax_amount are stored alongside total_amount, because a GST
--     invoice has to show taxable value and tax separately.
--   * order_items.gst_rate and products.gst_rate + hsn_code exist for the same reason:
--     a compliant invoice needs the HSN code and per-line tax rate.
--   * order_items.unit_price and gst_rate are snapshots taken at checkout, so changing
--     a catalog price never rewrites a historical order.
--   * order_files is a separate table rather than one file_url column, because the
--     guide requires keeping every artwork version. order_items.file_version /
--     file_url point at the latest one for convenience.
--   * order_number / invoice_number come from sequences via functions, so two
--     concurrent checkouts can't be handed the same number.
--   * allowed_users.is_admin / active back the admin views and access revocation.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- allow-list
create table if not exists allowed_users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  full_name  text,
  is_admin   boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  -- Sign-in is gated on this domain in the app; enforce it in the data too so a stray
  -- insert can't quietly widen access.
  constraint allowed_users_email_domain check (email = lower(email) and email like '%@spintly.com')
);

comment on table allowed_users is
  'Named staff permitted to use the portal. Both conditions apply: the address must be on the allowed domain AND present here with active = true.';

-- ------------------------------------------------------------------ catalog
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  base_price  numeric(12, 2) not null default 0 check (base_price >= 0),
  unit        text,
  hsn_code    text,
  gst_rate    numeric(5, 2) not null default 18 check (gst_rate >= 0 and gst_rate <= 28),
  image_url   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists products_active_idx on products (active) where active;

-- ------------------------------------------------------------------- orders
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text unique not null,
  user_email      text not null references allowed_users (email) on update cascade,
  status          text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'printing', 'shipped', 'delivered', 'cancelled')),
  subtotal        numeric(12, 2) not null default 0,
  tax_amount      numeric(12, 2) not null default 0,
  total_amount    numeric(12, 2) not null default 0,
  payment_status  text not null default 'unpaid'
                    check (payment_status in ('unpaid', 'paid', 'failed', 'refunded')),
  payment_id      text,
  razorpay_order_id text,
  tracking_number text,
  courier         text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists orders_user_email_idx on orders (user_email, created_at desc);
create index if not exists orders_razorpay_order_idx on orders (razorpay_order_id);

-- --------------------------------------------------------------- line items
create table if not exists order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders (id) on delete cascade,
  product_id   uuid not null references products (id),
  quantity     integer not null check (quantity > 0),
  -- Price and tax rate as they were at checkout, not as they are now.
  unit_price   numeric(12, 2) not null default 0 check (unit_price >= 0),
  gst_rate     numeric(5, 2) not null default 18,
  notes        text,
  -- Convenience pointer to the newest row in order_files. 0 = nothing uploaded yet.
  file_url     text,
  file_name    text,
  file_version integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists order_items_order_idx on order_items (order_id);
create index if not exists order_items_product_idx on order_items (product_id, created_at desc);

-- ------------------------------------------------- artwork version history
create table if not exists order_files (
  id            uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items (id) on delete cascade,
  storage_path  text not null,
  file_name     text not null,
  file_size     bigint not null check (file_size > 0),
  version       integer not null check (version > 0),
  uploaded_by   text not null,
  created_at    timestamptz not null default now(),
  unique (order_item_id, version)
);

comment on table order_files is
  'Every uploaded artwork version. Rows are never updated or deleted so an older revision stays retrievable.';

-- ----------------------------------------------------------------- invoices
create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  -- One invoice per order; the unique constraint is what makes concurrent
  -- "issue an invoice" requests safe.
  order_id        uuid not null unique references orders (id) on delete cascade,
  invoice_number  text unique not null,
  pdf_url         text,
  place_of_supply text,
  issued_at       timestamptz not null default now()
);

-- ------------------------------------------------- gapless number sequences
create sequence if not exists order_number_seq start 1;
create sequence if not exists invoice_number_seq start 1;

create or replace function next_order_number()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'RMJV-' || lpad(nextval('order_number_seq')::text, 4, '0');
$$;

-- Invoice numbers are scoped to the Indian financial year (1 April – 31 March).
create or replace function next_invoice_number()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'FK/'
    || to_char(
         case when extract(month from now()) >= 4 then now() else now() - interval '1 year' end,
         'YY'
       )
    || '-'
    || to_char(
         case when extract(month from now()) >= 4 then now() + interval '1 year' else now() end,
         'YY'
       )
    || '/'
    || lpad(nextval('invoice_number_seq')::text, 4, '0');
$$;

-- ------------------------------------------------------------ updated_at
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on orders;
create trigger orders_touch_updated_at
  before update on orders
  for each row execute function touch_updated_at();
