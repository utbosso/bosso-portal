-- BOSSO semester portal foundation
--
-- This migration deliberately archives semester-owned records instead of deleting
-- them. Auth users and profiles are permanent; access, dues, positions, and points
-- are represented by term-scoped records.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  academic_year text not null,
  semester text not null check (semester in ('fall', 'spring', 'summer')),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  renewal_opens_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'upcoming', 'current', 'archived')),
  points_rules_status text not null default 'draft' check (points_rules_status in ('draft', 'published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists academic_terms_one_current_idx
  on public.academic_terms (status)
  where status = 'current';

create table if not exists public.member_term_memberships (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.academic_terms(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending_dues'
    check (status in ('pending_dues', 'pending_approval', 'active', 'declined', 'exempt')),
  dues_status text not null default 'unpaid' check (dues_status in ('unpaid', 'paid', 'exempt')),
  position_role text not null default 'general_member'
    check (position_role in ('general_member', 'analyst', 'project_manager', 'board_member', 'admin')),
  is_returning boolean not null default false,
  claimed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id, user_id)
);

create index if not exists member_term_memberships_user_idx
  on public.member_term_memberships (user_id, term_id);
create index if not exists member_term_memberships_review_idx
  on public.member_term_memberships (term_id, status, dues_status);

create table if not exists public.dues_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  payment_reference text,
  paid_at timestamptz not null,
  recorded_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.dues_payment_terms (
  payment_id uuid not null references public.dues_payments(id) on delete cascade,
  term_id uuid not null references public.academic_terms(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (payment_id, term_id)
);

create table if not exists public.position_codes (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  label text not null,
  code_hash text not null,
  intended_role text not null
    check (intended_role in ('general_member', 'analyst', 'project_manager', 'board_member', 'admin')),
  max_uses integer check (max_uses is null or max_uses > 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (term_id, code_hash)
);

create table if not exists public.position_code_claims (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  membership_id uuid not null references public.member_term_memberships(id) on delete cascade,
  code_id uuid not null references public.position_codes(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_role text not null
    check (requested_role in ('general_member', 'analyst', 'project_manager', 'board_member', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  unique (term_id, user_id)
);

create table if not exists public.term_point_rules (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  category text not null check (category in ('membership', 'professional_education', 'social', 'philanthropy')),
  label text not null,
  minimum_points numeric(8,2) not null default 0 check (minimum_points >= 0),
  target_points numeric(8,2) check (target_points is null or target_points >= minimum_points),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id, category)
);

create table if not exists public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.academic_terms(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('membership', 'professional_education', 'social', 'philanthropy')),
  points numeric(8,2) not null,
  source_type text not null check (source_type in ('attendance', 'adjustment', 'task', 'request', 'rollover', 'admin')),
  source_id text,
  note text,
  awarded_by uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  unique (term_id, user_id, source_type, source_id)
);

create index if not exists point_ledger_member_term_idx
  on public.point_ledger (user_id, term_id, occurred_at desc)
  where voided_at is null;

create table if not exists public.point_requests (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.academic_terms(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_points numeric(8,2) not null check (requested_points > 0 and requested_points <= 1000),
  suggested_category text not null check (suggested_category in ('membership', 'professional_education', 'social', 'philanthropy')),
  note text not null check (char_length(trim(note)) between 3 and 4000),
  status text not null default 'pending' check (status in ('pending', 'needs_info', 'approved', 'declined')),
  final_points numeric(8,2) check (final_points is null or (final_points > 0 and final_points <= 1000)),
  final_category text check (final_category is null or final_category in ('membership', 'professional_education', 'social', 'philanthropy')),
  reviewer_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists point_requests_review_queue_idx
  on public.point_requests (term_id, status, created_at);
create index if not exists point_requests_user_idx
  on public.point_requests (user_id, term_id, created_at desc);

create table if not exists public.point_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.point_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

create table if not exists public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists task_status_history_task_idx
  on public.task_status_history (task_id, created_at desc);

create table if not exists public.semester_rollovers (
  id uuid primary key default gen_random_uuid(),
  from_term_id uuid references public.academic_terms(id) on delete restrict,
  to_term_id uuid not null references public.academic_terms(id) on delete restrict,
  status text not null default 'completed' check (status in ('started', 'completed', 'failed')),
  configuration jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  run_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Add lifecycle columns to legacy semester-owned tables when those tables exist.
do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'announcements', 'events', 'documents', 'feedback_submissions', 'tasks'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I add column if not exists term_id uuid references public.academic_terms(id) on delete restrict', table_name);
      execute format('alter table public.%I add column if not exists archived_at timestamptz', table_name);
      execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', table_name);
      execute format('create index if not exists %I on public.%I (term_id, archived_at)', table_name || '_term_archive_idx', table_name);
    end if;
  end loop;

  foreach table_name in array array['attendance_records', 'points_adjustments'] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I add column if not exists term_id uuid references public.academic_terms(id) on delete restrict', table_name);
      execute format('create index if not exists %I on public.%I (term_id)', table_name || '_term_idx', table_name);
    end if;
  end loop;
end
$migration$;

-- Install the term records without performing the rollover. Spring remains the
-- current term until an administrator explicitly activates Fall through the
-- setup wizard. This keeps schema deployment separate from the access cutoff.
insert into public.academic_terms
  (name, slug, academic_year, semester, starts_on, ends_on, status, points_rules_status)
values
  ('Spring 2026', 'spring-2026', '2025–2026', 'spring', '2026-01-12', '2026-05-15', 'current', 'published'),
  ('Fall 2026', 'fall-2026', '2026–2027', 'fall', '2026-08-24', '2026-12-18', 'upcoming', 'draft'),
  ('Spring 2027', 'spring-2027', '2026–2027', 'spring', '2027-01-11', '2027-05-14', 'draft', 'draft')
on conflict (slug) do nothing;

insert into public.term_point_rules (term_id, category, label, minimum_points, target_points, description)
select
  term.id,
  category,
  label,
  case when term.slug = 'spring-2026' then 25 else 0 end,
  null,
  case
    when term.slug = 'spring-2026' then 'Historical requirement from the first portal year.'
    else 'Requirements are being finalized for this semester.'
  end
from public.academic_terms term
cross join (
  values
    ('membership', 'Membership'),
    ('professional_education', 'Professional / Education'),
    ('social', 'Social'),
    ('philanthropy', 'Philanthropy')
) as rules(category, label)
where term.slug in ('spring-2026', 'fall-2026', 'spring-2027')
on conflict (term_id, category) do nothing;

-- Assign legacy activity to Spring 2026 without hiding it. The atomic activation
-- function introduced later archives only the outgoing term when Fall is
-- deliberately activated.
do $migration$
declare
  legacy_term_id uuid;
  table_name text;
begin
  select id into legacy_term_id from public.academic_terms where slug = 'spring-2026';

  if to_regclass('public.profiles') is not null then
    insert into public.member_term_memberships
      (term_id, user_id, status, dues_status, position_role, is_returning, claimed_at, approved_at, admin_note)
    select
      legacy_term_id,
      profile.id,
      case
        when lower(profile.email) = 'internal@txbosso.com' then 'exempt'
        when profile.account_status::text in ('approved', 'active') then 'active'
        else 'pending_dues'
      end,
      case
        when lower(profile.email) = 'internal@txbosso.com' then 'exempt'
        when profile.account_status::text in ('approved', 'active') then 'paid'
        else 'unpaid'
      end,
      case
        when lower(profile.email) = 'internal@txbosso.com' then 'admin'
        when profile.role::text in ('general_member', 'analyst', 'project_manager', 'board_member', 'admin') then profile.role::text
        else 'general_member'
      end,
      true,
      coalesce(profile.created_at, now()),
      case
        when lower(profile.email) = 'internal@txbosso.com'
          or profile.account_status::text in ('approved', 'active')
        then coalesce(profile.created_at, now())
        else null
      end,
      'Backfilled from the first portal year; original profile and history preserved.'
    from public.profiles profile
    on conflict (term_id, user_id) do nothing;
  end if;

  foreach table_name in array array[
    'announcements', 'events', 'documents', 'feedback_submissions', 'tasks'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'update public.%I set term_id = $1 where term_id is null',
        table_name
      ) using legacy_term_id;
    end if;
  end loop;

  foreach table_name in array array['attendance_records', 'points_adjustments'] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('update public.%I set term_id = $1 where term_id is null', table_name) using legacy_term_id;
    end if;
  end loop;
end
$migration$;

create or replace function private.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'internal@txbosso.com';
$$;

revoke all on function private.is_portal_admin() from public;
grant execute on function private.is_portal_admin() to authenticated;

create or replace function private.is_active_term_member(check_user_id uuid, check_term_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.member_term_memberships membership
    join public.academic_terms term on term.id = membership.term_id
    where membership.user_id = check_user_id
      and membership.term_id = check_term_id
      and term.status = 'current'
      and membership.status in ('active', 'exempt')
      and membership.dues_status in ('paid', 'exempt')
  ) and (check_user_id = auth.uid() or private.is_portal_admin());
$$;

revoke all on function private.is_active_term_member(uuid, uuid) from public;
grant execute on function private.is_active_term_member(uuid, uuid) to authenticated;

create or replace function public.get_portal_access_status()
returns table (
  term_id uuid,
  term_name text,
  term_status text,
  membership_status text,
  dues_status text,
  position_role text,
  access_granted boolean,
  reason text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with current_term as (
    select term.id, term.name, term.status
    from public.academic_terms term
    where term.status = 'current'
    limit 1
  )
  select
    current_term.id,
    current_term.name,
    current_term.status,
    membership.status,
    membership.dues_status,
    membership.position_role,
    coalesce(
      private.is_portal_admin(),
      false
    ) or (
      membership.status in ('active', 'exempt')
      and membership.dues_status in ('paid', 'exempt')
    ),
    case
      when current_term.id is null then 'setup_required'
      when private.is_portal_admin() then 'admin_exempt'
      when membership.id is null then 'renewal_required'
      when membership.dues_status = 'unpaid' then 'dues_required'
      when membership.status = 'pending_approval' then 'pending_approval'
      when membership.status = 'declined' then 'declined'
      when membership.status in ('active', 'exempt') then 'active'
      else 'renewal_required'
    end
  from current_term
  left join public.member_term_memberships membership
    on membership.term_id = current_term.id
   and membership.user_id = auth.uid()
  union all
  select null, null, null, null, null, null, private.is_portal_admin(), 'setup_required'
  where not exists (select 1 from current_term)
  limit 1;
$$;

revoke all on function public.get_portal_access_status() from public, anon;

create or replace view public.member_term_point_summary
with (security_invoker = true)
as
select
  ledger.term_id,
  ledger.user_id,
  coalesce(sum(ledger.points) filter (where ledger.voided_at is null), 0)::numeric(10,2) as total_points,
  coalesce(sum(ledger.points) filter (where ledger.voided_at is null and ledger.category = 'membership'), 0)::numeric(10,2) as membership_points,
  coalesce(sum(ledger.points) filter (where ledger.voided_at is null and ledger.category = 'professional_education'), 0)::numeric(10,2) as professional_education_points,
  coalesce(sum(ledger.points) filter (where ledger.voided_at is null and ledger.category = 'social'), 0)::numeric(10,2) as social_points,
  coalesce(sum(ledger.points) filter (where ledger.voided_at is null and ledger.category = 'philanthropy'), 0)::numeric(10,2) as philanthropy_points,
  count(*) filter (where ledger.voided_at is null) as entry_count
from public.point_ledger ledger
group by ledger.term_id, ledger.user_id;

-- Keep legacy attendance/adjustment write paths synchronized with the canonical ledger.
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

  insert into public.point_ledger
    (term_id, user_id, category, points, source_type, source_id, note, awarded_by, occurred_at, voided_at)
  values
    (selected_term_id, selected_user_id, selected_category, coalesce((row_data ->> 'points_earned')::numeric, 0),
     'attendance', row_data ->> 'id', 'Event attendance', auth.uid(),
     coalesce((row_data ->> 'checked_in_at')::timestamptz, now()), null)
  on conflict (term_id, user_id, source_type, source_id)
  do update set
    category = excluded.category,
    points = excluded.points,
    occurred_at = excluded.occurred_at,
    voided_at = null,
    voided_by = null;

  return new;
end;
$$;

create or replace function private.sync_adjustment_to_point_ledger()
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
  selected_reason text;
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
       and source_type = 'adjustment'
       and source_id = row_data ->> 'id';
    return old;
  end if;

  selected_reason := coalesce(row_data ->> 'reason', 'Manual adjustment');
  selected_category := substring(selected_reason from '\((membership|professional_education|social|philanthropy)\)');
  selected_category := coalesce(selected_category, 'membership');

  insert into public.point_ledger
    (term_id, user_id, category, points, source_type, source_id, note, awarded_by, occurred_at, voided_at)
  values
    (selected_term_id, selected_user_id, selected_category, coalesce((row_data ->> 'points')::numeric, 0),
     'adjustment', row_data ->> 'id', selected_reason,
     nullif(row_data ->> 'adjusted_by', '')::uuid,
     coalesce((row_data ->> 'created_at')::timestamptz, now()), null)
  on conflict (term_id, user_id, source_type, source_id)
  do update set
    category = excluded.category,
    points = excluded.points,
    note = excluded.note,
    awarded_by = excluded.awarded_by,
    occurred_at = excluded.occurred_at,
    voided_at = null,
    voided_by = null;

  return new;
end;
$$;

revoke all on function private.sync_attendance_to_point_ledger() from public;
revoke all on function private.sync_adjustment_to_point_ledger() from public;

create or replace function private.audit_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status text;
  new_status text;
begin
  old_status := case when tg_op = 'INSERT' then null else coalesce(to_jsonb(old) ->> 'assignee_status', to_jsonb(old) ->> 'status') end;
  new_status := coalesce(to_jsonb(new) ->> 'assignee_status', to_jsonb(new) ->> 'status');

  if tg_op = 'INSERT' or old_status is distinct from new_status then
    insert into public.task_status_history (task_id, from_status, to_status, changed_by)
    values (new.id, old_status, new_status, auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function private.audit_task_status_change() from public;

create or replace function private.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_trusted boolean;
  new_data jsonb;
  old_data jsonb;
begin
  is_trusted := private.is_portal_admin()
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  new_data := to_jsonb(new);

  if is_trusted then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new_data ->> 'role', 'general_member') <> 'general_member'
      or coalesce(new_data ->> 'account_status', 'pending_approval') not in ('pending', 'pending_approval') then
      raise exception 'New profiles cannot grant their own role or approval';
    end if;
    return new;
  end if;

  old_data := to_jsonb(old);
  if (new_data -> 'role') is not distinct from (old_data -> 'role')
    and (new_data -> 'account_status') is not distinct from (old_data -> 'account_status')
    and (new_data -> 'email') is not distinct from (old_data -> 'email')
    and (new_data -> 'verification_token') is not distinct from (old_data -> 'verification_token')
    and coalesce((new_data ->> 'email_verified')::boolean, false)
    and auth.uid() = new.id
    and exists (
      select 1 from auth.users auth_user
      where auth_user.id = auth.uid() and auth_user.email_confirmed_at is not null
    ) then
    return new;
  end if;

  if (new_data -> 'role') is distinct from (old_data -> 'role')
    or (new_data -> 'account_status') is distinct from (old_data -> 'account_status')
    or (new_data -> 'email_verified') is distinct from (old_data -> 'email_verified')
    or (new_data -> 'email') is distinct from (old_data -> 'email')
    or (new_data -> 'verification_token') is distinct from (old_data -> 'verification_token')
    or (new_data -> 'verified_at') is distinct from (old_data -> 'verified_at') then
    raise exception 'Only the portal administrator can change access fields';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_profile_security_fields() from public;

do $migration$
begin
  if to_regclass('public.attendance_records') is not null then
    drop trigger if exists sync_attendance_to_point_ledger on public.attendance_records;
    create trigger sync_attendance_to_point_ledger
      after insert or update or delete on public.attendance_records
      for each row execute function private.sync_attendance_to_point_ledger();

    insert into public.point_ledger
      (term_id, user_id, category, points, source_type, source_id, note, occurred_at)
    select
      record.term_id,
      record.user_id,
      case when record.event_category in ('membership', 'professional_education', 'social', 'philanthropy')
        then record.event_category else 'membership' end,
      coalesce(record.points_earned, 0),
      'attendance', record.id::text, 'Legacy event attendance', coalesce(record.checked_in_at, now())
    from public.attendance_records record
    where record.term_id is not null
    on conflict (term_id, user_id, source_type, source_id) do nothing;
  end if;

  if to_regclass('public.points_adjustments') is not null then
    drop trigger if exists sync_adjustment_to_point_ledger on public.points_adjustments;
    create trigger sync_adjustment_to_point_ledger
      after insert or update or delete on public.points_adjustments
      for each row execute function private.sync_adjustment_to_point_ledger();

    insert into public.point_ledger
      (term_id, user_id, category, points, source_type, source_id, note, awarded_by, occurred_at)
    select
      adjustment.term_id,
      adjustment.user_id,
      coalesce(substring(adjustment.reason from '\((membership|professional_education|social|philanthropy)\)'), 'membership'),
      adjustment.points,
      'adjustment', adjustment.id::text, adjustment.reason, adjustment.adjusted_by, coalesce(adjustment.created_at, now())
    from public.points_adjustments adjustment
    where adjustment.term_id is not null
    on conflict (term_id, user_id, source_type, source_id) do nothing;
  end if;

  if to_regclass('public.tasks') is not null then
    drop trigger if exists audit_task_status_change on public.tasks;
    create trigger audit_task_status_change
      after insert or update on public.tasks
      for each row execute function private.audit_task_status_change();
  end if;

  if to_regclass('public.profiles') is not null then
    drop trigger if exists protect_profile_security_fields on public.profiles;
    create trigger protect_profile_security_fields
      before insert or update on public.profiles
      for each row execute function private.protect_profile_security_fields();
  end if;
end
$migration$;

-- Every public table is RLS protected. The single portal administrator is derived
-- from the verified JWT email, never from editable profile metadata.
alter table public.academic_terms enable row level security;
alter table public.member_term_memberships enable row level security;
alter table public.dues_payments enable row level security;
alter table public.dues_payment_terms enable row level security;
alter table public.position_codes enable row level security;
alter table public.position_code_claims enable row level security;
alter table public.term_point_rules enable row level security;
alter table public.point_ledger enable row level security;
alter table public.point_requests enable row level security;
alter table public.point_request_attachments enable row level security;
alter table public.task_status_history enable row level security;
alter table public.semester_rollovers enable row level security;

create policy "terms are readable by signed in users" on public.academic_terms
  for select to authenticated using (true);
create policy "admin manages terms" on public.academic_terms
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());

create policy "members read own term membership" on public.member_term_memberships
  for select to authenticated using (user_id = auth.uid() or private.is_portal_admin());
create policy "admin manages term memberships" on public.member_term_memberships
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());

create policy "members read own dues payments" on public.dues_payments
  for select to authenticated using (user_id = auth.uid() or private.is_portal_admin());
create policy "admin manages dues payments" on public.dues_payments
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());
create policy "members read own dues coverage" on public.dues_payment_terms
  for select to authenticated using (
    private.is_portal_admin() or exists (
      select 1 from public.dues_payments payment
      where payment.id = payment_id and payment.user_id = auth.uid()
    )
  );
create policy "admin manages dues coverage" on public.dues_payment_terms
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());

create policy "admin manages position codes" on public.position_codes
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());
create policy "members read own position claims" on public.position_code_claims
  for select to authenticated using (user_id = auth.uid() or private.is_portal_admin());
create policy "admin manages position claims" on public.position_code_claims
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());

create policy "point rules are readable by signed in users" on public.term_point_rules
  for select to authenticated using (true);
create policy "admin manages point rules" on public.term_point_rules
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());

create policy "members read own point ledger" on public.point_ledger
  for select to authenticated using (user_id = auth.uid() or private.is_portal_admin());
create policy "admin manages point ledger" on public.point_ledger
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());

create policy "members create own point requests" on public.point_requests
  for insert to authenticated with check (
    user_id = auth.uid()
    and status = 'pending'
    and private.is_active_term_member(auth.uid(), term_id)
  );
create policy "members read own point requests" on public.point_requests
  for select to authenticated using (user_id = auth.uid() or private.is_portal_admin());
create policy "members update pending point requests" on public.point_requests
  for update to authenticated
  using (
    user_id = auth.uid()
    and status in ('pending', 'needs_info')
    and private.is_active_term_member(auth.uid(), term_id)
  )
  with check (
    user_id = auth.uid()
    and status in ('pending', 'needs_info')
    and private.is_active_term_member(auth.uid(), term_id)
  );
create policy "admin manages point requests" on public.point_requests
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());

