-- Point history showed every event attendance row labeled literally "Event
-- attendance" (src/app/points/page.tsx renders point_ledger.note as the
-- entry's title) because private.sync_attendance_to_point_ledger() hardcoded
-- that exact string rather than looking up the event's actual title. Members
-- couldn't tell which event a point entry came from when they had more than
-- one on the same day.
create or replace function private.sync_attendance_to_point_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  selected_term_id uuid;
  selected_user_id uuid;
  selected_category text;
  selected_event_title text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  selected_term_id := nullif(row_data ->> 'term_id', '')::uuid;
  if selected_term_id is null then
    select id into selected_term_id from public.academic_terms where status = 'current' limit 1;
  end if;
  selected_user_id := (row_data ->> 'user_id')::uuid;

  if tg_op = 'DELETE' then
    update public.point_ledger
       set voided_at = now(), voided_by = auth.uid()
     where term_id = selected_term_id
       and user_id = selected_user_id
       and source_type = 'attendance'
       and source_id = row_data ->> 'id';
    return old;
  end if;

  selected_category := coalesce(nullif(row_data ->> 'event_category', ''), 'membership');
  if selected_category not in ('membership', 'professional_education', 'social', 'philanthropy') then
    selected_category := 'membership';
  end if;

  select title into selected_event_title
    from public.events
   where id = nullif(row_data ->> 'event_id', '')::uuid;

  insert into public.point_ledger
    (term_id, user_id, category, points, source_type, source_id, note, awarded_by, occurred_at, voided_at)
  values
    (selected_term_id, selected_user_id, selected_category, coalesce((row_data ->> 'points_earned')::numeric, 0),
     'attendance', row_data ->> 'id', coalesce(selected_event_title, 'Event attendance'), auth.uid(),
     coalesce((row_data ->> 'checked_in_at')::timestamptz, now()), null)
  on conflict (term_id, user_id, source_type, source_id)
  do update set
    category = excluded.category,
    points = excluded.points,
    note = excluded.note,
    occurred_at = excluded.occurred_at,
    voided_at = null,
    voided_by = null;

  return new;
end;
$$;

-- Backfill point_ledger rows that already exist from before this fix.
update public.point_ledger pl
   set note = e.title
  from public.attendance_records ar
  join public.events e on e.id = ar.event_id
 where pl.source_type = 'attendance'
   and pl.source_id = ar.id::text
   and pl.note = 'Event attendance';
