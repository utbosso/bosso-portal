-- Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS feedback_submissions CASCADE;

-- Create feedback_submissions table
CREATE TABLE feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('event', 'portal', 'general', 'suggestion', 'other')),
  event_name TEXT,
  subject TEXT NOT NULL,
  feedback TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'archived')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on submitted_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_submitted_by ON feedback_submissions(submitted_by);

-- Create index on category for filtering
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_category ON feedback_submissions(category);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_status ON feedback_submissions(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_created_at ON feedback_submissions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Board members can view all feedback
CREATE POLICY "Board members can view all feedback"
  ON feedback_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'board_member'
    )
  );

-- Policy: Users can view their own non-anonymous feedback
CREATE POLICY "Users can view their own feedback"
  ON feedback_submissions
  FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid());

-- Policy: Any authenticated user can create feedback
CREATE POLICY "Authenticated users can create feedback"
  ON feedback_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (is_anonymous = true OR submitted_by = auth.uid())
  );

-- Policy: Board members can update feedback (status and notes)
CREATE POLICY "Board members can update feedback"
  ON feedback_submissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'board_member'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'board_member'
    )
  );

-- Grant permissions
GRANT ALL ON feedback_submissions TO authenticated;
