-- Add optional attachment metadata to announcements
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS attachment_path TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_mime_type TEXT;

-- Create private storage bucket for announcement attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-attachments', 'announcement-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can read attachments (announcement visibility is enforced by app + table RLS)
DROP POLICY IF EXISTS "Authenticated users can view announcement attachments" ON storage.objects;
CREATE POLICY "Authenticated users can view announcement attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'announcement-attachments'
  );

-- Announcement creator, board members, and admins can upload files to an announcement folder
DROP POLICY IF EXISTS "Announcement managers can upload attachments" ON storage.objects;
CREATE POLICY "Announcement managers can upload attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'announcement-attachments'
    AND EXISTS (
      SELECT 1
      FROM announcements a
      WHERE a.id::text = (storage.foldername(name))[1]
        AND (
          a.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('board_member', 'admin')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Announcement managers can update attachments" ON storage.objects;
CREATE POLICY "Announcement managers can update attachments"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'announcement-attachments'
    AND EXISTS (
      SELECT 1
      FROM announcements a
      WHERE a.id::text = (storage.foldername(name))[1]
        AND (
          a.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('board_member', 'admin')
          )
        )
    )
  )
  WITH CHECK (
    bucket_id = 'announcement-attachments'
    AND EXISTS (
      SELECT 1
      FROM announcements a
      WHERE a.id::text = (storage.foldername(name))[1]
        AND (
          a.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('board_member', 'admin')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Announcement managers can delete attachments" ON storage.objects;
CREATE POLICY "Announcement managers can delete attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'announcement-attachments'
    AND EXISTS (
      SELECT 1
      FROM announcements a
      WHERE a.id::text = (storage.foldername(name))[1]
        AND (
          a.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('board_member', 'admin')
          )
        )
    )
  );
