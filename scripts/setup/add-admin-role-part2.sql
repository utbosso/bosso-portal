-- =====================================================
-- ADD ADMIN ROLE TO THE SYSTEM - PART 2
-- =====================================================
-- Run this AFTER running add-admin-role.sql (Part 1)

-- Step 2: Set your master account to admin role
UPDATE profiles
SET role = 'admin'
WHERE email = 'riddhimay@utexas.edu';

-- =====================================================
-- UPDATE ALL RLS POLICIES TO INCLUDE ADMIN ACCESS
-- =====================================================

-- ANNOUNCEMENTS: Admins can do everything
DROP POLICY IF EXISTS "Admins can do everything with announcements" ON announcements;
CREATE POLICY "Admins can do everything with announcements"
  ON announcements
  FOR ALL
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

-- EVENTS: Admins can do everything
DROP POLICY IF EXISTS "Admins can do everything with events" ON events;
CREATE POLICY "Admins can do everything with events"
  ON events
  FOR ALL
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

-- DOCUMENTS: Admins can view and manage all documents
DROP POLICY IF EXISTS "Admins can do everything with documents" ON documents;
CREATE POLICY "Admins can do everything with documents"
  ON documents
  FOR ALL
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

-- TASKS: Admins can view and manage all tasks
DROP POLICY IF EXISTS "Admins can do everything with tasks" ON tasks;
CREATE POLICY "Admins can do everything with tasks"
  ON tasks
  FOR ALL
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

-- OPPORTUNITIES: Admins can view and manage all opportunities
DROP POLICY IF EXISTS "Admins can do everything with opportunities" ON opportunities;
CREATE POLICY "Admins can do everything with opportunities"
  ON opportunities
  FOR ALL
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

-- APPLICATIONS: Admins can view all user applications (oversight only)
DROP POLICY IF EXISTS "Admins can view all applications" ON applications;
CREATE POLICY "Admins can view all applications"
  ON applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- APPLICATION DOCUMENTS: Admins can view all application documents
DROP POLICY IF EXISTS "Admins can view all application documents" ON application_documents;
CREATE POLICY "Admins can view all application documents"
  ON application_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- LEARNING RESOURCES: Admins can do everything
DROP POLICY IF EXISTS "Admins can do everything with learning resources" ON learning_resources;
CREATE POLICY "Admins can do everything with learning resources"
  ON learning_resources
  FOR ALL
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

-- NETWORKING CONTACTS: Admins can view all contacts
DROP POLICY IF EXISTS "Admins can view all networking contacts" ON networking_contacts;
CREATE POLICY "Admins can view all networking contacts"
  ON networking_contacts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- FEEDBACK SUBMISSIONS: ADMIN-ONLY ACCESS
-- =====================================================
-- Drop the old board_member policy and replace with admin-only

DROP POLICY IF EXISTS "Board members can view all feedback" ON feedback_submissions;
DROP POLICY IF EXISTS "Board members can update feedback" ON feedback_submissions;

-- Policy: ONLY Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
  ON feedback_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR submitted_by = auth.uid()
  );

-- Policy: ONLY Admins can update feedback (status and notes)
CREATE POLICY "Admins can update feedback"
  ON feedback_submissions
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

-- =====================================================
-- PROFILES: Admins can view and update all profiles
-- =====================================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
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
    OR profiles.id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles"
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

-- =====================================================
-- STORAGE: Admins can view all uploaded files
-- =====================================================
CREATE POLICY "Admins can view all storage objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
