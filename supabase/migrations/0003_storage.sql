-- ============================================================================
-- Storage buckets
--
-- Both buckets are private and deliberately have NO storage policies for the
-- `authenticated` role. That is not an omission: the browser never talks to storage
-- with its own credentials. Uploads go through a signed upload URL minted server-side
-- after ownership is verified, and downloads go through a short-lived signed URL from
-- /api/files/download. With no policy, a leaked object path is useless on its own.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-files',
  'order-files',
  false,
  52428800, -- 50MB, matching MAX_FILE_BYTES in the app
  array[
    'application/pdf',
    'image/png',
    'application/postscript',            -- .ai and .eps
    'application/illustrator',
    'application/octet-stream'           -- some browsers send this for .ai/.eps
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only used if you later choose to archive rendered invoice PDFs. The app streams
-- invoices on demand instead, so this can stay empty.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public          = excluded.public,
      file_size_limit = excluded.file_size_limit;
