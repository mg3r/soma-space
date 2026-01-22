-- Add attachments column to existing email_templates table
-- Run this in Supabase SQL Editor if you already created the table

ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS attachments JSONB;
