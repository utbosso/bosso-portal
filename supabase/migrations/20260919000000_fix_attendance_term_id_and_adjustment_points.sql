-- points_adjustments.points was missed when events.point_value,
-- tasks.point_value, and attendance_records.points_earned were widened to
-- numeric earlier this term (20260916000000_workshop_deliverable_tasks.sql) -
-- it's still integer, so entering 2.5 points anywhere that writes to this
-- table throws "invalid input syntax for type integer: 2.5" ("Failed to
-- adjust points").
alter table public.points_adjustments alter column points type numeric(6,2) using points::numeric;

-- Every current-term attendance_records row has term_id = NULL - the
-- check-in route (/api/attendance/check-in) never set it, so all 79 current
-- rows (Workshop #1, GM #1, ...) are untagged. point_ledger totals still
-- came out correct because the sync trigger separately falls back to
-- whatever the current term is when a row's own term_id is null - but any
-- query that filters attendance_records by its own term_id directly (the
-- Attendance Management admin tab: events attended, attendance rate, View
-- Details) matched nothing at all. Backfill from the event's own term_id,
-- which - unlike attendance_records - is reliably set at creation.
update public.attendance_records ar
   set term_id = e.term_id
  from public.events e
 where ar.event_id = e.id
   and ar.term_id is null
   and e.term_id is not null;

-- points_adjustments has no event to backfill term_id from (they're manual,
-- not tied to an event) - best effort: assign the current term, since
-- practically all existing rows are recent and there is no better signal.
update public.points_adjustments pa
   set term_id = t.id
  from public.academic_terms t
 where pa.term_id is null
   and t.status = 'current';
