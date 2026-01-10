-- Create an admin profile for an existing Google OAuth user
-- This is useful when you've authenticated with Google but don't have a profile yet

-- Step 1: Find your user ID
SELECT
  id,
  email,
  created_at
FROM auth.users
WHERE email = 'riddhimay@utexas.edu';

-- Step 2: Copy the ID from above and paste it below
-- Then run this INSERT statement (uncomment and fill in the values)

/*
INSERT INTO profiles (id, email, full_name, role, account_status)
VALUES (
  'PASTE-YOUR-USER-ID-HERE',  -- Replace with the ID from Step 1
  'riddhimay@utexas.edu',
  'Riddhi May',  -- Your full name
  'admin',  -- Your role: 'admin', 'board_member', 'general_member', etc.
  'approved'  -- Set to 'approved' to allow immediate access
);
*/

-- Step 3: Verify the profile was created
SELECT * FROM profiles WHERE email = 'riddhimay@utexas.edu';

-- If you want to update an existing profile instead:
/*
UPDATE profiles
SET
  full_name = 'Riddhi May',
  role = 'admin',
  account_status = 'approved'
WHERE email = 'riddhimay@utexas.edu';
*/
