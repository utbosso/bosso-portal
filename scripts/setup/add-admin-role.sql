-- =====================================================
-- ADD ADMIN ROLE TO THE SYSTEM - PART 1
-- =====================================================
-- This script adds the 'admin' role as the highest privilege level
-- Admins have complete oversight of all data and features

-- IMPORTANT: Run this script in TWO parts
-- Part 1: Add the enum value (THIS FILE - run first)
-- Part 2: Update user and policies (add-admin-role-part2.sql - run second)

-- Step 1: Add 'admin' to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- STOP HERE! After running this script:
-- 1. Let the transaction commit (it should complete successfully)
-- 2. Then run the second script: add-admin-role-part2.sql
