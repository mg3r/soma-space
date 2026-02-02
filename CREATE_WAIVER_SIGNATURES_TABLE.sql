-- Waiver signatures: remember who has signed so they don't have to sign again
-- Run in Supabase SQL Editor (test env first, then production)

CREATE TABLE IF NOT EXISTS waiver_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  waiver_version TEXT DEFAULT '1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waiver_signatures_email ON waiver_signatures(email);
CREATE INDEX IF NOT EXISTS idx_waiver_signatures_signed_at ON waiver_signatures(signed_at);

ALTER TABLE waiver_signatures ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no policy needed for server-side use
COMMENT ON TABLE waiver_signatures IS 'Stores waiver signatures by email so returning participants skip the waiver';
