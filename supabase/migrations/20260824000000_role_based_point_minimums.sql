-- Point minimums can now vary by position, matching how BOSSO actually set
-- requirements before the semester migration (general members, analysts,
-- project managers, and board members had different total-point thresholds).
-- A member's total requirement is the sum of their role's four category
-- minimums for the term.

alter table public.term_point_rules
  add column if not exists position_role text;

-- Drop the old (term_id, category) constraint before backfilling per-role rows -
-- otherwise every insert for the second, third, and fourth role on a given
-- category silently conflicts with the row already claimed by the first role.
alter table public.term_point_rules
  drop constraint if exists term_point_rules_term_id_category_key;

-- Expand each existing flat (term, category) minimum into one row per role,
-- preserving the value that was already enforced for everyone - including
-- Spring 2026's published 25-per-category floor - so nothing changes for a
-- term whose rules are already published until an admin deliberately edits it.
do $migration$
declare
  rule record;
  extra_role text;
begin
  for rule in
    select id, term_id, category, label, minimum_points, target_points, description
    from public.term_point_rules
    where position_role is null
  loop
    update public.term_point_rules set position_role = 'general_member' where id = rule.id;

    foreach extra_role in array array['analyst', 'project_manager', 'board_member']
    loop
      insert into public.term_point_rules (term_id, category, position_role, label, minimum_points, target_points, description)
      values (rule.term_id, rule.category, extra_role, rule.label, rule.minimum_points, rule.target_points, rule.description)
      on conflict do nothing;
    end loop;
  end loop;
end
$migration$;

alter table public.term_point_rules
  alter column position_role set not null;

alter table public.term_point_rules
  add constraint term_point_rules_position_role_check
    check (position_role in ('general_member', 'analyst', 'project_manager', 'board_member'));

alter table public.term_point_rules
  add constraint term_point_rules_term_category_role_key unique (term_id, category, position_role);
