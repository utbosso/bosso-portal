-- Lets a "document"/"resource" row point at an uploaded file (in the
-- already-existing documents/resources storage buckets) instead of only an
-- external link. file_url stays for the link case; a row is exactly one of
-- "has file_url", "has storage_path", or neither (a folder).
alter table public.documents
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists file_size_bytes bigint,
  add column if not exists mime_type text;

alter table public.learning_resources
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists file_size_bytes bigint,
  add column if not exists mime_type text;
