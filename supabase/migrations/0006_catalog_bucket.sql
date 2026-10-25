-- Private bucket for the storefront catalog (layout PDFs + preview PNGs). Filled by
-- `npm run catalog:push`; read only through /api/catalog/file with the service role,
-- so like the other buckets it deliberately has no storage policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', false, 20971520, array['application/pdf', 'image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
