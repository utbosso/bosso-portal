-- Create storage bucket for application documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('applications', 'applications', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload their own application documents
CREATE POLICY "Users can upload their own application documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'applications' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can view their own application documents
CREATE POLICY "Users can view their own application documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'applications' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can update their own application documents
CREATE POLICY "Users can update their own application documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'applications' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'applications' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete their own application documents
CREATE POLICY "Users can delete their own application documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'applications' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