create policy "members read own request attachment records" on public.point_request_attachments
  for select to authenticated using (user_id = auth.uid() or private.is_portal_admin());
create policy "members attach proof to own requests" on public.point_request_attachments
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.point_requests request
      where request.id = request_id
        and request.user_id = auth.uid()
        and private.is_active_term_member(auth.uid(), request.term_id)
    )
  );

do $migration$
begin
  if to_regclass('public.tasks') is not null then
    execute $policy$
      create policy "task participants read status history" on public.task_status_history
        for select to authenticated using (
          private.is_portal_admin()
          or exists (
            select 1 from public.tasks task
            where task.id = task_id
              and (task.assigned_to = auth.uid() or task.assigned_by = auth.uid())
          )
        )
    $policy$;
  end if;
end
$migration$;
create policy "admin manages task status history" on public.task_status_history
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());

create policy "admin manages rollover audit" on public.semester_rollovers
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());

-- Explicit grants keep the Data API surface intentional.
revoke all on public.academic_terms, public.member_term_memberships, public.dues_payments,
  public.dues_payment_terms, public.position_codes, public.position_code_claims,
  public.term_point_rules, public.point_ledger, public.point_requests,
  public.point_request_attachments, public.task_status_history, public.semester_rollovers
  from anon, authenticated;
