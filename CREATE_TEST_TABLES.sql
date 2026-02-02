-- Create all tables for test Supabase project (except event_config, profiles, waiver_signatures)
-- Run this in Supabase SQL Editor

-- =============================================================================
-- event_capacities
-- =============================================================================
CREATE TABLE IF NOT EXISTS event_capacities (
  event_id TEXT PRIMARY KEY,
  capacity INTEGER NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_capacities_event_id ON event_capacities(event_id);
INSERT INTO event_capacities (event_id, capacity)
VALUES ('RENEWAL', 22)
ON CONFLICT (event_id) DO NOTHING;

-- =============================================================================
-- waitlist
-- =============================================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_waitlist_event_id ON waitlist(event_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);

-- =============================================================================
-- registrations (synced from Stripe; includes pre_waiver_email and is_excluded)
-- =============================================================================
CREATE TABLE IF NOT EXISTS registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  event_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  pre_waiver_email TEXT,
  amount_paid DECIMAL(10, 2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  stripe_customer_id TEXT,
  notes TEXT,
  is_excluded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(customer_email);
CREATE INDEX IF NOT EXISTS idx_registrations_session_id ON registrations(session_id);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_date ON registrations(payment_date);
CREATE INDEX IF NOT EXISTS idx_registrations_is_excluded ON registrations(is_excluded);
CREATE INDEX IF NOT EXISTS idx_registrations_pre_waiver_email ON registrations(pre_waiver_email)
  WHERE pre_waiver_email IS NOT NULL;

-- =============================================================================
-- excluded_registrations (duplicate/refunded registrations)
-- =============================================================================
CREATE TABLE IF NOT EXISTS excluded_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  event_id TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_excluded_registrations_session_id ON excluded_registrations(session_id);
CREATE INDEX IF NOT EXISTS idx_excluded_registrations_event_id ON excluded_registrations(event_id);

-- =============================================================================
-- email_templates (admin dashboard)
-- =============================================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_templates_updated_at ON email_templates(updated_at DESC);
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role full access to email_templates"
  ON email_templates
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- RLS on other tables (service role bypasses; no policies needed for server use)
-- =============================================================================
ALTER TABLE event_capacities ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE excluded_registrations ENABLE ROW LEVEL SECURITY;
