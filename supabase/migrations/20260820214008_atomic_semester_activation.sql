-- Activate a semester as one database transaction.
--
-- The browser never receives permission to execute this function. The server
-- route authenticates the BOSSO administrator, then calls it with the service
-- role. PostgreSQL rolls back every archive/status/audit write if any statement
-- fails, so the portal cannot be left between semesters.

create or replace function public.activate_academic_term(
  target_term_id uuid,
  run_by_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_status text;
  current_term_id uuid;
  activation_time timestamptz := statement_timestamp();
  rollover_id uuid;
  archived_counts jsonb := '{}'::jsonb;
  archived_count bigint;
  content_table text;
begin
  if run_by_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'A verified BOSSO portal administrator is required.';
  end if;

  if not exists (
    select 1
    from auth.users portal_admin
    where portal_admin.id = run_by_user_id
      and lower(portal_admin.email) = 'internal@txbosso.com'
      and portal_admin.email_confirmed_at is not null
  ) then
    raise exception using
      errcode = '42501',
      message = 'A verified BOSSO portal administrator is required.';
  end if;

  -- Serialize activations before reading or changing the single current term.
  lock table public.academic_terms in share row exclusive mode;

  select term.status
    into target_status
    from public.academic_terms term
   where term.id = target_term_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The requested academic term does not exist.';
  end if;

  if target_status not in ('draft', 'upcoming') then
    raise exception using
      errcode = '22023',
      message = case
        when target_status = 'current' then 'This academic term is already current.'
        else 'Archived academic terms cannot be reactivated.'
      end;
  end if;

  select term.id
    into current_term_id
    from public.academic_terms term
   where term.status = 'current'
   limit 1
   for update;

  insert into public.semester_rollovers (
    from_term_id,
    to_term_id,
    status,
    configuration,
    result_summary,
    run_by
  )
  values (
    current_term_id,
    target_term_id,
    'started',
    jsonb_build_object(
      'archive_content', true,
      'preserve_accounts', true,
      'reset_points_by_term', true,
      'atomic', true
    ),
    '{}'::jsonb,
    run_by_user_id
  )
  returning id into rollover_id;

  foreach content_table in array array[
    'announcements',
    'events',
    'documents',
    'feedback_submissions',
    'tasks'
  ] loop
    archived_count := 0;

    if current_term_id is not null
      and to_regclass('public.' || content_table) is not null then
      execute format(
        'update public.%I
            set archived_at = $1,
                updated_at = $1
          where term_id = $2
            and archived_at is null',
        content_table
      ) using activation_time, current_term_id;

      get diagnostics archived_count = row_count;
    end if;

    archived_counts := archived_counts || jsonb_build_object(content_table, archived_count);
  end loop;

  if current_term_id is not null then
    update public.position_codes
       set is_active = false
     where term_id = current_term_id
       and is_active = true;

    update public.academic_terms
       set status = 'archived',
           updated_at = activation_time
     where id = current_term_id;
  end if;

  update public.academic_terms
     set status = 'current',
         updated_at = activation_time
   where id = target_term_id;

  insert into public.member_term_memberships (
    term_id,
    user_id,
    status,
    dues_status,
    position_role,
    is_returning,
    claimed_at,
    approved_at,
    approved_by,
    admin_note,
    updated_at
  )
  values (
    target_term_id,
    run_by_user_id,
    'exempt',
    'exempt',
    'admin',
    true,
    activation_time,
    activation_time,
    run_by_user_id,
    'Portal administrator exemption',
    activation_time
  )
  on conflict (term_id, user_id)
  do update set
    status = excluded.status,
    dues_status = excluded.dues_status,
    position_role = excluded.position_role,
    is_returning = excluded.is_returning,
    claimed_at = coalesce(public.member_term_memberships.claimed_at, excluded.claimed_at),
    approved_at = excluded.approved_at,
    approved_by = excluded.approved_by,
    admin_note = excluded.admin_note,
    updated_at = excluded.updated_at;

  update public.semester_rollovers
     set status = 'completed',
         result_summary = archived_counts,
         completed_at = activation_time
   where id = rollover_id;

  return jsonb_build_object(
    'rolloverId', rollover_id,
    'fromTermId', current_term_id,
    'toTermId', target_term_id,
    'archivedCounts', archived_counts,
    'completedAt', activation_time
  );
end;
$$;

revoke all on function public.activate_academic_term(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_academic_term(uuid, uuid)
  to service_role;
