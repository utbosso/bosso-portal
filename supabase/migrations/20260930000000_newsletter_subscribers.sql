-- Public newsletter signups from the external BOSSO website. Anyone can
-- subscribe (the insert path is service-role only, via
-- /api/newsletter/subscribe so basic server-side validation and a
-- honeypot can run) - only the portal admin can read the list, since this
-- is unsolicited PII from people who aren't portal members.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid()
);

create index if not exists newsletter_subscribers_active_idx
  on public.newsletter_subscribers (unsubscribed_at);

alter table public.newsletter_subscribers enable row level security;

create policy "admin reads newsletter subscribers"
on public.newsletter_subscribers for select to authenticated
using (private.is_portal_admin());

grant select on public.newsletter_subscribers to authenticated;
grant all on public.newsletter_subscribers to service_role;
