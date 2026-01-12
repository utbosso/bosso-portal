-- =====================================================
-- ADD MEMBER PROFILE FIELDS
-- =====================================================
-- This migration adds detailed member profile fields:
-- first_name, last_name, ut_eid, ut_email, phone_number
-- =====================================================

-- Add new columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS ut_eid TEXT,
ADD COLUMN IF NOT EXISTS ut_email TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_ut_eid ON profiles(ut_eid);
CREATE INDEX IF NOT EXISTS idx_profiles_ut_email ON profiles(ut_email);

-- Add unique constraint for ut_eid (should be unique per person)
ALTER TABLE profiles
ADD CONSTRAINT unique_ut_eid UNIQUE (ut_eid);

-- Update RLS policies to allow users to update their profile fields
-- (Existing policies should already allow users to update their own profile)

-- Add comment to table describing new fields
COMMENT ON COLUMN profiles.first_name IS 'User first name';
COMMENT ON COLUMN profiles.last_name IS 'User last name';
COMMENT ON COLUMN profiles.ut_eid IS 'University of Texas EID (unique identifier)';
COMMENT ON COLUMN profiles.ut_email IS 'University of Texas email address';
COMMENT ON COLUMN profiles.phone_number IS 'User phone number';
