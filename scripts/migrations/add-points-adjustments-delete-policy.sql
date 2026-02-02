-- Allow admins to delete points adjustments (for undo/corrections).
-- This is required for removing mistakenly awarded task/manual points.

DROP POLICY IF EXISTS "Admins can delete points adjustments" ON points_adjustments;

CREATE POLICY "Admins can delete points adjustments"
  ON points_adjustments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
