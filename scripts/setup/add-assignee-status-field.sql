-- =====================================================
-- ADD ASSIGNEE STATUS FIELD TO TASKS
-- =====================================================
-- This adds a separate field to track assignee's progress
-- independently from the creator's review status

-- Add assignee_status column to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'assignee_status'
  ) THEN
    ALTER TABLE tasks ADD COLUMN assignee_status TEXT DEFAULT 'not_started';
  END IF;
END $$;

-- Add constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'tasks' AND constraint_name = 'tasks_assignee_status_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_assignee_status_check
    CHECK (assignee_status IN ('not_started', 'in_progress', 'completed'));
  END IF;
END $$;

-- Migrate existing data:
-- If current status is 'completed', 'not_reviewed', 'in_review', or 'approved',
-- set assignee_status to 'completed'
UPDATE tasks
SET assignee_status = 'completed'
WHERE status IN ('completed', 'not_reviewed', 'in_review', 'approved');

-- If current status is 'in_progress', set assignee_status to 'in_progress'
UPDATE tasks
SET assignee_status = 'in_progress'
WHERE status = 'in_progress';

-- If current status is 'not_started', set assignee_status to 'not_started'
UPDATE tasks
SET assignee_status = 'not_started'
WHERE status = 'not_started';

-- Now update the status field to reflect review state:
-- - If assignee_status is 'completed' and current status is 'completed', change to 'not_reviewed'
-- - Otherwise keep the review status as is
UPDATE tasks
SET status = 'not_reviewed'
WHERE assignee_status = 'completed' AND status = 'completed';

-- =====================================================
-- COMPLETE
-- =====================================================
-- Tasks now have two status fields:
-- 1. assignee_status: Tracks assignee's work (not_started, in_progress, completed)
-- 2. status: Tracks creator's review (not_reviewed, in_review, approved)
--            OR assignee's progress if not yet completed