revoke all on public.member_term_point_summary from anon, authenticated;

grant usage on schema public to authenticated;
grant select on public.academic_terms, public.term_point_rules, public.member_term_point_summary to authenticated;
grant select on public.member_term_memberships, public.dues_payments, public.dues_payment_terms to authenticated;
grant select on public.position_code_claims to authenticated;
grant select on public.point_ledger, public.task_status_history to authenticated;
grant select, insert on public.point_requests to authenticated;
grant update (requested_points, suggested_category, note, updated_at) on public.point_requests to authenticated;
grant select, insert on public.point_request_attachments to authenticated;
grant execute on function public.get_portal_access_status() to authenticated;

grant all on public.academic_terms, public.member_term_memberships, public.dues_payments,
  public.dues_payment_terms, public.position_codes, public.position_code_claims,
  public.term_point_rules, public.point_ledger, public.point_requests,
  public.point_request_attachments, public.task_status_history, public.semester_rollovers
  to service_role;
grant select on public.member_term_point_summary to service_role;

-- Private proof bucket. Members can only access their own user-id folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'point-request-proof',
  'point-request-proof',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "members upload their own point proof"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'point-request-proof'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "members read their own point proof"
on storage.objects for select to authenticated
using (
  bucket_id = 'point-request-proof'
  and ((storage.foldername(name))[1] = auth.uid()::text or private.is_portal_admin())
);

create policy "members remove their own point proof"
on storage.objects for delete to authenticated
using (
  bucket_id = 'point-request-proof'
  and ((storage.foldername(name))[1] = auth.uid()::text or private.is_portal_admin())
);

-- Publish only the tables that need immediate multi-client consistency.
do $migration$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'academic_terms', 'member_term_memberships', 'term_point_rules',
      'point_requests', 'point_ledger', 'task_status_history'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;

    foreach table_name in array array['tasks', 'task_updates'] loop
      if to_regclass('public.' || table_name) is not null and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end
$migration$;
