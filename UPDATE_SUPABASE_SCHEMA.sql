-- Migration script to update existing tables
-- Run this in Supabase SQL Editor after the initial setup

-- Add customer info columns to excluded_registrations
ALTER TABLE excluded_registrations 
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Add is_excluded flag to registrations
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS is_excluded BOOLEAN DEFAULT FALSE;

-- Create index for is_excluded for faster queries
CREATE INDEX IF NOT EXISTS idx_registrations_is_excluded ON registrations(is_excluded);

-- Update existing excluded registrations with customer info from registrations table
UPDATE excluded_registrations ex
SET 
  customer_name = r.customer_name,
  customer_email = r.customer_email,
  customer_phone = r.customer_phone
FROM registrations r
WHERE ex.session_id = r.session_id
  AND (ex.customer_name IS NULL OR ex.customer_email IS NULL);

-- Update registrations.is_excluded based on excluded_registrations
UPDATE registrations r
SET is_excluded = TRUE
FROM excluded_registrations ex
WHERE r.session_id = ex.session_id
  AND r.is_excluded = FALSE;

