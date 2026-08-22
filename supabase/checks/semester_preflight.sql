-- BOSSO semester migration preflight (read-only)
-- Run this against a backup/preview database first, then production immediately
-- before applying the semester migrations. Stop if any expected table is missing,
-- the administrator count is not exactly one, or orphaned profiles are reported.

with expected_tables(table_name) as (
  values
    ('profiles'),
    ('announcements'),
    ('events'),
    ('documents'),
    ('feedback_submissions'),
    ('tasks'),
    ('attendance_records'),
    ('points_adjustments')
)
select
  table_name,
  to_regclass('public.' || table_name) is not null as present
from expected_tables
order by table_name;

select
  count(*) filter (where lower(email) = 'internal@txbosso.com') as admin_accounts,
  count(*) filter (
    where lower(email) = 'internal@txbosso.com'
      and email_confirmed_at is not null
  ) as confirmed_admin_accounts
from auth.users;

select
  count(*) as profile_count,
  count(*) filter (where auth_user.id is null) as orphaned_profiles
from public.profiles profile
left join auth.users auth_user on auth_user.id = profile.id;

select
  lower(email) as normalized_email,
  count(*) as duplicate_count
from public.profiles
where email is not null
group by lower(email)
having count(*) > 1
order by duplicate_count desc, normalized_email;

select 'profiles' as record_type, count(*) as record_count from public.profiles
union all select 'announcements', count(*) from public.announcements
union all select 'events', count(*) from public.events
union all select 'documents', count(*) from public.documents
union all select 'feedback_submissions', count(*) from public.feedback_submissions
union all select 'tasks', count(*) from public.tasks
union all select 'attendance_records', count(*) from public.attendance_records
union all select 'points_adjustments', count(*) from public.points_adjustments
order by record_type;

select
  role::text as role,
  account_status::text as account_status,
  count(*) as member_count
from public.profiles
group by role::text, account_status::text
order by role, account_status;

