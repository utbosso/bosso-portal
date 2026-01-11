-- =====================================================
-- BOSSO MEMBERSHIP POINTS SYSTEM - SPRING 2026
-- =====================================================
-- This migration implements the complete BOSSO points system
-- with all categories and event types from the official document
-- =====================================================

-- Step 1: Drop old enums if they exist
DROP TYPE IF EXISTS event_category CASCADE;
DROP TYPE IF EXISTS event_type CASCADE;

-- Step 2: Create event_category enum (4 main categories)
CREATE TYPE event_category AS ENUM (
    'membership',              -- 50+ possible points
    'professional_education',  -- 100+ possible points
    'social',                  -- 75+ possible points
    'philanthropy'            -- 75+ possible points
);

-- Step 3: Create event_type enum (all specific types from document)
CREATE TYPE event_type AS ENUM (
    -- Membership Events
    'membership_profile_creation',      -- 5 points
    'on_time_dues_payment',            -- 5 points
    'resume_book_submission',          -- 5 points
    'semester_reflection',             -- 5 points
    'profit_share_participation',      -- 15 points (5 each)
    'tabling_recruitment',             -- 15 points (5 each)

    -- Professional / Education Events
    'general_meeting',                 -- 20 points (2 each)
    'workshop_attendance',             -- 10 points (1 each)
    'director_board_coffee_chat',      -- 15 points (5 each)
    'boss_attendance',                 -- 15 points
    'case_competition_participation',  -- 15 points
    'member_project_participation',    -- 25 points

    -- Social Events
    'semesterly_org_social',           -- 15 points
    'project_team_social',             -- 15 points (3 each)
    'role_based_social',               -- 20 points
    'org_wide_social',                 -- 25 points (5 each)

    -- Philanthropy Events
    'boss_volunteering_shift',         -- 10 points
    'individual_service_event',        -- 15 points (5 each)
    'bosso_service_event',             -- 20 points (5 each)
    'multi_org_service_event',         -- 30 points (15 each)

    -- Other/Custom
    'other'                            -- Custom points
);

-- Step 4: Add new columns to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS event_category event_category,
ADD COLUMN IF NOT EXISTS event_type event_type,
ADD COLUMN IF NOT EXISTS custom_event_type TEXT,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_occurrences INTEGER;

-- Step 5: Add category-based points to attendance_records
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS event_category event_category;

-- Step 6: Update the points breakdown function
DROP FUNCTION IF EXISTS get_user_points_by_category(UUID);

