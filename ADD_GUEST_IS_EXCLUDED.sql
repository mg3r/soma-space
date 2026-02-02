-- Add is_excluded to registration_guests so admins can exclude individual guests from capacity (e.g. can't make it).
-- Excluding a guest is separate from refunded; refunded is noted from Stripe and does not auto-exclude.
-- Run in Supabase SQL Editor

ALTER TABLE registration_guests
ADD COLUMN IF NOT EXISTS is_excluded BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN registration_guests.is_excluded IS 'When true, this guest is excluded from capacity count (e.g. cannot attend). Set manually in admin; not tied to refund.';
