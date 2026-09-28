-- One-time data collection (school/college, class standing, major, minor)
-- gated on the member's own profile - deliberately just plain columns, not
-- a whole new table/term-scoped system, since this is a temporary survey,
-- not a permanent feature.
alter table public.profiles
  add column if not exists demographics_schools text[],
  add column if not exists demographics_class_standing text
    check (demographics_class_standing in ('freshman', 'sophomore', 'junior', 'senior')),
  add column if not exists demographics_major text,
  add column if not exists demographics_has_minor boolean,
  add column if not exists demographics_minor text,
  add column if not exists demographics_completed_at timestamptz;
