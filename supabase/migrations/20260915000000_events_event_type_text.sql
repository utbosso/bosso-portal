-- events.event_type and events.event_category (plus attendance_records.event_category)
-- were left as native Postgres ENUM types from the original Spring 2026 points
-- system (scripts/migrations/add-bosso-points-system.sql). The Fall 2026 points
-- overhaul (src/lib/bosso-points.ts) added five new event types -
-- weekly_project_meeting, minor_social, major_social, philanthropy_event,
-- org_wide_volunteering - to the app's EventType union, but nothing updated the
-- underlying enum. Selecting any of those five in Admin > Calendar and saving an
-- event with attendance tracking on throws a Postgres
-- "invalid input value for enum event_type" error, which the client's catch-all
-- (src/app/calendar/page.tsx) shows as the misleading "Failed to save event.
-- You may not have permission."
--
-- Every other term-scoped table added this semester (point_ledger,
-- member_term_memberships, dues_prices, ...) already uses text + a check
-- constraint instead of a native enum specifically to avoid this class of bug -
-- adding a new category/type is then a plain UPDATE, not a schema migration.
-- Converting these columns to match, rather than just adding the five missing
-- enum labels, fixes the immediate bug and prevents the same failure the next
-- time the point system's event types change.

-- event_type_metadata and custom_event_types are leftover tables from the same
-- original migration (event_type_metadata PK'd on the enum, custom_event_types
-- referencing it too) and are not read or written anywhere in the app - the
-- current event type catalog lives entirely in src/lib/bosso-points.ts. Drop
-- them first so nothing but events.event_type/event_category and
-- attendance_records.event_category still depends on the enum types below.
drop table if exists public.event_type_metadata;
drop table if exists public.custom_event_types;
-- Also unused anywhere in the app (only referenced from these same legacy
-- scripts) - its return type is what actually blocks dropping event_category.
drop function if exists public.get_user_points_by_category(uuid);

alter table public.events
  alter column event_category type text using event_category::text,
  alter column event_type type text using event_type::text;

alter table public.attendance_records
  alter column event_category type text using event_category::text;

alter table public.events
  drop constraint if exists events_event_category_check,
  drop constraint if exists events_event_type_check;

alter table public.events
  add constraint events_event_category_check
    check (event_category is null or event_category in ('membership', 'professional_education', 'social', 'philanthropy')),
  add constraint events_event_type_check
    check (event_type is null or event_type in (
      'general_meeting', 'workshop_attendance', 'weekly_project_meeting', 'minor_social',
      'major_social', 'philanthropy_event', 'org_wide_volunteering', 'other',
      'membership_profile_creation', 'on_time_dues_payment', 'resume_book_submission',
      'semester_reflection', 'profit_share_participation', 'tabling_recruitment',
      'director_board_coffee_chat', 'boss_attendance', 'case_competition_participation',
      'member_project_participation', 'semesterly_org_social', 'project_team_social',
      'role_based_social', 'org_wide_social', 'boss_volunteering_shift',
      'individual_service_event', 'bosso_service_event', 'multi_org_service_event'
    ));

alter table public.attendance_records
  drop constraint if exists attendance_records_event_category_check;

alter table public.attendance_records
  add constraint attendance_records_event_category_check
    check (event_category is null or event_category in ('membership', 'professional_education', 'social', 'philanthropy'));

drop type if exists event_category;
drop type if exists event_type;
