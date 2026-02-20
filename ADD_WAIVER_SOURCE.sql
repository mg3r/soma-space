-- Add source column to waiver_signatures for tracking how the waiver was signed
-- Run in Supabase SQL Editor (test env first, then production)

ALTER TABLE waiver_signatures
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';

COMMENT ON COLUMN waiver_signatures.source IS 'How the waiver was signed: web (reserve/guest flow), walk_in (QR page), walk_in_paper (paper at door), admin (manual mark)';
