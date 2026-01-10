-- =====================================================
-- DATABASE CLEANUP SCRIPT
-- =====================================================
-- This script removes all data except:
-- - Internal admin account (internal@txbosso.com)
-- - Opportunities
-- - Registration codes

-- WARNING: This will permanently delete:
-- - All users except internal@txbosso.com
-- - All announcements
-- - All events
-- - All feedback submissions
-- - All attendance records
-- - All applications and their documents
-- - All tasks
-- - All learning resources
-- - All networking contacts

-- =====================================================
-- STEP 1: Verify internal admin exists
-- =====================================================
SELECT id, email, full_name, role
FROM profiles
WHERE email = 'internal@txbosso.com';

-- If you don't see the internal admin above, STOP and create it first!

-- =====================================================
-- STEP 2: Delete all data (except opportunities)
-- =====================================================

-- Delete announcements and their reads
DELETE FROM announcement_reads WHERE TRUE;
DELETE FROM announcements WHERE TRUE;

-- Delete events
DELETE FROM events WHERE TRUE;

-- Delete feedback submissions
DELETE FROM feedback_submissions WHERE TRUE;

-- Delete attendance records (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attendance_records') THEN
        DELETE FROM attendance_records WHERE TRUE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attendance_codes') THEN
        DELETE FROM attendance_codes WHERE TRUE;
    END IF;
END $$;

-- Delete applications and their documents
DELETE FROM application_documents WHERE TRUE;
DELETE FROM applications WHERE TRUE;

-- Delete tasks and notifications
DELETE FROM task_notifications WHERE TRUE;
DELETE FROM tasks WHERE TRUE;

-- Delete learning resources and saves (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'saved_resources') THEN
        DELETE FROM saved_resources WHERE TRUE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'learning_resources') THEN
        DELETE FROM learning_resources WHERE TRUE;
    END IF;
END $$;

-- Delete networking contacts
DELETE FROM networking_contacts WHERE TRUE;

-- Delete user preferences (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
        DELETE FROM user_preferences WHERE TRUE;
    END IF;
END $$;

-- =====================================================
-- STEP 3: Delete all users except internal admin
-- =====================================================

-- Get the internal admin user ID first
DO $$
DECLARE
    admin_id UUID;
BEGIN
    -- Get internal admin ID
    SELECT id INTO admin_id
    FROM profiles
    WHERE email = 'internal@txbosso.com';

    -- Delete from auth.users (all except internal admin)
    DELETE FROM auth.users
    WHERE id != admin_id;

    -- Delete from profiles (all except internal admin)
    DELETE FROM profiles
    WHERE id != admin_id;

    RAISE NOTICE 'Cleanup complete! Only internal@txbosso.com remains.';
END $$;

-- =====================================================
-- STEP 4: Verify cleanup
-- =====================================================

-- Check remaining users (should only be internal admin)
SELECT 'Users' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'Announcements', COUNT(*) FROM announcements
UNION ALL
SELECT 'Events', COUNT(*) FROM events
UNION ALL
SELECT 'Feedback', COUNT(*) FROM feedback_submissions
UNION ALL
SELECT 'Attendance Records', COUNT(*) FROM attendance_records
UNION ALL
SELECT 'Applications', COUNT(*) FROM applications
UNION ALL
SELECT 'Tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'Opportunities', COUNT(*) FROM opportunities
UNION ALL
SELECT 'Registration Codes', COUNT(*) FROM registration_codes;

-- =====================================================
-- DONE!
-- =====================================================
-- You should see:
-- - Users: 1 (internal@txbosso.com)
-- - All other counts: 0 (except Opportunities and Registration Codes)
