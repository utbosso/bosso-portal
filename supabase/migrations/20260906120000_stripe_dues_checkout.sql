-- In-portal Stripe dues checkout.
--
-- Members currently pay dues over Venmo and an administrator manually records
-- the payment and approves them (record_dues + review_membership in the admin
-- semester route). This adds a priced, self-serve alternative: a member pays
-- through the portal and a Stripe webhook grants access automatically. The
-- manual admin path is left completely in place as a fallback for cash,
-- comped members, and corrections.

create table if not exists public.dues_prices (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  position_role text not null
    check (position_role in ('general_member', 'analyst', 'project_manager', 'board_member')),
  plan_length text not null check (plan_length in ('semester', 'annual')),
  amount_cents integer not null check (amount_cents >= 0),
  stripe_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id, position_role, plan_length)
);

-- Singleton row: who eats the card-processing fee is one org-wide decision,
-- not something that varies by term or position.
create table if not exists public.dues_checkout_settings (
  id boolean primary key default true check (id),
  pass_fee_to_member boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.dues_checkout_settings (id) values (true) on conflict (id) do nothing;

alter table public.dues_payments
  add column if not exists source text not null default 'manual' check (source in ('manual', 'stripe')),
  add column if not exists stripe_checkout_session_id text unique;

-- Runs the same six writes as record_dues + review_membership in one atomic,
-- retry-safe call. Stripe redelivers webhook events, so a repeat delivery for
-- an already-processed checkout session must be a safe no-op rather than a
-- duplicate payment or a second approval.
create or replace function public.mark_dues_paid_and_activate(
  target_user_id uuid,
  target_term_ids uuid[],
  target_amount_cents integer,
  target_stripe_checkout_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_payment_id uuid;
  term_id_item uuid;
  primary_role text;
  activation_time timestamptz := statement_timestamp();
  activated_term_ids uuid[] := array[]::uuid[];
begin
  if target_user_id is null or target_term_ids is null or array_length(target_term_ids, 1) is null then
    raise exception using errcode = '22023', message = 'A member and at least one covered term are required.';
  end if;
  if target_stripe_checkout_session_id is null then
    raise exception using errcode = '22023', message = 'A Stripe checkout session id is required.';
  end if;

  insert into public.dues_payments (
    user_id, amount_cents, payment_reference, paid_at, recorded_by, note, source, stripe_checkout_session_id
  )
  values (
    target_user_id, target_amount_cents, null, activation_time, null,
    'Paid via Stripe checkout.', 'stripe', target_stripe_checkout_session_id
  )
  on conflict (stripe_checkout_session_id) do nothing
  returning id into new_payment_id;

  if new_payment_id is null then
    return jsonb_build_object('alreadyProcessed', true);
  end if;

  insert into public.dues_payment_terms (payment_id, term_id)
  select new_payment_id, unnested.term_id
  from unnest(target_term_ids) as unnested(term_id)
  on conflict (payment_id, term_id) do nothing;

  -- The first term in the list is always the member's current term (the
  -- checkout route orders it that way), so that's where the verified
  -- position role comes from - never trust a role passed in from outside.
  select membership.position_role
    into primary_role
    from public.member_term_memberships membership
   where membership.term_id = target_term_ids[1]
     and membership.user_id = target_user_id;

  foreach term_id_item in array target_term_ids loop
    update public.member_term_memberships
       set dues_status = 'paid',
           status = 'active',
           approved_at = activation_time,
           approved_by = null,
           updated_at = activation_time
     where term_id = term_id_item
       and user_id = target_user_id;

    if found then
      activated_term_ids := array_append(activated_term_ids, term_id_item);
    end if;

    update public.position_code_claims
       set status = 'approved',
           reviewed_by = null,
           reviewed_at = activation_time,
           review_note = 'Auto-approved after Stripe payment cleared.'
     where term_id = term_id_item
       and user_id = target_user_id
       and status = 'pending';
  end loop;

  if primary_role is not null and array_length(activated_term_ids, 1) is not null then
    update public.profiles
       set role = primary_role::public.user_role,
           account_status = 'approved'
     where id = target_user_id;
  end if;

  return jsonb_build_object(
    'paymentId', new_payment_id,
    'activatedTermIds', activated_term_ids,
    'completedAt', activation_time
  );
end;
$$;

revoke all on function public.mark_dues_paid_and_activate(uuid, uuid[], integer, text)
  from public, anon, authenticated;
grant execute on function public.mark_dues_paid_and_activate(uuid, uuid[], integer, text)
  to service_role;

alter table public.dues_prices enable row level security;
alter table public.dues_checkout_settings enable row level security;

create policy "prices are readable by signed in users" on public.dues_prices
  for select to authenticated using (true);
create policy "admin manages prices" on public.dues_prices
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());

create policy "settings are readable by signed in users" on public.dues_checkout_settings
  for select to authenticated using (true);
create policy "admin manages checkout settings" on public.dues_checkout_settings
  for all to authenticated using (private.is_portal_admin()) with check (private.is_portal_admin());

revoke all on public.dues_prices, public.dues_checkout_settings from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.dues_prices, public.dues_checkout_settings to authenticated;
grant all on public.dues_prices, public.dues_checkout_settings to service_role;

-- Fall 2026 dues confirmed by the financial director on 2026-09-08. Board
-- dues are intentionally lower than general member - existing org policy,
-- not a mistake.
insert into public.dues_prices (term_id, position_role, plan_length, amount_cents)
select term.id, prices.position_role, prices.plan_length, prices.amount_cents
from public.academic_terms term
cross join (
  values
    ('general_member', 'semester', 3500),
    ('general_member', 'annual', 6000),
    ('analyst', 'semester', 4500),
    ('analyst', 'annual', 8000),
    ('project_manager', 'semester', 3500),
    ('project_manager', 'annual', 6000),
    ('board_member', 'semester', 2500),
    ('board_member', 'annual', 4000)
) as prices(position_role, plan_length, amount_cents)
where term.slug = 'fall-2026'
on conflict (term_id, position_role, plan_length) do update set
  amount_cents = excluded.amount_cents,
  updated_at = now();

-- Members absorb the card/bank processing fee, confirmed 2026-09-08.
update public.dues_checkout_settings
   set pass_fee_to_member = true,
       updated_at = now()
 where id = true;
