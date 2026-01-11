-- =====================================================
-- ADD EVENT CATEGORIES AND TYPES SYSTEM
-- =====================================================
-- This migration adds support for event categories and types
-- to enable the BOSSO Membership Points System
-- =====================================================

-- Step 1: Create event_category enum
DO $$ BEGIN
    CREATE TYPE event_category AS ENUM (
        'professional_development',
        'industry_engagement',
        'community_leadership',
        'org_engagement'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Create event_type enum (predefined types)
DO $$ BEGIN
    CREATE TYPE event_type AS ENUM (
        'workshop',
        'speaker_session',
        'networking_event',
        'case_competition',
        'social_event',
        'general_meeting',
        'committee_meeting',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 3: Add new columns to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS event_category event_category,
ADD COLUMN IF NOT EXISTS event_type event_type,
ADD COLUMN IF NOT EXISTS custom_event_type TEXT;

-- Step 4: Add category-based points to attendance_records
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS event_category event_category;

-- Step 5: Create function to get points breakdown by category
CREATE OR REPLACE FUNCTION get_user_points_by_category(user_uuid UUID)
RETURNS TABLE (
    category event_category,
    category_points INTEGER,
    events_attended INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ar.event_category,
        COALESCE(SUM(ar.points_earned), 0)::INTEGER as category_points,
        COUNT(ar.id)::INTEGER as events_attended
    FROM attendance_records ar
    WHERE ar.user_id = user_uuid
      AND ar.event_category IS NOT NULL
    GROUP BY ar.event_category
    ORDER BY category_points DESC;
END;
$$;

-- Step 6: Update attendance record creation to include category
-- This will be handled in the application code when checking in

-- Step 7: Create table for custom event types (for "other" types that become reusable)
CREATE TABLE IF NOT EXISTS custom_event_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name TEXT NOT NULL UNIQUE,
    default_points INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Enable RLS on custom_event_types
ALTER TABLE custom_event_types ENABLE ROW LEVEL SECURITY;

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

-- Step 8: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_category ON events(event_category);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_attendance_records_category ON attendance_records(event_category);
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_category ON attendance_records(user_id, event_category);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Run this script in your Supabase SQL editor
-- After running, update your application code to use the new fields
-- =====================================================
