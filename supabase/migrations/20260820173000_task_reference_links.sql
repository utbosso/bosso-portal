-- Structured links attached to team action items at assignment time.
-- JSON keeps each task self-contained while allowing more than one labeled link.

alter table public.tasks
  add column if not exists reference_links jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_reference_links_is_array'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_reference_links_is_array
      check (jsonb_typeof(reference_links) = 'array') not valid;
  end if;
end
$$;

alter table public.tasks validate constraint tasks_reference_links_is_array;
