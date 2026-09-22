-- UT EID is now required on the join form. Backfill the one existing
-- test row before enforcing NOT NULL.
update public.membership_interest_submissions
set eid = 'Not provided'
where eid is null;

alter table public.membership_interest_submissions
  alter column eid set not null;
