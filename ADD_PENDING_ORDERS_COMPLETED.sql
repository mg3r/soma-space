-- Mark pending orders when checkout completes (same session); used for "abandoned only" admin view.
-- Run in Supabase SQL Editor (test first, then production). Safe on existing table.

ALTER TABLE pending_orders
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_pending_orders_completed_at ON pending_orders(completed_at)
  WHERE completed_at IS NULL;

COMMENT ON COLUMN pending_orders.completed_at IS 'Set when Stripe checkout.session.completed webhook runs for this order (metadata.pending_order_id).';
COMMENT ON COLUMN pending_orders.session_id IS 'Stripe checkout session_id that completed this order.';
