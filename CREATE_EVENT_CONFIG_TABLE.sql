-- Create event_config table for storing event configurations
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS event_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL,
  event_place TEXT NOT NULL,
  event_address TEXT NOT NULL,
  event_note TEXT,
  event_description TEXT,
  
  -- Chat messages
  chat_welcome_message TEXT,
  chat_intro_message TEXT,
  chat_password_prompt TEXT,
  chat_access_granted_message TEXT,
  chat_event_announcement TEXT,
  chat_event_description TEXT,
  chat_location_message TEXT,
  chat_contribution_message TEXT,
  chat_full_message TEXT,
  chat_waitlist_message TEXT,
  
  -- Colors
  primary_color TEXT DEFAULT '#05fd00',
  background_color TEXT DEFAULT '#111111',
  
  -- Stripe configuration
  stripe_product_name TEXT DEFAULT 'soma space',
  stripe_product_description TEXT,
  stripe_image_url TEXT,
  stripe_min_amount INTEGER DEFAULT 2200,
  stripe_max_amount INTEGER DEFAULT 4400,
  
  -- Event password
  event_password TEXT,
  
  -- Capacity
  capacity INTEGER DEFAULT 25,
  
  -- Active flag (only one event should be active at a time)
  is_active BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_event_config_event_id ON event_config(event_id);
CREATE INDEX IF NOT EXISTS idx_event_config_is_active ON event_config(is_active);

-- Enable Row Level Security
ALTER TABLE event_config ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role (used by API routes) full access
CREATE POLICY "Allow service role full access to event_config"
  ON event_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE event_config IS 'Stores event configurations for easy event management';
