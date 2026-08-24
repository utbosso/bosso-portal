# BOSSO Supabase migration checklist

The semester migrations are additive, but activation changes access and archives
the outgoing semester's shared content. Treat schema installation and activation
as separate maintenance steps.

## 1. Rehearse away from production

Use a Supabase preview branch or a separate test project populated from a recent,
sanitized production backup. Do not use the live project for the first execution.

Run `supabase/checks/semester_preflight.sql` and save its output with the backup.
The required results are:

- every expected legacy table is present;
- exactly one confirmed `internal@txbosso.com` auth user exists;
- no profiles are orphaned from `auth.users`;
- duplicate profile-email query returns no rows.

## 2. Install the schema

Apply the files in timestamp order:

1. `20260820065551_semester_portal_foundation.sql`
2. `20260820160000_term_groups_and_delegated_point_requests.sql`
3. `20260820173000_task_reference_links.sql`
4. `20260820181500_announcement_reference_links.sql`
5. `20260820214008_atomic_semester_activation.sql`
6. `20260821050000_point_request_event_link.sql`
7. `20260824000000_role_based_point_minimums.sql`

Schema installation does not activate Fall. It keeps Spring 2026 current, assigns
legacy records to Spring, preserves their visibility, and creates Fall 2026 as an
upcoming term.

Run `supabase/checks/semester_post_migration.sql`. Do not continue unless:

- Spring is the only current term and Fall is upcoming;
- every reported table has RLS enabled;
- `anon_can_activate` and `member_can_activate` are false;
- `service_can_activate` is true;
- every legacy `missing_term` count is zero;
- the point-proof bucket is private.

Run Supabase database advisors and resolve security findings before production.

## 3. Test the application before activation

Deploy the compatible portal build to the test environment and verify:

- administrator access;
- an approved returning member still has Spring access;
- announcements, events, documents, feedback, and tasks remain visible;
- Fall appears as upcoming in Semester setup;
- Fall point rules remain Draft;
- generating position codes does not grant a role by itself.

Run `supabase/checks/semester_activation_dry_run.sql`, confirm the target slug and
archive counts, and save the output.

## 4. Activate in the test environment

Use **Admin → Semester setup → Activate term** once. The portal calls one atomic
PostgreSQL function. A database error rolls back the content archive, term status,
administrator exemption, old-code deactivation, and rollover audit together.

Run `supabase/checks/semester_post_activation.sql`, then test these accounts:

- `internal@txbosso.com` administrator;
- approved returning member;
- unpaid returning member;
- pending position request;
- brand-new signup.

Also verify points, action-item status synchronization, announcement targeting,
calendar audiences, semester groups, delegated point requests, and private proof
downloads.

## 5. Production sequence

1. Schedule a maintenance window.
2. Create and verify a production database backup.
3. Save the preflight output and current row counts.
4. Apply the five migrations in timestamp order.
5. Run the post-migration checks.
6. Deploy the compatible portal build.
7. Sign in as `internal@txbosso.com` and test Spring access.
8. Run and save the activation dry run.
9. Activate Fall once from Semester setup.
10. Run the post-activation checks and the five-account test matrix.
11. Keep point requirements in Draft until the board approves them.

## Recovery rules

- A failed atomic activation requires diagnosis, not data repair: PostgreSQL rolls
  the activation transaction back automatically. Re-run the post-migration and
  dry-run checks before deciding whether to retry.
- If the schema is installed but activation has not occurred, an application
  rollback is safe. Leave the additive database objects in place and redeploy the
  prior portal version; do not drop tables containing backfilled history.
- If the wrong semester was successfully activated, stop all writes and restore
  the verified pre-activation backup. Do not manually unarchive broad tables or
  rewrite term IDs without a record-by-record recovery plan.
- Never delete auth users, profiles, point-ledger history, dues payments, personal
  documents, or personal tasks as part of rollback.

For diagnosis, inspect the latest rollover and term state with:

```sql
select * from public.semester_rollovers order by created_at desc limit 5;
select id, slug, status, updated_at from public.academic_terms order by starts_on;
```
