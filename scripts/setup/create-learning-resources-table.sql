-- Create learning_resources table
CREATE TABLE IF NOT EXISTS learning_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('sports_business', 'analytics', 'consulting', 'marketing', 'finance', 'career_development', 'technical_skills', 'other')),
  type TEXT NOT NULL CHECK (type IN ('article', 'video', 'course', 'tool', 'guide', 'template', 'other')),
  url TEXT,
  tags TEXT[] DEFAULT '{}',
  role_scope TEXT CHECK (role_scope IN ('general_member', 'analyst', 'project_manager', 'board_member')),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on created_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_learning_resources_created_by ON learning_resources(created_by);

-- Create index on category for filtering
CREATE INDEX IF NOT EXISTS idx_learning_resources_category ON learning_resources(category);

-- Create index on type for filtering
CREATE INDEX IF NOT EXISTS idx_learning_resources_type ON learning_resources(type);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_learning_resources_created_at ON learning_resources(created_at DESC);

-- Enable Row Level Security
ALTER TABLE learning_resources ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view resources they have permission to see based on role_scope
CREATE POLICY "Users can view resources based on role scope"
  ON learning_resources
  FOR SELECT
  USING (
    role_scope IS NULL OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        role_scope = 'general_member' OR
        (role_scope = 'analyst' AND profiles.role IN ('analyst', 'project_manager', 'board_member')) OR
        (role_scope = 'project_manager' AND profiles.role IN ('project_manager', 'board_member')) OR
        (role_scope = 'board_member' AND profiles.role = 'board_member')
      )
    )
  );

-- Policy: Any authenticated user can create a resource
CREATE POLICY "Authenticated users can create resources"
  ON learning_resources
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Policy: Users can update their own resources
CREATE POLICY "Users can update their own resources"
  ON learning_resources
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can delete their own resources
CREATE POLICY "Users can delete their own resources"
  ON learning_resources
  FOR DELETE
  USING (created_by = auth.uid());

-- Grant permissions
GRANT ALL ON learning_resources TO authenticated;
GRANT SELECT ON learning_resources TO anon;