CREATE OR REPLACE FUNCTION get_user_points_by_category(user_uuid UUID)
RETURNS TABLE (
    category event_category,
    category_label TEXT,
    category_points INTEGER,
    events_attended INTEGER,
    max_possible_points INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ar.event_category,
        CASE ar.event_category
            WHEN 'membership' THEN 'Membership'
            WHEN 'professional_education' THEN 'Professional / Education'
            WHEN 'social' THEN 'Social'
            WHEN 'philanthropy' THEN 'Philanthropy'
        END as category_label,
        COALESCE(SUM(ar.points_earned), 0)::INTEGER as category_points,
        COUNT(ar.id)::INTEGER as events_attended,
        CASE ar.event_category
            WHEN 'membership' THEN 50
            WHEN 'professional_education' THEN 100
            WHEN 'social' THEN 75
            WHEN 'philanthropy' THEN 75
        END as max_possible_points
    FROM attendance_records ar
    WHERE ar.user_id = user_uuid
      AND ar.event_category IS NOT NULL
    GROUP BY ar.event_category
    ORDER BY category_points DESC;
END;
$$;

-- Step 7: Create function to check if user meets minimum requirements
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

    -- Add points from manual adjustments
    SELECT COALESCE(SUM(points), 0)
    INTO v_total
    FROM points_adjustments
    WHERE user_id = user_uuid;

    -- Check if meets minimum: 100+ total AND 25+ in each category
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

-- Step 8: Create table for event type metadata (default points)
CREATE TABLE IF NOT EXISTS event_type_metadata (
    event_type event_type PRIMARY KEY,
    default_points INTEGER NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    category event_category NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    max_per_semester INTEGER
);

-- Step 9: Populate event type metadata with default values
INSERT INTO event_type_metadata (event_type, default_points, display_name, description, category, is_recurring, max_per_semester) VALUES
    -- Membership
    ('membership_profile_creation', 5, 'Membership Profile Creation', 'Complete your BOSSO member profile', 'membership', false, 1),
    ('on_time_dues_payment', 5, 'On-Time Dues Payment', 'Pay semester dues by deadline', 'membership', false, 1),
    ('resume_book_submission', 5, 'Resume Book Submission', 'Submit resume for BOSSO resume book', 'membership', false, 1),
    ('semester_reflection', 5, 'Semester Reflection (Role-Based)', 'Complete end-of-semester reflection', 'membership', false, 1),
    ('profit_share_participation', 3, 'Profit Share Participation', 'Participate in profit share event', 'membership', true, 5),
    ('tabling_recruitment', 3, 'Tabling / Recruitment Help', 'Help with org tabling or recruitment', 'membership', true, 5),

    -- Professional / Education
    ('general_meeting', 2, 'General Meeting', 'Attend BOSSO general meeting', 'professional_education', true, 10),
    ('workshop_attendance', 10, 'Workshop Attendance', 'Attend professional development workshop', 'professional_education', true, null),
    ('director_board_coffee_chat', 5, 'Director / Board Coffee Chat', 'Meet with a director or board member', 'professional_education', true, 3),
    ('boss_attendance', 15, 'BOSS Conference Attendance', 'Attend BOSS Conference', 'professional_education', false, 1),
    ('case_competition_participation', 15, 'Case Competition Participation', 'Participate in case competition', 'professional_education', true, null),
    ('member_project_participation', 25, 'Member Project Participation', 'Contribute to a BOSSO project', 'professional_education', true, null),

    -- Social
    ('semesterly_org_social', 15, 'Semesterly Org-Wide Social Event', 'Attend semester-wide social event', 'social', false, 1),
    ('project_team_social', 5, 'Project Team Social Event', 'Attend project team social', 'social', true, 3),
    ('role_based_social', 20, 'Role-Based Social Event', 'Attend role-specific social event', 'social', true, null),
    ('org_wide_social', 5, 'Org-Wide Social Event', 'Attend organization-wide social', 'social', true, 5),

    -- Philanthropy
    ('boss_volunteering_shift', 10, 'BOSS Volunteering Shift', 'Volunteer at BOSS Conference', 'philanthropy', true, null),
    ('individual_service_event', 5, 'Individual Service Event', 'Participate in individual service', 'philanthropy', true, 3),
    ('bosso_service_event', 5, 'BOSSO Service Event', 'Participate in BOSSO service event', 'philanthropy', true, 4),
    ('multi_org_service_event', 15, 'Multi-Org Service Event', 'Participate in multi-org service', 'philanthropy', true, 2),

    -- Other
    ('other', 0, 'Other', 'Custom event type', 'membership', false, null)
ON CONFLICT (event_type) DO UPDATE SET
    default_points = EXCLUDED.default_points,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_recurring = EXCLUDED.is_recurring,
    max_per_semester = EXCLUDED.max_per_semester;

-- Step 10: Create table for custom event types (user-created)
CREATE TABLE IF NOT EXISTS custom_event_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name TEXT NOT NULL UNIQUE,
    default_points INTEGER NOT NULL,
    category event_category NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Enable RLS on custom_event_types
ALTER TABLE custom_event_types ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view custom event types" ON custom_event_types;
DROP POLICY IF EXISTS "Admins can create custom event types" ON custom_event_types;

-- Policy: Everyone can view custom event types
CREATE POLICY "Anyone can view custom event types"
    ON custom_event_types
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Only admins can create custom event types
CREATE POLICY "Admins can create custom event types"
    ON custom_event_types
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Step 11: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_category ON events(event_category);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_attendance_records_category ON attendance_records(event_category);
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_category ON attendance_records(user_id, event_category);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- The BOSSO Membership Points System is now ready!
--
-- Key Features:
-- - 4 main categories (Membership, Professional/Education, Social, Philanthropy)
-- - 20+ predefined event types with default points
-- - Minimum requirement tracking (100+ total, 25+ per category)
-- - Category-based points breakdown
-- - Custom event types support
--
-- Next Steps:
-- 1. Update event creation form to use new categories/types
-- 2. Add UI to show points breakdown by category
-- 3. Add active status indicator based on minimums
-- =====================================================
