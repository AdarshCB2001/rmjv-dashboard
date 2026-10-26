-- Estimates sit beside invoices, and imported PDFs record who they were billed to.
alter table swipe_docs add column if not exists kind text not null default 'invoice' check (kind in ('invoice', 'estimate'));
alter table swipe_docs add column if not exists customer text;
