-- Create email_templates table for storing email templates
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_templates_updated_at ON email_templates(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role (used by API routes) full access
-- This is safe because API routes are protected by admin authentication
CREATE POLICY "Allow service role full access to email_templates"
  ON email_templates
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE email_templates IS 'Stores email templates for admin dashboard';
