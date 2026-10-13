-- ============================================================================
-- Row Level Security
--
-- The rule: a signed-in user can read and create only their own rows, and only while
-- they are an active entry in allowed_users. Everything that legitimately crosses user
-- boundaries — admin views, marking an order paid after signature verification,
-- issuing invoice numbers, recording uploads — runs through the service-role key,
-- which bypasses RLS and is never sent to the browser.
--
-- Note what has NO policy: updates and deletes. Customers cannot mutate an order after
-- placing it, so a tampered client can't move an order to "delivered", mark itself
-- paid, or change a price. Those paths only exist server-side.
-- ============================================================================

-- Is the caller an active allow-listed user?
-- security definer so it can read allowed_users even though that table has RLS of
-- its own; the fixed search_path stops it resolving to a shadowed table.
create or replace function is_portal_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from allowed_users
    where email = (auth.jwt() ->> 'email')
      and active
  );
$$;

create or replace function current_user_email()
returns text
language sql
stable
as $$
  select auth.jwt() ->> 'email';
$$;

alter table allowed_users enable row level security;
alter table products      enable row level security;
alter table orders        enable row level security;
alter table order_items   enable row level security;
alter table order_files   enable row level security;
alter table invoices      enable row level security;

-- ------------------------------------------------------------ allowed_users
-- You may read your own row (the app uses it for your display name); you may not
-- read the rest of the staff list, and you may not write at all.
drop policy if exists "Read own allow-list row" on allowed_users;
create policy "Read own allow-list row"
  on allowed_users for select
  to authenticated
  using (email = current_user_email());

-- ------------------------------------------------------------------ products
drop policy if exists "Portal users read the live catalog" on products;
create policy "Portal users read the live catalog"
  on products for select
  to authenticated
  using (active and is_portal_user());

-- -------------------------------------------------------------------- orders
drop policy if exists "Users see their own orders" on orders;
create policy "Users see their own orders"
  on orders for select
  to authenticated
  using (user_email = current_user_email() and is_portal_user());

drop policy if exists "Users create their own orders" on orders;
create policy "Users create their own orders"
  on orders for insert
  to authenticated
  with check (user_email = current_user_email() and is_portal_user());

-- --------------------------------------------------------------- order_items
drop policy if exists "Users see their own order items" on order_items;
create policy "Users see their own order items"
  on order_items for select
  to authenticated
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.user_email = current_user_email()
    )
    and is_portal_user()
  );

drop policy if exists "Users add items to their own orders" on order_items;
create policy "Users add items to their own orders"
  on order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.user_email = current_user_email()
    )
    and is_portal_user()
  );

-- --------------------------------------------------------------- order_files
-- Read-only for customers. Uploads are recorded server-side after the route handler
-- has verified ownership and re-validated file type and size.
drop policy if exists "Users see artwork on their own orders" on order_files;
create policy "Users see artwork on their own orders"
  on order_files for select
  to authenticated
  using (
    exists (
      select 1
      from order_items i
      join orders o on o.id = i.order_id
      where i.id = order_files.order_item_id
        and o.user_email = current_user_email()
    )
    and is_portal_user()
  );

-- ------------------------------------------------------------------ invoices
drop policy if exists "Users see their own invoices" on invoices;
create policy "Users see their own invoices"
  on invoices for select
  to authenticated
  using (
    exists (
      select 1 from orders o
      where o.id = invoices.order_id
        and o.user_email = current_user_email()
    )
    and is_portal_user()
  );
