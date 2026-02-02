-- Track refunds on registrations without auto-excluding (refund ≠ exclusion)
-- Run in Supabase SQL Editor (test first, then production). Safe on existing table.

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN registrations.refunded_at IS 'Set when Stripe charge.refunded webhook fires; used to show (refunded) in admin. Does not exclude from capacity.';
