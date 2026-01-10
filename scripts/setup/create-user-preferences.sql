-- =====================================================
-- CREATE USER PREFERENCES TABLE
-- =====================================================
-- This script creates a table to store user preferences
-- including notification settings and other customizations

-- Create the user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  task_reminders BOOLEAN DEFAULT true,
  event_reminders BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences"
  ON user_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can insert their own preferences
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences"
  ON user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own preferences
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences"
  ON user_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Admins can view all preferences
DROP POLICY IF EXISTS "Admins can view all preferences" ON user_preferences;
CREATE POLICY "Admins can view all preferences"
  ON user_preferences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_preferences TO authenticated;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- =====================================================
-- COMPLETE
-- =====================================================
-- User preferences table created!
--
-- Summary:
-- ✅ user_preferences table created
-- ✅ RLS policies configured
-- ✅ Users can manage their own preferences
-- ✅ Admins can view all preferences
