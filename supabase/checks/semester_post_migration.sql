-- BOSSO post-migration verification (read-only)
-- Expected before activation: Spring 2026 is current, Fall 2026 is upcoming,
-- all listed tables have RLS, and authenticated cannot execute activation.

select
  slug,
  status,
  points_rules_status,
  starts_on,
  ends_on
from public.academic_terms
order by starts_on;

select
  count(*) filter (where status = 'current') as current_term_count,
  count(*) filter (where slug = 'spring-2026' and status = 'current') as spring_current,
  count(*) filter (where slug = 'fall-2026' and status = 'upcoming') as fall_upcoming
from public.academic_terms;

with expected_tables(table_name) as (
  values
    ('academic_terms'),
    ('member_term_memberships'),
    ('dues_payments'),
    ('dues_payment_terms'),
    ('position_codes'),
    ('position_code_claims'),
    ('term_point_rules'),
    ('point_ledger'),
    ('point_requests'),
    ('point_request_attachments'),
    ('task_status_history'),
    ('semester_rollovers'),
    ('term_member_groups'),
    ('term_member_group_members'),
    ('dues_prices'),
    ('dues_checkout_settings')
)
select
  expected.table_name,
  coalesce(table_definition.relrowsecurity, false) as rls_enabled
from expected_tables expected
left join pg_class table_definition
  on table_definition.relname = expected.table_name
 and table_definition.relnamespace = 'public'::regnamespace
order by expected.table_name;

select
  has_function_privilege('anon', 'public.activate_academic_term(uuid,uuid)', 'execute') as anon_can_activate,
  has_function_privilege('authenticated', 'public.activate_academic_term(uuid,uuid)', 'execute') as member_can_activate,
  has_function_privilege('service_role', 'public.activate_academic_term(uuid,uuid)', 'execute') as service_can_activate;

select
  view_definition.relname as view_name,
  view_definition.reloptions
from pg_class view_definition
where view_definition.oid = 'public.member_term_point_summary'::regclass;

select
  grantee,
  table_name,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'academic_terms',
    'member_term_memberships',
    'dues_payments',
    'dues_payment_terms',
    'position_codes',
    'position_code_claims',
    'term_point_rules',
    'point_ledger',
    'point_requests',
    'point_request_attachments',
    'task_status_history',
    'semester_rollovers',
    'term_member_groups',
    'term_member_group_members',
    'dues_prices',
    'dues_checkout_settings'
  )
group by grantee, table_name
order by table_name, grantee;

select
  bucket.id,
  bucket.public,
  bucket.file_size_limit,
  bucket.allowed_mime_types
from storage.buckets bucket
where bucket.id = 'point-request-proof';

select 'announcements' as content_type, count(*) filter (where term_id is null) as missing_term
from public.announcements
union all
select 'events', count(*) filter (where term_id is null) from public.events
union all
select 'documents', count(*) filter (where term_id is null) from public.documents
union all
select 'feedback_submissions', count(*) filter (where term_id is null) from public.feedback_submissions
union all
select 'tasks', count(*) filter (where term_id is null) from public.tasks
union all
select 'attendance_records', count(*) filter (where term_id is null) from public.attendance_records
union all
select 'points_adjustments', count(*) filter (where term_id is null) from public.points_adjustments
order by content_type;

select
  source_type,
  count(*) as ledger_entries,
  sum(points) as total_points
from public.point_ledger
group by source_type
order by source_type;

