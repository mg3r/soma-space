# Supabase Setup for Dynamic Capacity Management

## Overview

Supabase is used to store event capacity limits dynamically, allowing you to update them from the admin dashboard without redeploying or changing environment variables.

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Create a new project
3. Note your project URL and API keys

### 2. Create the Database Tables

Run this SQL in the Supabase SQL Editor:

```sql
-- Create event_capacities table
CREATE TABLE IF NOT EXISTS event_capacities (
  event_id TEXT PRIMARY KEY,
  capacity INTEGER NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_capacities_event_id ON event_capacities(event_id);

-- Insert default capacity for RENEWAL event (optional)
INSERT INTO event_capacities (event_id, capacity)
VALUES ('RENEWAL', 22)
ON CONFLICT (event_id) DO NOTHING;

-- Create waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for waitlist
CREATE INDEX IF NOT EXISTS idx_waitlist_event_id ON waitlist(event_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);
```

### 3. Set Up Row Level Security (RLS)

For security, enable RLS but allow service role to bypass:

```sql
-- Enable RLS for event_capacities
ALTER TABLE event_capacities ENABLE ROW LEVEL SECURITY;

-- Enable RLS for waitlist
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow service role to read/write (this is handled by service role key)
-- The service role key bypasses RLS, so no policy is needed
```

### 4. Get Your Supabase Credentials

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy your **Project URL** (this is `NEXT_PUBLIC_SUPABASE_URL`)
3. Copy your **service_role** key (this is `SUPABASE_SERVICE_ROLE_KEY`)
   - ⚠️ **Important**: Use the `service_role` key, NOT the `anon` key
   - The service role key bypasses RLS and is safe for server-side use

### 5. Add Environment Variables to Vercel

Add these to your Vercel project environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Important Notes:**
- `NEXT_PUBLIC_SUPABASE_URL` is public (starts with `NEXT_PUBLIC_`)
- `SUPABASE_SERVICE_ROLE_KEY` is private (server-side only)
- Never commit the service role key to git

### 6. Redeploy

After adding environment variables, trigger a new deployment in Vercel.

## How It Works

1. **Reading Capacity**: The system first tries to read from Supabase. If Supabase isn't configured or the table doesn't exist, it falls back to environment variables.

2. **Writing Capacity**: When you update capacity in the admin dashboard, it's saved to Supabase immediately. No redeploy needed!

3. **Fallback**: If Supabase isn't set up, the system gracefully falls back to environment variables, so your app continues to work.

## Testing

1. Go to `/admin` dashboard
2. Update the capacity for an event
3. The change should take effect immediately
4. Check Supabase dashboard to verify the data was saved

## Adding New Events

When you add a new event, you can either:
- Let it use the default capacity (22) or environment variable
- Manually insert it into Supabase:
  ```sql
  INSERT INTO event_capacities (event_id, capacity)
  VALUES ('NEW_EVENT_ID', 30);
  ```

## Troubleshooting

**Error: "Missing NEXT_PUBLIC_SUPABASE_URL"**
- Make sure you've added the environment variable in Vercel
- Redeploy after adding environment variables

**Error: "Missing SUPABASE_SERVICE_ROLE_KEY"**
- Make sure you've added the service role key (not the anon key)
- Check that it's set in Vercel environment variables

**Capacity not updating:**
- Check Supabase dashboard to see if the data is being saved
- Check browser console for errors
- Verify the table exists and has the correct structure

