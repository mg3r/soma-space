-- Add waiver_signature_id to link registrations/guests to a specific waiver record
-- Run in Supabase SQL Editor (test env first, then production)

ALTER TABLE registration_guests
  ADD COLUMN IF NOT EXISTS waiver_signature_id UUID REFERENCES waiver_signatures(id);

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS waiver_signature_id UUID REFERENCES waiver_signatures(id);

COMMENT ON COLUMN registration_guests.waiver_signature_id IS 'When set, links this guest to a specific waiver (e.g. admin linked to QR signature)';
COMMENT ON COLUMN registrations.waiver_signature_id IS 'When set, links this registration to a specific waiver (e.g. admin linked to QR signature)';
