-- Allow announcements and events to target specific members in addition to role groups.
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS target_user_ids UUID[] NULL;

ALTER TABLE events
ADD COLUMN IF NOT EXISTS target_user_ids UUID[] NULL;

-- Speed up overlap/containment checks on selected user IDs.
CREATE INDEX IF NOT EXISTS idx_announcements_target_user_ids
  ON announcements
  USING GIN (target_user_ids);

CREATE INDEX IF NOT EXISTS idx_events_target_user_ids
  ON events
  USING GIN (target_user_ids);
