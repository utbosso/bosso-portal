-- =====================================================
-- BOSSO MEMBERSHIP TIER ROLE ENFORCEMENT
-- =====================================================
-- Enforces point requirements for role promotions
-- Based on BOSSO Membership Tiers, Roles & Eligibility
-- =====================================================

-- Function to check if a user meets role requirements
CREATE OR REPLACE FUNCTION check_role_requirements(
    user_uuid UUID,
    target_role TEXT
)
RETURNS TABLE (
    meets_requirements BOOLEAN,
    total_points INTEGER,
    membership_points INTEGER,
    professional_points INTEGER,
    social_points INTEGER,
    philanthropy_points INTEGER,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total INTEGER := 0;
    v_membership INTEGER := 0;
    v_professional INTEGER := 0;
    v_social INTEGER := 0;
    v_philanthropy INTEGER := 0;
    v_required_points INTEGER := 0;
    v_requires_minimums BOOLEAN := false;
    v_reason TEXT := '';
BEGIN
    -- Get points by category
    SELECT
        COALESCE(SUM(CASE WHEN event_category = 'membership' THEN points_earned ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_category = 'professional_education' THEN points_earned ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_category = 'social' THEN points_earned ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_category = 'philanthropy' THEN points_earned ELSE 0 END), 0),
        COALESCE(SUM(points_earned), 0)
    INTO v_membership, v_professional, v_social, v_philanthropy, v_total
    FROM attendance_records
    WHERE user_id = user_uuid;

    -- Add points from manual adjustments if any
    SELECT COALESCE(SUM(points), 0)
    INTO v_total
    FROM points_adjustments
    WHERE user_id = user_uuid;

    -- Define requirements based on role
    CASE target_role
        WHEN 'admin' THEN
            -- Admins have no point requirements
            v_required_points := 0;
            v_requires_minimums := false;
        WHEN 'general_member' THEN
            -- General members need 100+ points and 25+ in each category to be active
            v_required_points := 100;
            v_requires_minimums := true;
        WHEN 'analyst' THEN
            v_required_points := 150;
            v_requires_minimums := true;
        WHEN 'project_manager' THEN
            v_required_points := 200;
            v_requires_minimums := true;
        WHEN 'board_member' THEN
            v_required_points := 200;
            v_requires_minimums := true;
        ELSE
            v_required_points := 0;
            v_requires_minimums := false;
    END CASE;

    -- Check total points requirement
    IF v_total < v_required_points THEN
        v_reason := 'Need ' || v_required_points || '+ total points (currently ' || v_total || ')';

        RETURN QUERY
        SELECT
            false as meets_requirements,
            v_total as total_points,
            v_membership as membership_points,
            v_professional as professional_points,
            v_social as social_points,
            v_philanthropy as philanthropy_points,
            v_reason as reason;
        RETURN;
    END IF;

    -- Check category minimums if required
    IF v_requires_minimums THEN
        IF v_membership < 25 THEN
            v_reason := 'Need 25+ points in Membership (currently ' || v_membership || ')';

            RETURN QUERY
            SELECT
                false as meets_requirements,
                v_total as total_points,
                v_membership as membership_points,
                v_professional as professional_points,
                v_social as social_points,
                v_philanthropy as philanthropy_points,
                v_reason as reason;
            RETURN;
        END IF;

        IF v_professional < 25 THEN
            v_reason := 'Need 25+ points in Professional/Education (currently ' || v_professional || ')';

            RETURN QUERY
            SELECT
                false as meets_requirements,
                v_total as total_points,
                v_membership as membership_points,
                v_professional as professional_points,
                v_social as social_points,
                v_philanthropy as philanthropy_points,
                v_reason as reason;
            RETURN;
        END IF;

        IF v_social < 25 THEN
            v_reason := 'Need 25+ points in Social (currently ' || v_social || ')';

            RETURN QUERY
            SELECT
                false as meets_requirements,
                v_total as total_points,
                v_membership as membership_points,
                v_professional as professional_points,
                v_social as social_points,
                v_philanthropy as philanthropy_points,
                v_reason as reason;
            RETURN;
        END IF;

        IF v_philanthropy < 25 THEN
            v_reason := 'Need 25+ points in Philanthropy (currently ' || v_philanthropy || ')';

            RETURN QUERY
            SELECT
                false as meets_requirements,
                v_total as total_points,
                v_membership as membership_points,
                v_professional as professional_points,
                v_social as social_points,
                v_philanthropy as philanthropy_points,
                v_reason as reason;
            RETURN;
        END IF;
    END IF;

    -- All requirements met
    RETURN QUERY
    SELECT
        true as meets_requirements,
        v_total as total_points,
        v_membership as membership_points,
        v_professional as professional_points,
        v_social as social_points,
        v_philanthropy as philanthropy_points,
        'Meets all requirements' as reason;
END;
$$;

-- Trigger function to validate role changes
CREATE OR REPLACE FUNCTION validate_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_meets_requirements BOOLEAN;
    v_reason TEXT;
    v_old_role_rank INTEGER;
    v_new_role_rank INTEGER;
BEGIN
    -- Role hierarchy ranks
    -- Only enforce when promoting to higher roles
    v_old_role_rank := CASE OLD.role
        WHEN 'general_member' THEN 1
        WHEN 'analyst' THEN 2
        WHEN 'project_manager' THEN 3
        WHEN 'board_member' THEN 4
        WHEN 'admin' THEN 5
        ELSE 0
    END;

    v_new_role_rank := CASE NEW.role
        WHEN 'general_member' THEN 1
        WHEN 'analyst' THEN 2
        WHEN 'project_manager' THEN 3
        WHEN 'board_member' THEN 4
        WHEN 'admin' THEN 5
        ELSE 0
    END;

    -- Only validate if it's a promotion (not a demotion or lateral move)
    IF v_new_role_rank > v_old_role_rank THEN
        -- Check if user meets requirements
        SELECT meets_requirements, reason
        INTO v_meets_requirements, v_reason
        FROM check_role_requirements(NEW.id, NEW.role);

        -- If requirements not met, raise exception
        IF NOT v_meets_requirements THEN
            RAISE EXCEPTION 'Role promotion not allowed: %', v_reason;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS validate_role_change_trigger ON profiles;

-- Create trigger on profiles table
CREATE TRIGGER validate_role_change_trigger
    BEFORE UPDATE OF role ON profiles
    FOR EACH ROW
    WHEN (OLD.role IS DISTINCT FROM NEW.role)
    EXECUTE FUNCTION validate_role_change();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_role_requirements(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_role_change() TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Role requirements are now enforced:
-- - General Member: 100+ points with 25+ in each category (to be active)
-- - Analyst: 150+ points with 25+ in each category
-- - Project Manager: 200+ points with 25+ in each category
-- - Board Member: 200+ points with 25+ in each category
-- - Admin: No restrictions
--
-- The trigger will prevent role promotions that don't meet
-- point requirements, but allows demotions without restriction.
--
-- Note: General members with <100 points or missing category
-- minimums are considered "Inactive Members" but can still
-- have the general_member role.
-- =====================================================
