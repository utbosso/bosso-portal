-- =====================================================
-- CREATE INTERNAL ADMIN ACCOUNT
-- =====================================================
-- This script creates a special registration code for the internal@txbosso.com admin account
-- This is the ONLY non-@utexas.edu account allowed in the system

-- Step 1: Create a special registration code for internal admin
-- This code is single-use and set to admin role
INSERT INTO registration_codes (
  code,
  created_by,
  max_uses,
  current_uses,
  expires_at,
  is_active,
  intended_role,
  notes
) VALUES (
  'BOSSO_INTERNAL_ADMIN_2025',  -- This is the code you'll use to sign up
  NULL,                          -- No creator (system-generated)
  1,                             -- Single use only
  0,                             -- Not used yet
  NULL,                          -- Never expires
  true,                          -- Active
  'admin',                       -- Admin role
  'Internal admin account for internal@txbosso.com - DO NOT DELETE'
);

-- After running this script:
-- 1. Go to /signup on your portal
-- 2. Use registration code: BOSSO_INTERNAL_ADMIN_2025
-- 3. Sign up with email: internal@txbosso.com
-- 4. Choose a strong password (you'll need this to log in)
-- 5. Verify the email (use the "Send Verification Email" button)
-- 6. Admin will need to approve the account (use your current admin account)
-- 7. Once approved, log in as internal@txbosso.com to verify it works

-- =====================================================
-- AFTER CONFIRMING INTERNAL ACCOUNT WORKS:
-- =====================================================
-- Run this to delete the old admin account (riddhimay@utexas.edu)
-- ONLY RUN THIS AFTER YOU'VE CONFIRMED THE INTERNAL ACCOUNT IS WORKING!

-- STEP 1: Uncomment and run this query to check the user ID first:
-- SELECT id, email, full_name, role FROM profiles WHERE email = 'riddhimay@utexas.edu';

-- STEP 2: Once you confirm internal@txbosso.com is working, uncomment and run:
-- DELETE FROM profiles WHERE email = 'riddhimay@utexas.edu';
-- DELETE FROM auth.users WHERE email = 'riddhimay@utexas.edu';
