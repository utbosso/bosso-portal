-- =====================================================
-- ENABLE RLS ON PROFILES TABLE
-- =====================================================
-- This script enables Row Level Security on the profiles table
-- and creates policies to secure user data
-- Safe to run multiple times

-- =====================================================
-- Step 1: Enable Row Level Security
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Step 2: Drop Existing Policies (if any)
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile on signup" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON profiles;

-- =====================================================
-- Step 3: Create RLS Policies
-- =====================================================

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy: Users can insert their own profile during signup
-- This allows the profile to be created when a new user signs up
CREATE POLICY "Users can insert own profile on signup"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can update any profile (e.g., change roles)
CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Authenticated users can view basic info of other users
-- This is needed for features like:
-- - Viewing event creators
-- - Viewing task assigners/assignees
-- - Viewing announcement authors
-- - Viewing document creators
-- - Member directory/lists
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- Step 4: Grant Necessary Permissions
-- =====================================================

-- Revoke all public access to profiles
REVOKE ALL ON profiles FROM PUBLIC;
REVOKE ALL ON profiles FROM anon;

-- Grant specific permissions to authenticated users
GRANT SELECT ON profiles TO authenticated;
GRANT INSERT ON profiles TO authenticated;
GRANT UPDATE ON profiles TO authenticated;

-- Note: DELETE is not granted - profiles should not be deleted directly
-- Instead, implement soft delete or handle through Supabase Auth

-- =====================================================
-- COMPLETE
-- =====================================================
-- Row Level Security is now enabled on profiles table!
--
-- Security Summary:
-- ✅ Users can view and update their own profile
-- ✅ Users can create their profile on signup
-- ✅ Admins can view and update all profiles
-- ✅ Authenticated users can view other users' basic info (needed for app features)
-- ✅ Anonymous users have no access
-- ✅ Profile deletion is restricted
--
-- The "Public profiles are viewable by authenticated users" policy
-- allows the app to function properly (show event creators, task assignees, etc.)
-- while still protecting against anonymous/unauthenticated access.
