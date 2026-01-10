-- Add Registration Codes Manually
-- Run this SQL in Supabase SQL Editor to add codes
-- max_uses defaults to 1 (single-use) if not specified

-- GENERAL MEMBER CODES
INSERT INTO registration_codes (code, intended_role)
VALUES
  ('GM-CODE-1', 'general_member'),
  ('GM-CODE-2', 'general_member');

-- ANALYST CODES
INSERT INTO registration_codes (code, intended_role)
VALUES
  ('ANALYST-CODE-1', 'analyst'),
  ('ANALYST-CODE-2', 'analyst');

-- PROJECT MANAGER CODES
INSERT INTO registration_codes (code, intended_role)
VALUES
  ('PM-CODE-1', 'project_manager'),
  ('PM-CODE-2', 'project_manager');

-- BOARD MEMBER CODES
INSERT INTO registration_codes (code, intended_role)
VALUES
  ('BOARD-CODE-1', 'board_member'),
  ('BOARD-CODE-2', 'board_member');

-- ADMIN CODES
INSERT INTO registration_codes (code, intended_role)
VALUES
  ('ADMIN-CODE-1', 'admin');

-- EXAMPLE USAGE:
-- Replace the codes above with your own like:
-- ('BOSSO2024', 'general_member'),
-- ('ANALYST2024', 'analyst'),
-- ('PM2024', 'project_manager'),
-- ('BOARD2024', 'board_member'),
-- ('ADMIN2024', 'admin');

-- MULTI-USE CODE EXAMPLE (only if you want multi-use):
-- ('SPRING2024', 'general_member', 50);

-- ROLE OPTIONS:
-- 'general_member'    - Basic access to portal
-- 'analyst'           - Analyst-specific access
-- 'project_manager'   - Project management access
-- 'board_member'      - Board member privileges
-- 'admin'             - Full administrative access

-- To view all codes:
-- SELECT * FROM registration_codes ORDER BY created_at DESC;

-- To delete a code:
-- DELETE FROM registration_codes WHERE code = 'CODE-TO-DELETE';
