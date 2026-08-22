-- BOSSO semester activation dry run (read-only)
-- Run after all migrations and before clicking Activate term. Change the slug in
-- each parameters CTE only if the intended target is not Fall 2026.

with parameters as (
  select 'fall-2026'::text as target_slug
)
select
  term.id,
  term.name,
  term.slug,
  term.status,
  term.points_rules_status,
  term.starts_on,
  term.ends_on,
  term.renewal_opens_at
from public.academic_terms term, parameters
where term.status = 'current' or term.slug = parameters.target_slug
order by term.starts_on;

with current_term as (
  select id from public.academic_terms where status = 'current'
)
select 'announcements' as content_type, count(*) as rows_to_archive
from public.announcements, current_term
where term_id = current_term.id and archived_at is null
union all
select 'events', count(*) from public.events, current_term
where term_id = current_term.id and archived_at is null
union all
select 'documents', count(*) from public.documents, current_term
where term_id = current_term.id and archived_at is null
union all
select 'feedback_submissions', count(*) from public.feedback_submissions, current_term
where term_id = current_term.id and archived_at is null
union all
select 'tasks', count(*) from public.tasks, current_term
where term_id = current_term.id and archived_at is null
order by content_type;

with parameters as (
  select 'fall-2026'::text as target_slug
), target_term as (
  select id from public.academic_terms, parameters where slug = parameters.target_slug
)
select
  rule.category,
  rule.label,
  rule.minimum_points,
  term.points_rules_status
from public.term_point_rules rule
join public.academic_terms term on term.id = rule.term_id
join target_term on target_term.id = term.id
order by rule.category;

with parameters as (
  select 'fall-2026'::text as target_slug
), target_term as (
  select id from public.academic_terms, parameters where slug = parameters.target_slug
)
select
  membership.status,
  membership.dues_status,
  membership.position_role,
  count(*) as member_count
from public.member_term_memberships membership
join target_term on target_term.id = membership.term_id
group by membership.status, membership.dues_status, membership.position_role
order by membership.status, membership.position_role;

with parameters as (
  select 'fall-2026'::text as target_slug
), target_term as (
  select id from public.academic_terms, parameters where slug = parameters.target_slug
)
select
  code.label,
  code.intended_role,
  code.is_active,
  code.max_uses,
  code.expires_at
from public.position_codes code
join target_term on target_term.id = code.term_id
order by code.intended_role, code.label;

