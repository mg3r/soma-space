-- Add pre_waiver_email to registrations (email from chat/waiver flow; may differ from Stripe email)
-- Run in Supabase SQL Editor (test first, then production)

ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS pre_waiver_email TEXT;

CREATE INDEX IF NOT EXISTS idx_registrations_pre_waiver_email ON registrations(pre_waiver_email)
WHERE pre_waiver_email IS NOT NULL;

COMMENT ON COLUMN registrations.pre_waiver_email IS 'Email from chat/waiver flow; send confirmations to both when different from customer_email';
