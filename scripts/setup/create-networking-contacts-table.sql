-- Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS networking_contacts CASCADE;

-- Create networking_contacts table
CREATE TABLE networking_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  industry TEXT CHECK (industry IN ('sports_team', 'league', 'agency', 'consulting', 'analytics', 'media', 'tech', 'finance', 'marketing', 'other')),
  relationship TEXT NOT NULL CHECK (relationship IN ('alumni', 'industry_professional', 'recruiter', 'mentor', 'other')),
  email TEXT,
  linkedin_url TEXT,
  phone TEXT,
  location TEXT,
  notes TEXT,
  best_for TEXT[] DEFAULT '{}',
  has_consent BOOLEAN NOT NULL DEFAULT false,
  added_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on added_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_networking_contacts_added_by ON networking_contacts(added_by);

-- Create index on industry for filtering
CREATE INDEX IF NOT EXISTS idx_networking_contacts_industry ON networking_contacts(industry);

-- Create index on relationship for filtering
CREATE INDEX IF NOT EXISTS idx_networking_contacts_relationship ON networking_contacts(relationship);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_networking_contacts_created_at ON networking_contacts(created_at DESC);

-- Create index on company for searching
CREATE INDEX IF NOT EXISTS idx_networking_contacts_company ON networking_contacts(company);

-- Enable Row Level Security
ALTER TABLE networking_contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Any authenticated user can view all contacts
CREATE POLICY "Authenticated users can view contacts"
  ON networking_contacts
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Any authenticated user can create a contact
CREATE POLICY "Authenticated users can create contacts"
  ON networking_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND added_by = auth.uid());

-- Policy: Users can update their own contacts
CREATE POLICY "Users can update their own contacts"
  ON networking_contacts
  FOR UPDATE
  TO authenticated
  USING (added_by = auth.uid())
  WITH CHECK (added_by = auth.uid());

-- Policy: Users can delete their own contacts
CREATE POLICY "Users can delete their own contacts"
  ON networking_contacts
  FOR DELETE
  TO authenticated
  USING (added_by = auth.uid());

-- Grant permissions
GRANT ALL ON networking_contacts TO authenticated;
GRANT SELECT ON networking_contacts TO anon;
