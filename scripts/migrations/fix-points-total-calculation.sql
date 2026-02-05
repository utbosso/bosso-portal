-- =====================================================
-- FIX: POINT TOTALS IN STATUS/REQUIREMENTS FUNCTIONS
-- =====================================================
-- Previous versions overwrote attendance totals with adjustment totals.
-- This patch ensures manual adjustments are ADDED to attendance totals.
-- =====================================================

CREATE OR REPLACE FUNCTION check_user_active_status(user_uuid UUID)
RETURNS TABLE (
    is_active BOOLEAN,
    total_points INTEGER,
    membership_points INTEGER,
    professional_points INTEGER,
    social_points INTEGER,
    philanthropy_points INTEGER,
    meets_minimum BOOLEAN
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
    v_meets_min BOOLEAN := false;
    v_adjustments INTEGER := 0;
    v_adj_membership INTEGER := 0;
    v_adj_professional INTEGER := 0;
    v_adj_social INTEGER := 0;
    v_adj_philanthropy INTEGER := 0;
BEGIN
    SELECT
        COALESCE(SUM(CASE WHEN event_category = 'membership' THEN points_earned ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_category = 'professional_education' THEN points_earned ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_category = 'social' THEN points_earned ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_category = 'philanthropy' THEN points_earned ELSE 0 END), 0),
        COALESCE(SUM(points_earned), 0)
    INTO v_membership, v_professional, v_social, v_philanthropy, v_total
    FROM attendance_records
    WHERE user_id = user_uuid;

    SELECT
        COALESCE(SUM(points), 0),
        COALESCE(SUM(CASE WHEN reason ILIKE '%(membership)%' THEN points ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN reason ILIKE '%(professional_education)%' THEN points ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN reason ILIKE '%(social)%' THEN points ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN reason ILIKE '%(philanthropy)%' THEN points ELSE 0 END), 0)
    INTO v_adjustments, v_adj_membership, v_adj_professional, v_adj_social, v_adj_philanthropy
    FROM points_adjustments
    WHERE user_id = user_uuid;

    v_total := v_total + v_adjustments;
    v_membership := v_membership + v_adj_membership;
    v_professional := v_professional + v_adj_professional;
    v_social := v_social + v_adj_social;
    v_philanthropy := v_philanthropy + v_adj_philanthropy;

    v_meets_min := (v_total >= 100) AND
                   (v_membership >= 25) AND
                   (v_professional >= 25) AND
                   (v_social >= 25) AND
                   (v_philanthropy >= 25);

    RETURN QUERY
    SELECT
        v_meets_min as is_active,
        v_total as total_points,
        v_membership as membership_points,
        v_professional as professional_points,
        v_social as social_points,
        v_philanthropy as philanthropy_points,
        v_meets_min as meets_minimum;
END;
$$;

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
    v_adjustments INTEGER := 0;
    v_adj_membership INTEGER := 0;
    v_adj_professional INTEGER := 0;
    v_adj_social INTEGER := 0;
    v_adj_philanthropy INTEGER := 0;
BEGIN
    SELECT
        COALESCE(SUM(CASE WHEN event_category = 'membership' THEN points_earned ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_category = 'professional_education' THEN points_earned ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_category = 'social' THEN points_earned ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_category = 'philanthropy' THEN points_earned ELSE 0 END), 0),
        COALESCE(SUM(points_earned), 0)
    INTO v_membership, v_professional, v_social, v_philanthropy, v_total
    FROM attendance_records
    WHERE user_id = user_uuid;

    SELECT
        COALESCE(SUM(points), 0),
        COALESCE(SUM(CASE WHEN reason ILIKE '%(membership)%' THEN points ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN reason ILIKE '%(professional_education)%' THEN points ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN reason ILIKE '%(social)%' THEN points ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN reason ILIKE '%(philanthropy)%' THEN points ELSE 0 END), 0)
    INTO v_adjustments, v_adj_membership, v_adj_professional, v_adj_social, v_adj_philanthropy
    FROM points_adjustments
    WHERE user_id = user_uuid;

    v_total := v_total + v_adjustments;
    v_membership := v_membership + v_adj_membership;
    v_professional := v_professional + v_adj_professional;
    v_social := v_social + v_adj_social;
    v_philanthropy := v_philanthropy + v_adj_philanthropy;

    CASE target_role
        WHEN 'admin' THEN
            v_required_points := 0;
            v_requires_minimums := false;
        WHEN 'general_member' THEN
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

    IF v_total < v_required_points THEN
        v_reason := 'Need ' || v_required_points || '+ total points (currently ' || v_total || ')';
        RETURN QUERY
        SELECT false, v_total, v_membership, v_professional, v_social, v_philanthropy, v_reason;
        RETURN;
    END IF;

    IF v_requires_minimums THEN
        IF v_membership < 25 THEN
            v_reason := 'Need 25+ points in Membership (currently ' || v_membership || ')';
            RETURN QUERY
            SELECT false, v_total, v_membership, v_professional, v_social, v_philanthropy, v_reason;
            RETURN;
        END IF;

        IF v_professional < 25 THEN
            v_reason := 'Need 25+ points in Professional/Education (currently ' || v_professional || ')';
            RETURN QUERY
            SELECT false, v_total, v_membership, v_professional, v_social, v_philanthropy, v_reason;
            RETURN;
        END IF;

        IF v_social < 25 THEN
            v_reason := 'Need 25+ points in Social (currently ' || v_social || ')';
            RETURN QUERY
            SELECT false, v_total, v_membership, v_professional, v_social, v_philanthropy, v_reason;
            RETURN;
        END IF;

        IF v_philanthropy < 25 THEN
            v_reason := 'Need 25+ points in Philanthropy (currently ' || v_philanthropy || ')';
            RETURN QUERY
            SELECT false, v_total, v_membership, v_professional, v_social, v_philanthropy, v_reason;
            RETURN;
        END IF;
    END IF;

    RETURN QUERY
    SELECT true, v_total, v_membership, v_professional, v_social, v_philanthropy, 'Meets all requirements';
END;
$$;
