-- Add multi-ticket settings to event_config (per-event toggle and max guests)
-- Run in Supabase SQL Editor

ALTER TABLE event_config
  ADD COLUMN IF NOT EXISTS multi_ticket_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_guests_per_order INTEGER DEFAULT 3;

COMMENT ON COLUMN event_config.multi_ticket_enabled IS 'When true, purchaser can buy multiple tickets (1 + guests) per order';
COMMENT ON COLUMN event_config.max_guests_per_order IS 'Max additional guests per order (default 3 = max 4 tickets total)';
