-- Add New Role Types to user_role Enum
-- Run this SQL in Supabase SQL Editor

-- First, check current role types
SELECT DISTINCT role FROM profiles;

-- Add the new role types to the enum
-- This updates the user_role type to include analyst and project_manager

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'analyst';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'project_manager';

-- Verify the new roles were added
DO $$
BEGIN
    -- Check if enum values exist
    IF EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'user_role' AND e.enumlabel = 'analyst'
    ) THEN
        RAISE NOTICE 'Role "analyst" added successfully';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'user_role' AND e.enumlabel = 'project_manager'
    ) THEN
        RAISE NOTICE 'Role "project_manager" added successfully';
    END IF;
END $$;

-- Now you can add registration codes with the new roles:
-- INSERT INTO registration_codes (code, intended_role)
-- VALUES ('ANALYST-001', 'analyst');
--
-- INSERT INTO registration_codes (code, intended_role)
-- VALUES ('PM-001', 'project_manager');
