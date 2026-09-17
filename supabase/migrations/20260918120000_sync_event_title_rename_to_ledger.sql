-- sync_attendance_to_point_ledger (20260916120000_point_ledger_event_title_note.sql)
-- snapshots the event's title into point_ledger.note at check-in time, but
-- nothing cascaded when the event was renamed afterward (e.g. the Workshop
-- #1..#12 renumbering) - "View Details" on the admin Points dashboard kept
-- showing the old title forever for anyone who'd already checked in.
create or replace function private.sync_event_title_to_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.title is distinct from old.title then
    update public.point_ledger pl
       set note = new.title
      from public.attendance_records ar
     where pl.source_type = 'attendance'
       and pl.source_id = ar.id::text
       and ar.event_id = new.id
       and pl.note = old.title;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_event_title_to_ledger on public.events;
create trigger sync_event_title_to_ledger
  after update of title on public.events
  for each row execute function private.sync_event_title_to_ledger();

-- One-time backfill for events already renamed before this trigger existed.
update public.point_ledger pl
   set note = e.title
  from public.attendance_records ar
  join public.events e on e.id = ar.event_id
 where pl.source_type = 'attendance'
   and pl.source_id = ar.id::text
   and pl.note is distinct from e.title;
