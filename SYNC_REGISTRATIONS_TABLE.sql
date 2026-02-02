-- Sync registrations table: add any missing columns and indexes (safe to run on existing table)
-- Run in Supabase SQL Editor (test first, then production). Does NOT drop or recreate the table.

-- =============================================================================
-- 0. session_id must be UNIQUE (required for Stripe webhook upsert)
--    If your table was created without it and has no duplicates, run once:
--    ALTER TABLE registrations ADD CONSTRAINT registrations_session_id_key UNIQUE (session_id);
-- =============================================================================

-- =============================================================================
-- 1. Missing columns (add only if not present)
-- =============================================================================
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS pre_waiver_email TEXT,
  ADD COLUMN IF NOT EXISTS is_excluded BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;

-- =============================================================================
-- 2. Indexes (create only if not present)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(customer_email);
CREATE INDEX IF NOT EXISTS idx_registrations_session_id ON registrations(session_id);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_date ON registrations(payment_date);
CREATE INDEX IF NOT EXISTS idx_registrations_is_excluded ON registrations(is_excluded);
CREATE INDEX IF NOT EXISTS idx_registrations_pre_waiver_email ON registrations(pre_waiver_email)
  WHERE pre_waiver_email IS NOT NULL;

-- =============================================================================
-- 3. Comments (optional)
-- =============================================================================
COMMENT ON COLUMN registrations.pre_waiver_email IS 'Email from chat/waiver flow; send confirmations to both when different from customer_email';

-- =============================================================================
-- 4. RLS (enable if not already; service role bypasses for server-side use)
-- =============================================================================
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
