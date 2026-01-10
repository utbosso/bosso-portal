-- =====================================================
-- ATTENDANCE AND POINTS SYSTEM
-- =====================================================
-- This script adds attendance tracking and points system to BOSSO portal
-- Run this script in Supabase SQL Editor

-- Step 1: Add attendance tracking fields to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS track_attendance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS point_value INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS attendance_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS code_expires_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id) -- Prevent duplicate check-ins
);

-- Step 3: Create points_adjustments table (for manual admin adjustments)
CREATE TABLE IF NOT EXISTS points_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  adjusted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL, -- Can be positive or negative
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_records_event ON attendance_records(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_user ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_points_adjustments_user ON points_adjustments(user_id);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_adjustments ENABLE ROW LEVEL SECURITY;

-- ATTENDANCE RECORDS POLICIES

-- Policy: Users can view their own attendance records
CREATE POLICY "Users can view own attendance records"
  ON attendance_records
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can insert their own attendance (check-in)
CREATE POLICY "Users can check in to events"
  ON attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Admins can view all attendance records
CREATE POLICY "Admins can view all attendance records"
  ON attendance_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can insert attendance records (manual check-in)
CREATE POLICY "Admins can manually check in users"
  ON attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can delete attendance records (undo check-in)
CREATE POLICY "Admins can delete attendance records"
  ON attendance_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- POINTS ADJUSTMENTS POLICIES

-- Policy: Users can view their own points adjustments
CREATE POLICY "Users can view own points adjustments"
  ON points_adjustments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Admins can view all points adjustments
CREATE POLICY "Admins can view all points adjustments"
  ON points_adjustments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can create points adjustments
CREATE POLICY "Admins can create points adjustments"
  ON points_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get total points for a user
CREATE OR REPLACE FUNCTION get_user_total_points(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attendance_points INTEGER;
  adjustment_points INTEGER;
  total INTEGER;
BEGIN
  -- Sum points from attendance records
  SELECT COALESCE(SUM(points_earned), 0)
  INTO attendance_points
  FROM attendance_records
  WHERE user_id = user_uuid;

  -- Sum points from manual adjustments
  SELECT COALESCE(SUM(points), 0)
  INTO adjustment_points
  FROM points_adjustments
  WHERE user_id = user_uuid;

  total := attendance_points + adjustment_points;

  RETURN total;
END;
$$;

-- Function: Get attendance count for a user
CREATE OR REPLACE FUNCTION get_user_attendance_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO count
  FROM attendance_records
  WHERE user_id = user_uuid;

  RETURN count;
END;
$$;

-- Function: Get event attendance count
CREATE OR REPLACE FUNCTION get_event_attendance_count(event_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO count
  FROM attendance_records
  WHERE event_id = event_uuid;

  RETURN count;
END;
$$;

-- =====================================================
-- COMPLETE
-- =====================================================
-- Attendance system database setup complete!
-- Next steps:
-- 1. Update TypeScript types
-- 2. Update calendar page with attendance fields
-- 3. Create attendance page
