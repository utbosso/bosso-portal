-- Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS application_documents CASCADE;

-- Create application_documents table
CREATE TABLE application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on application_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_application_documents_application_id ON application_documents(application_id);

-- Create index on uploaded_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_application_documents_uploaded_by ON application_documents(uploaded_by);

-- Create index on uploaded_at for sorting
CREATE INDEX IF NOT EXISTS idx_application_documents_uploaded_at ON application_documents(uploaded_at DESC);

-- Enable Row Level Security
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view documents for their own applications
CREATE POLICY "Users can view their own application documents"
  ON application_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_documents.application_id
      AND applications.user_id = auth.uid()
    )
  );

-- Policy: Users can upload documents to their own applications
CREATE POLICY "Users can upload documents to their own applications"
  ON application_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_documents.application_id
      AND applications.user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own application documents
CREATE POLICY "Users can delete their own application documents"
  ON application_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_documents.application_id
      AND applications.user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON application_documents TO authenticated;
