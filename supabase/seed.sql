-- ============================================================================
-- Seed data — catalog + the first admin.
--
-- Run after the migrations. Safe to re-run: products are matched on name and staff on
-- email, so nothing is duplicated.
--
-- The admin row below is main.funkustoms@gmail.com; sign-in for it works because the same
-- address is in ADMIN_EMAILS (see isAllowedEmail).
-- ============================================================================

-- The first admin. Without a row here you cannot reach /admin to add anyone else —
-- alternatively set ADMIN_EMAILS in the environment to bootstrap.
insert into allowed_users (email, full_name, is_admin)
values ('main.funkustoms@gmail.com', 'FunKustoms Admin', true)
on conflict (email) do update
  set is_admin = true,
      active   = true;

-- Catalog products come from the Products/ folders: Admin → Catalog → "Sync products".
