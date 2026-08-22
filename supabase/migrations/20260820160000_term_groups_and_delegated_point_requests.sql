-- Current-semester custom groups and delegated point requests.
-- Semester approval controls portal participation; point-minimum progress must
-- never remove an approved member from announcements, tasks, or directories.

create table if not exists public.term_member_groups (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text check (description is null or char_length(description) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists term_member_groups_term_name_idx
  on public.term_member_groups (term_id, lower(name));

create table if not exists public.term_member_group_members (
  group_id uuid not null references public.term_member_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists term_member_group_members_user_idx
  on public.term_member_group_members (user_id, group_id);

alter table public.term_member_groups enable row level security;
alter table public.term_member_group_members enable row level security;

-- Custom groups are served through authenticated server routes so group
-- membership is always intersected with the approved current-term directory.
revoke all on public.term_member_groups, public.term_member_group_members from anon, authenticated;
grant all on public.term_member_groups, public.term_member_group_members to service_role;

alter table public.point_requests
  add column if not exists submitted_by uuid references auth.users(id) on delete set null;

update public.point_requests
set submitted_by = user_id
where submitted_by is null;

alter table public.point_requests
  alter column submitted_by set default auth.uid();

create index if not exists point_requests_submitter_term_idx
  on public.point_requests (submitted_by, term_id, created_at desc);

create or replace function private.is_current_term_participant(check_user_id uuid, check_term_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.member_term_memberships membership
    join public.academic_terms term on term.id = membership.term_id
    where membership.user_id = check_user_id
      and membership.term_id = check_term_id
      and term.status = 'current'
      and membership.status in ('active', 'exempt')
      and membership.dues_status in ('paid', 'exempt')
  );
$$;

revoke all on function private.is_current_term_participant(uuid, uuid) from public;
grant execute on function private.is_current_term_participant(uuid, uuid) to authenticated;

drop policy if exists "members create own point requests" on public.point_requests;
drop policy if exists "members read own point requests" on public.point_requests;
drop policy if exists "members update pending point requests" on public.point_requests;

create policy "members create current term point requests"
on public.point_requests for insert to authenticated
with check (
  submitted_by = auth.uid()
  and status = 'pending'
  and private.is_current_term_participant(auth.uid(), term_id)
  and private.is_current_term_participant(user_id, term_id)
);

create policy "members read submitted or beneficiary point requests"
on public.point_requests for select to authenticated
using (
  submitted_by = auth.uid()
  or user_id = auth.uid()
  or private.is_portal_admin()
);

create policy "submitters update pending point requests"
on public.point_requests for update to authenticated
using (
  submitted_by = auth.uid()
  and status in ('pending', 'needs_info')
  and private.is_current_term_participant(auth.uid(), term_id)
)
with check (
  submitted_by = auth.uid()
  and status in ('pending', 'needs_info')
  and private.is_current_term_participant(auth.uid(), term_id)
  and private.is_current_term_participant(user_id, term_id)
);

drop policy if exists "members read own request attachment records" on public.point_request_attachments;
drop policy if exists "members attach proof to own requests" on public.point_request_attachments;

create policy "request participants read attachment records"
on public.point_request_attachments for select to authenticated
using (
  user_id = auth.uid()
  or private.is_portal_admin()
  or exists (
    select 1
    from public.point_requests request
    where request.id = request_id
      and (request.user_id = auth.uid() or request.submitted_by = auth.uid())
  )
);

create policy "submitters attach point request proof"
on public.point_request_attachments for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.point_requests request
    where request.id = request_id
      and request.submitted_by = auth.uid()
      and private.is_current_term_participant(auth.uid(), request.term_id)
  )
);

drop policy if exists "members read their own point proof" on storage.objects;

create policy "request participants read point proof"
on storage.objects for select to authenticated
using (
  bucket_id = 'point-request-proof'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.is_portal_admin()
    or exists (
      select 1
      from public.point_request_attachments attachment
      join public.point_requests request on request.id = attachment.request_id
      where attachment.storage_path = storage.objects.name
        and (request.user_id = auth.uid() or request.submitted_by = auth.uid())
    )
  )
);
