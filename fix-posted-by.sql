-- Make posted_by nullable so the scraper can insert opportunities
-- Run this in your Supabase SQL editor

ALTER TABLE opportunities
ALTER COLUMN posted_by DROP NOT NULL;

-- Optionally, set a default value for existing rows
UPDATE opportunities
SET posted_by = NULL
WHERE posted_by IS NULL;
