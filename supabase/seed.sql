-- ============================================================================
-- Seed data — catalog + the first admin.
--
-- Run after the migrations. Safe to re-run: products are matched on name and staff on
-- email, so nothing is duplicated.
--
-- BEFORE RUNNING: change the two email addresses below to real @spintly.com addresses
-- (and your own for the admin row). Nobody can sign in until they exist here.
-- ============================================================================

-- The first admin. Without a row here you cannot reach /admin to add anyone else —
-- alternatively set ADMIN_EMAILS in the environment to bootstrap.
insert into allowed_users (email, full_name, is_admin)
values ('admin@spintly.com', 'FunKustoms Admin', true)
on conflict (email) do update
  set is_admin = true,
      active   = true;

-- An RMJV staff member.
insert into allowed_users (email, full_name, is_admin)
values ('procurement@spintly.com', 'RMJV Procurement', false)
on conflict (email) do nothing;

-- ------------------------------------------------------------------- catalog
-- GST rates and HSN codes here are placeholders based on the product category —
-- confirm them with your CA before invoicing against them.
insert into products (name, description, base_price, unit, hsn_code, gst_rate)
select *
from (
  values
    (
      'Paper Template Cutouts',
      'Die-cut paper templates for access-reader installation. Printed on 250gsm board, cut to your drilling template.',
      850.00, 'per 100 pcs', '4911', 18.00
    ),
    (
      'Paper Stickers',
      'Matte-laminated paper stickers, kiss-cut on sheets. Indoor use.',
      420.00, 'per 100 pcs', '4821', 18.00
    ),
    (
      'UV Stickers',
      'UV-printed vinyl stickers with outdoor-grade adhesive. Weather and scratch resistant, 3-year rating.',
      1250.00, 'per 100 pcs', '3919', 18.00
    ),
    (
      'T-Shirts (Round Neck)',
      '180gsm combed cotton, screen-printed front and back. Sizes S-XXL, mixed.',
      380.00, 'per piece', '6109', 5.00
    ),
    (
      'Acrylic Signage Plates',
      '3mm cast acrylic with UV print and 3M tape backing. Custom sizes.',
      2100.00, 'per 10 pcs', '3926', 18.00
    ),
    (
      'Visitor Badge Cards',
      'PVC cards, full-colour both sides, punched for lanyard.',
      990.00, 'per 100 pcs', '3921', 18.00
    )
) as v (name, description, base_price, unit, hsn_code, gst_rate)
where not exists (select 1 from products p where p.name = v.name);
