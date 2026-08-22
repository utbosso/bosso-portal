# BOSSO semester rollover runbook

This portal treats accounts and history as permanent. A semester rollover creates a new access period; it never deletes members or past records.

## Current implementation status

The semester foundation and migration are local only. Do not assume the live database contains the new tables until the migration has been reviewed, backed up, approved, and applied during a separate deployment session.

The only portal administrator exemption is `internal@txbosso.com`.

Use [SUPABASE-MIGRATION-CHECKLIST.md](./SUPABASE-MIGRATION-CHECKLIST.md) for the test, backup, migration, verification, activation, and recovery sequence. Installing the schema keeps Spring 2026 current and preserves its visible content. Fall becomes current only when the administrator deliberately runs the activation step.

## Recommended timeline

### 1. Prepare the term

Open **Admin → Semester setup** and create the upcoming term. Confirm its name, slug, academic year, dates, and renewal opening date.

Saving a term generates new position codes. Copy them immediately: only secure hashes are stored, so the plain codes cannot be recovered. Distribute each code only to the intended position group. Entering a code creates a request; it does not grant privileged access by itself.

Leave point requirements in **Draft** while the board is discussing minimums. Members see that requirements are still being finalized. Once all four category minimums are approved, use **Publish requirements**. The same values then drive the member points page, dashboard, attendance view, breakdown, and admin view.

### 2. Collect renewals and dues

Returning members sign in with their existing account and see only the renewal screen until approved. They do not repeat email verification and do not lose prior points, tasks, or records.

New members verify their email automatically through the authentication email, then wait for position and dues review.

For each renewal:

1. Confirm the requested position is correct.
2. Record either semester dues or full-year dues.
3. Approve access only after dues are marked paid or exempt.

“Approved this term” means the member completed the renewal, position, and dues checks. It is separate from meeting published point minimums. A member who is below point minimums still receives announcements, can be assigned tasks, appears in semester selectors, and can earn or request points.

A full-year payment is linked to both the fall and spring term. When the member renews in spring, the system recognizes the existing coverage instead of asking for a second payment.

### 3. Activate the term

Before activation:

- make a verified Supabase database backup;
- confirm the upcoming term dates and generated codes;
- confirm at least the administrator can sign in;
- export the member list if a human-readable snapshot is useful;
- schedule a short maintenance window.

Use **Activate term** once. Activation archives current announcements, events, organization documents, feedback, and team action items. It preserves auth users, profiles, personal documents, personal tasks, attendance, dues history, and the point ledger. The old term becomes archived, the selected term becomes current, and an audit summary is recorded.

Activation is one PostgreSQL transaction. If any archive, term-status, administrator-access, code-deactivation, or audit write fails, the entire activation is rolled back.

After activation, test one account in each state: administrator, approved returning member, unpaid returning member, pending position review, and new signup.

## Spring setup after fall full-year dues

Create Spring as an upcoming term before recording full-year fall payments. The payment will cover both term IDs. In spring, generate fresh position codes because roles may have changed. Members still submit a spring position request, but covered dues are recognized automatically.

Do not copy fall permissions into spring without review. Positions are term-specific even when dues cover the full academic year.

## Points source of truth

`point_ledger` is the canonical record. Attendance, manual adjustments, approved action items, and approved point requests write entries to it. Totals are calculated from non-voided entries for the selected term; they are not copied into profile fields.

If totals ever disagree, check the ledger entries and their source IDs first. Do not manually edit multiple totals to make the screens match.

## Action-item workflow

Team tasks move through **To Do → In Progress → Submitted → Approved**. Submitted work appears in **Needs Review** for its assigner. Each assignee's progress, updates, and status history are visible in the task panel and synchronize across participants.

Assignment-time reference links are stored on the task and copied to every assignee in a grouped assignment. Use labeled links for briefs, shared files, forms, or source material; use progress-update links for evidence created while completing the work.

Use **Personal** for private tasks. Personal tasks are preserved during semester rollover. Team tasks are archived with their term.

## Semester groups

Use **Admin → Semester setup → Build semester groups** for reusable teams that are more specific than a position, such as a PM and their assigned analysts. Groups can be used in action items, announcements, calendar audiences, document sharing, and bulk point awards.

Groups belong to one semester and can contain only members approved for that semester. Recreate or revise them after each rollover rather than carrying forward outdated reporting lines.

## Point requests

Members can request points with an amount, suggested category, note, and optional private image or PDF. A member may submit proof for themselves or for one or more other members approved for the current semester. Each beneficiary receives a separate review request, and the queue records both the beneficiary and the submitting member. Administrators can approve, decline, or request more information. Approval requires a final amount and category and creates one idempotent ledger entry.

Proof files live in the private `point-request-proof` bucket. Never make this bucket public.

## Recovery and safety

- Never delete an auth user or profile as part of cleanup.
- Never rerun old cleanup SQL that deletes members.
- Prefer archiving semester-owned content.
- Treat generated position codes like passwords and deactivate old codes.
- Do not edit past published point rules or ledger history; create an adjustment or voided replacement with a note.
- If activation reports an error, stop and run the post-migration and dry-run checks. The atomic transaction rolls back automatically; diagnose the cause before retrying and do not repeatedly click Activate.

## Technical handoff checklist

The outgoing technical director should hand over:

- access to the `internal@txbosso.com` administrator account and Supabase project;
- this runbook and the current deployment procedure;
- the meaning of each position code and who receives it;
- the dues amounts and whether spring is included;
- published point minimums and category definitions;
- the date of the last verified database backup;
- any open migration, error, or access-review issue.

Keep production deployment separate from semester configuration. Review and test code locally first, apply the migration with a backup in place, then run the setup wizard from the deployed portal.
