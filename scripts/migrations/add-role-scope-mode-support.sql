-- Add support for exact-role targeting (e.g., "Analysts only")
-- while preserving existing minimum-role targeting (e.g., "Analysts and above").

ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS role_scope_mode TEXT
CHECK (role_scope_mode IN ('minimum_role', 'exact_role'));

ALTER TABLE events
ADD COLUMN IF NOT EXISTS audience_scope_mode TEXT
CHECK (audience_scope_mode IN ('minimum_role', 'exact_role'));

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS role_scope_mode TEXT
CHECK (role_scope_mode IN ('minimum_role', 'exact_role'));

ALTER TABLE learning_resources
ADD COLUMN IF NOT EXISTS role_scope_mode TEXT
CHECK (role_scope_mode IN ('minimum_role', 'exact_role'));

UPDATE announcements
SET role_scope_mode = COALESCE(role_scope_mode, 'minimum_role')
WHERE role_scope IS NOT NULL;

UPDATE events
SET audience_scope_mode = COALESCE(audience_scope_mode, 'minimum_role')
WHERE audience_scope IS NOT NULL;

UPDATE documents
SET role_scope_mode = COALESCE(role_scope_mode, 'minimum_role')
WHERE role_scope IS NOT NULL;

UPDATE learning_resources
SET role_scope_mode = COALESCE(role_scope_mode, 'minimum_role')
WHERE role_scope IS NOT NULL;

DROP POLICY IF EXISTS "Users can view resources based on role scope" ON learning_resources;
CREATE POLICY "Users can view resources based on role scope"
  ON learning_resources
  FOR SELECT
  USING (
    role_scope IS NULL OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        (
          COALESCE(role_scope_mode, 'minimum_role') = 'exact_role'
          AND profiles.role = role_scope::user_role
        )
        OR
        (
          COALESCE(role_scope_mode, 'minimum_role') <> 'exact_role'
          AND (
            role_scope = 'general_member' OR
            (role_scope = 'analyst' AND profiles.role IN ('analyst', 'project_manager', 'board_member', 'admin')) OR
            (role_scope = 'project_manager' AND profiles.role IN ('project_manager', 'board_member', 'admin')) OR
            (role_scope = 'board_member' AND profiles.role IN ('board_member', 'admin'))
          )
        )
      )
    )
  );
