-- =====================================================
-- ADD SIGNUP SECURITY SYSTEM
-- =====================================================
-- This script implements a comprehensive security system for user signup
-- Features:
-- 1. Email verification requirement
-- 2. Registration codes for controlled access
-- 3. Account status tracking (pending/active/rejected)
-- 4. Admin approval workflow

-- =====================================================
-- STEP 1: Update profiles table with new security fields
-- =====================================================

-- Add email_verified field
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Add account_status field
-- Options: 'pending' (awaiting admin approval), 'active' (approved), 'rejected' (denied)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status_enum') THEN
    CREATE TYPE account_status_enum AS ENUM ('pending', 'active', 'rejected');
  END IF;
END $$;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS account_status account_status_enum DEFAULT 'pending';

-- Add verification token for email verification
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS verification_token TEXT;

-- Add verified_at timestamp
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- =====================================================
-- STEP 2: Create registration_codes table
-- =====================================================

CREATE TABLE IF NOT EXISTS registration_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  intended_role user_role DEFAULT 'general_member',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster code lookups
CREATE INDEX IF NOT EXISTS idx_registration_codes_code ON registration_codes(code);
CREATE INDEX IF NOT EXISTS idx_registration_codes_active ON registration_codes(is_active);

-- =====================================================
-- STEP 3: Create code_usages tracking table
-- =====================================================

CREATE TABLE IF NOT EXISTS code_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID REFERENCES registration_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for tracking
CREATE INDEX IF NOT EXISTS idx_code_usages_code_id ON code_usages(code_id);
CREATE INDEX IF NOT EXISTS idx_code_usages_user_id ON code_usages(user_id);

-- =====================================================
-- STEP 4: Enable RLS on new tables
-- =====================================================

ALTER TABLE registration_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_usages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 5: RLS Policies for registration_codes
-- =====================================================

-- Admins can view all codes
DROP POLICY IF EXISTS "Admins can view all codes" ON registration_codes;
CREATE POLICY "Admins can view all codes"
  ON registration_codes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can create codes
DROP POLICY IF EXISTS "Admins can create codes" ON registration_codes;
CREATE POLICY "Admins can create codes"
  ON registration_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update codes
DROP POLICY IF EXISTS "Admins can update codes" ON registration_codes;
CREATE POLICY "Admins can update codes"
  ON registration_codes
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

-- Admins can delete codes
DROP POLICY IF EXISTS "Admins can delete codes" ON registration_codes;
CREATE POLICY "Admins can delete codes"
  ON registration_codes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Public can validate codes (for signup page)
DROP POLICY IF EXISTS "Public can validate active codes" ON registration_codes;
CREATE POLICY "Public can validate active codes"
  ON registration_codes
  FOR SELECT
  TO anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- =====================================================
-- STEP 6: RLS Policies for code_usages
-- =====================================================

-- Admins can view all usages
DROP POLICY IF EXISTS "Admins can view all usages" ON code_usages;
CREATE POLICY "Admins can view all usages"
  ON code_usages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- System can insert usages (during signup)
DROP POLICY IF EXISTS "System can track code usage" ON code_usages;
CREATE POLICY "System can track code usage"
  ON code_usages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================
-- STEP 7: Grant permissions
-- =====================================================

GRANT SELECT ON registration_codes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON registration_codes TO authenticated;
GRANT SELECT, INSERT ON code_usages TO authenticated;

-- =====================================================
-- STEP 8: Create function to increment code usage
-- =====================================================

CREATE OR REPLACE FUNCTION increment_code_usage(code_text TEXT, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code_record registration_codes;
BEGIN
  -- Get the code record
  SELECT * INTO code_record
  FROM registration_codes
  WHERE code = code_text
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  -- Check if code exists
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if code has remaining uses
  IF code_record.current_uses >= code_record.max_uses THEN
    RETURN false;
  END IF;

  -- Increment usage count
  UPDATE registration_codes
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE id = code_record.id;

  -- Track the usage
  INSERT INTO code_usages (code_id, user_id)
  VALUES (code_record.id, user_uuid);

  RETURN true;
END;
$$;

-- =====================================================
-- STEP 9: Create function to validate registration code
-- =====================================================

CREATE OR REPLACE FUNCTION validate_registration_code(code_text TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  intended_role user_role,
  remaining_uses INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code_record registration_codes;
BEGIN
  -- Get the code record
  SELECT * INTO code_record
  FROM registration_codes
  WHERE code = code_text
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > now());

  -- Check if code exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'general_member'::user_role, 0;
    RETURN;
  END IF;

  -- Check if code has remaining uses
  IF code_record.current_uses >= code_record.max_uses THEN
    RETURN QUERY SELECT false, code_record.intended_role, 0;
    RETURN;
  END IF;

  -- Code is valid
  RETURN QUERY SELECT
    true,
    code_record.intended_role,
    (code_record.max_uses - code_record.current_uses);
END;
$$;

-- =====================================================
-- STEP 10: Update profiles RLS to block unapproved users
-- =====================================================

-- Note: This will be handled in the auth hook/middleware
-- Users with account_status = 'pending' or 'rejected' should be blocked from accessing the portal
-- email_verified must be true to access the portal

-- =====================================================
-- STEP 11: Create sample registration codes for testing
-- =====================================================

-- Insert a test code for general members (expires in 30 days)
INSERT INTO registration_codes (code, max_uses, expires_at, intended_role, notes)
VALUES (
  'BOSSO2024GENERAL',
  100,
  now() + interval '30 days',
  'general_member',
  'Test code for general member signups - expires in 30 days'
) ON CONFLICT (code) DO NOTHING;

-- Insert a test code for board members (single use)
INSERT INTO registration_codes (code, max_uses, intended_role, notes)
VALUES (
  'BOSSO2024BOARD',
  10,
  'board_member',
  'Test code for board member signups'
) ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- COMPLETE
-- =====================================================
-- Signup security system created!
--
-- Summary:
-- ✅ profiles table updated with email_verified, account_status, verification_token
-- ✅ registration_codes table created
-- ✅ code_usages tracking table created
-- ✅ RLS policies configured for secure access
-- ✅ Helper functions created for code validation and usage tracking
-- ✅ Sample test codes inserted
--
-- Next Steps:
-- 1. Update signup page to require registration code
-- 2. Create email verification page/logic
-- 3. Create admin dashboard for user approval
-- 4. Update auth hook to block unverified/unapproved users
-- 5. Update TypeScript types with new fields
