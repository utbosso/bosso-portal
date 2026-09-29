-- One-time backfill: every existing portal member becomes a newsletter
-- subscriber. New members get added automatically going forward by
-- src/app/api/auth/email-signup/route.ts; new website signups already flow
-- through /api/newsletter/subscribe. This only adds rows for emails that
-- aren't already present, so it never overrides an existing unsubscribe.
insert into public.newsletter_subscribers (email)
select distinct lower(email)
from public.profiles
where email is not null and email <> ''
on conflict (email) do nothing;
