-- Labeled links that are displayed separately from announcement message copy.

alter table public.announcements
  add column if not exists reference_links jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcements_reference_links_is_array'
      and conrelid = 'public.announcements'::regclass
  ) then
    alter table public.announcements
      add constraint announcements_reference_links_is_array
      check (jsonb_typeof(reference_links) = 'array') not valid;
  end if;
end
$$;

alter table public.announcements validate constraint announcements_reference_links_is_array;
