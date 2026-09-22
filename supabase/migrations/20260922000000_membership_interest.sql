-- Public "interested in joining" submissions from the external BOSSO
-- website. Anyone can submit (the insert path is service-role only, via
-- /api/membership-interest so basic server-side validation and a honeypot
-- can run) - only the portal admin can read or manage them, since this is
-- unsolicited PII from people who aren't portal members yet.
create table if not exists public.membership_interest_submissions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  graduation_year text,
  major text,
  how_heard text,
  note text,
  status text not null default 'new' check (status in ('new', 'contacted', 'dismissed')),
  contacted_by uuid references auth.users(id) on delete set null,
  contacted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists membership_interest_submissions_status_idx
  on public.membership_interest_submissions (status, created_at desc);

alter table public.membership_interest_submissions enable row level security;

create policy "admin reads interest submissions"
on public.membership_interest_submissions for select to authenticated
using (private.is_portal_admin());

create policy "admin updates interest submissions"
on public.membership_interest_submissions for update to authenticated
using (private.is_portal_admin())
with check (private.is_portal_admin());

grant select, update on public.membership_interest_submissions to authenticated;
grant all on public.membership_interest_submissions to service_role;
