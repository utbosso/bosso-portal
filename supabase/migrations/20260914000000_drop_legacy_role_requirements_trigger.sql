-- The old per-category points system (100/150/200 pt thresholds, 25+ per
-- category) was replaced by the term-scoped flat-total system in
-- 20260824000000_role_based_point_minimums.sql. This trigger and its
-- functions still reference the retired attendance_records/points_adjustments
-- shape and are never called by the app anymore, but the trigger is still
-- wired to profiles and fires on every role promotion.
--
-- check_role_requirements(uuid, text) can't resolve when Postgres passes the
-- user_role enum column (NEW.role) without an explicit cast, so it throws
-- "function check_role_requirements(uuid, user_role) does not exist" and
-- blocks admin approval for any member being promoted to a higher role rank
-- (e.g. general_member -> board_member).
drop trigger if exists validate_role_change_trigger on profiles;
drop function if exists validate_role_change();
drop function if exists check_role_requirements(uuid, text);
drop function if exists check_user_active_status(uuid);
