-- BOSSO post-activation verification (read-only)
-- Expected after activating Fall 2026: Fall is the only current term, the latest
-- rollover is completed, outgoing content is archived, and the admin is exempt.

select
  count(*) filter (where status = 'current') as current_term_count,
  count(*) filter (where slug = 'fall-2026' and status = 'current') as fall_current,
  count(*) filter (where slug = 'spring-2026' and status = 'archived') as spring_archived
from public.academic_terms;

select
  rollover.id,
  source.slug as source_term,
  target.slug as target_term,
  rollover.status,
  rollover.configuration,
  rollover.result_summary,
  rollover.created_at,
  rollover.completed_at
from public.semester_rollovers rollover
left join public.academic_terms source on source.id = rollover.from_term_id
join public.academic_terms target on target.id = rollover.to_term_id
order by rollover.created_at desc
limit 5;

with source_term as (
  select id from public.academic_terms where slug = 'spring-2026'
)
select 'announcements' as content_type, count(*) as still_visible
from public.announcements, source_term
where term_id = source_term.id and archived_at is null
union all
select 'events', count(*) from public.events, source_term
where term_id = source_term.id and archived_at is null
union all
select 'documents', count(*) from public.documents, source_term
where term_id = source_term.id and archived_at is null
union all
select 'feedback_submissions', count(*) from public.feedback_submissions, source_term
where term_id = source_term.id and archived_at is null
union all
select 'tasks', count(*) from public.tasks, source_term
where term_id = source_term.id and archived_at is null
order by content_type;

select
  profile.email,
  membership.status,
  membership.dues_status,
  membership.position_role,
  membership.approved_at
from public.member_term_memberships membership
join public.academic_terms term on term.id = membership.term_id
join public.profiles profile on profile.id = membership.user_id
where term.slug = 'fall-2026'
  and lower(profile.email) = 'internal@txbosso.com';

select
  membership.status,
  membership.dues_status,
  membership.position_role,
  count(*) as member_count
from public.member_term_memberships membership
join public.academic_terms term on term.id = membership.term_id
where term.slug = 'fall-2026'
group by membership.status, membership.dues_status, membership.position_role
order by membership.status, membership.position_role;

select count(*) as active_outgoing_codes
from public.position_codes code
join public.academic_terms term on term.id = code.term_id
where term.slug = 'spring-2026'
  and code.is_active;

