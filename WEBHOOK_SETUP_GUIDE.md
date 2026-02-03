# Step-by-Step Setup Guide

## Step 1: Create Supabase Tables

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New query**
5. Copy and paste this SQL:

```sql
-- Create registrations table (synced from Stripe)
CREATE TABLE IF NOT EXISTS registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  event_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  amount_paid DECIMAL(10, 2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  stripe_customer_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for registrations
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(customer_email);
CREATE INDEX IF NOT EXISTS idx_registrations_session_id ON registrations(session_id);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_date ON registrations(payment_date);

-- Create excluded_registrations table (for duplicate/refunded registrations)
CREATE TABLE IF NOT EXISTS excluded_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  event_id TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for excluded_registrations
CREATE INDEX IF NOT EXISTS idx_excluded_registrations_session_id ON excluded_registrations(session_id);
CREATE INDEX IF NOT EXISTS idx_excluded_registrations_event_id ON excluded_registrations(event_id);

-- Enable RLS (Row Level Security)
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE excluded_registrations ENABLE ROW LEVEL SECURITY;
```

6. Click **Run** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned"

**Refund tracking:** For refunds to show in the admin and in Supabase, the `registrations` table must have a `refunded_at` column. If your project was created from the SQL above (without it), run **ADD_REFUNDED_AT.sql** or **SYNC_REGISTRATIONS_TABLE.sql** in the SQL Editor. See **REFUND_SETUP.md** for details.

## Step 2: Set Up Stripe Webhook

### 2.1 Create Webhook Endpoint in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in the correct mode (Test or Live) - should match your `STRIPE_MODE` env var
3. Click **Developers** (left sidebar) → **Webhooks**
4. Click **Add endpoint** (top right)
5. Fill in:
   - **Endpoint URL**: `https://www.entersoma.space/api/webhooks/stripe`
     - ⚠️ **Important**: Use the `www` version to avoid redirect issues
     - (If testing locally, use a tool like [ngrok](https://ngrok.com) to expose localhost)
   - **Description**: "Soma Space Registration Sync"
6. Under **Events to send**, click **Select events**
7. Check the boxes for:
   - `checkout.session.completed` (syncs new registrations)
   - `charge.refunded` (records refund on registration for admin; see REFUND_SETUP.md)
8. Click **Add endpoint**

### 2.2 Get Webhook Signing Secret

1. After creating the endpoint, click on it to view details
2. Find **Signing secret** section
3. Click **Reveal** next to the signing secret (starts with `whsec_`)
4. Copy the entire secret

### 2.3 Add to Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project (`soma-space`)
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Add:
   - **Name**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: Paste the signing secret you copied (starts with `whsec_`)
   - **Environment**: Select all (Production, Preview, Development)
6. Click **Save**
7. **Important**: Redeploy your app for the env var to take effect
   - Go to **Deployments** tab
   - Click the three dots on the latest deployment → **Redeploy**

## Step 3: Migrate Existing Registrations

After the tables are created and webhook is set up, backfill existing registrations:

### Option A: Using curl (Terminal)

```bash
curl -X POST https://entersoma.space/api/admin/migrate-registrations \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json"
```

Replace `YOUR_ADMIN_PASSWORD` with your actual admin password from Vercel env vars.

### Option B: Using Browser (Easier)

1. Open your browser's developer console (F12)
2. Go to the **Console** tab
3. Paste this code (replace `YOUR_ADMIN_PASSWORD`):

```javascript
fetch('https://entersoma.space/api/admin/migrate-registrations', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ADMIN_PASSWORD',
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log('Migration result:', data))
.catch(err => console.error('Error:', err));
```

4. Press Enter
5. You should see a response like:
   ```json
   {
     "success": true,
     "migrated": 3,
     "skipped": 0,
     "errors": 0,
     "message": "Migration complete: 3 migrated, 0 skipped, 0 errors"
   }
   ```

## Step 4: Verify Everything Works

1. **Check Supabase Tables**:
   - Go to Supabase Dashboard → **Table Editor**
   - You should see rows in the `registrations` table
   - `excluded_registrations` should be empty (unless you've excluded any)

2. **Check Admin Dashboard**:
   - Go to `https://entersoma.space/admin`
   - You should see your registrations listed
   - Try clicking "exclude" on a registration to test

3. **Test Webhook** (Optional):
   - In Stripe Dashboard → Webhooks → Your endpoint
   - Click **Send test webhook**
   - Select `checkout.session.completed`
   - Check Vercel function logs to see if it processed

## Troubleshooting

### "0 registrations" in admin dashboard

**Possible causes:**
1. Tables not created - Go back to Step 1
2. Migration not run - Go back to Step 3
3. Supabase env vars not set - Check Vercel has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
4. Wrong event ID - Check that registrations have `event_id = 'RENEWAL'` in Supabase

**Quick check:**
- Go to Supabase → Table Editor → `registrations`
- Do you see any rows? If yes, the issue is with the admin dashboard query
- If no, run the migration again

### Webhook not working

**Check:**
1. Webhook URL is correct: `https://entersoma.space/api/webhooks/stripe`
2. `STRIPE_WEBHOOK_SECRET` is set in Vercel
3. App has been redeployed after adding the env var
4. Check Vercel function logs for webhook errors

### Migration returns 0 migrated

**Possible causes:**
1. No registrations match the criteria (amount $22-44, success URL contains `/welcome`)
2. Wrong Stripe mode (test vs live)
3. Authorization failed (wrong admin password)

**Check:**
- Go to Stripe Dashboard → Payments
- Do you see payments in the $22-44 range?
- Are they marked as "Succeeded"?

