-- =====================================================
-- CREATE TASK NOTIFICATIONS TABLE
-- =====================================================
-- Tracks notifications for task creators when:
-- 1. Assignee submits an update
-- 2. Assignee changes task status

-- Create task_notifications table
CREATE TABLE IF NOT EXISTS task_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('update_submitted', 'status_changed')),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_id ON task_notifications(user_id);

-- Create index on task_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_notifications_task_id ON task_notifications(task_id);

-- Create index on is_read for filtering
CREATE INDEX IF NOT EXISTS idx_task_notifications_is_read ON task_notifications(is_read);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_task_notifications_created_at ON task_notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE task_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON task_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can create notifications
CREATE POLICY "Users can create notifications"
  ON task_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON task_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON task_notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON task_notifications TO authenticated;

-- =====================================================
-- COMPLETE
-- =====================================================
-- Task notifications table created!
--
-- Summary:
-- ✅ Notifications are created when assignee submits updates
-- ✅ Notifications are created when assignee changes status
-- ✅ Task creators receive notifications
-- ✅ Users can mark notifications as read
