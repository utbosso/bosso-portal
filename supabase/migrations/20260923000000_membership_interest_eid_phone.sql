-- Phone is now required on the join form, and UT EID is a new optional
-- field. Backfill the one existing test row before enforcing NOT NULL.
update public.membership_interest_submissions
set phone = 'Not provided'
where phone is null;

alter table public.membership_interest_submissions
  alter column phone set not null;

alter table public.membership_interest_submissions
  add column if not exists eid text;
