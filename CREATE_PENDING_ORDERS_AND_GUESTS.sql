-- Tables for multi-ticket orders: pending_orders (before checkout) and registration_guests (after payment)
-- Run in Supabase SQL Editor

-- pending_orders: stores guest list before redirect to Stripe; keyed by metadata in checkout session
CREATE TABLE IF NOT EXISTS pending_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  tickets JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- tickets = [{ "name": "...", "email": "...", "amount": 33 }, ...] (amount in dollars; first = purchaser)
CREATE INDEX IF NOT EXISTS idx_pending_orders_event_id ON pending_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_created_at ON pending_orders(created_at);

-- registration_guests: one row per guest (non-purchaser) for a checkout session
CREATE TABLE IF NOT EXISTS registration_guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  guest_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,
  waiver_signed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, guest_index)
);
CREATE INDEX IF NOT EXISTS idx_registration_guests_session_id ON registration_guests(session_id);
CREATE INDEX IF NOT EXISTS idx_registration_guests_event_id ON registration_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_registration_guests_email ON registration_guests(email);

ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_guests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pending_orders IS 'Stores ticket list (purchaser + guests) before Stripe checkout; webhook uses metadata.pending_order_id to load';
COMMENT ON TABLE registration_guests IS 'One row per guest (non-purchaser) per multi-ticket order; waiver_signed_at set when guest signs';
