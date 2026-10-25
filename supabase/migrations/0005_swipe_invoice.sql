-- The GST invoice issued on SWIPE when the order reaches Completed.
alter table orders add column if not exists swipe_hash_id text;
alter table orders add column if not exists swipe_invoice_number text;
