# Registrations & Exclusion System Setup

## Overview

This system stores registrations in Supabase for faster queries and allows you to exclude duplicate/refunded registrations from capacity counts.

## Features

- **Supabase Storage**: Registrations are synced from Stripe to Supabase for faster dashboard loads
- **Exclusion System**: Mark duplicate or refunded registrations to exclude them from capacity counts
- **Automatic Sync**: New registrations are automatically synced via Stripe webhooks
- **Fallback**: System falls back to Stripe if Supabase isn't configured

## Setup Instructions

### 1. Create Supabase Tables

Run the SQL from `SUPABASE_SETUP.md` to create the `registrations` and `excluded_registrations` tables.

### 2. Set Up Stripe Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set endpoint URL to: `https://entersoma.space/api/webhooks/stripe` (or your domain)
4. Select event: `checkout.session.completed`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add to Vercel environment variables:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### 3. Migrate Existing Registrations

After setting up the tables and webhook, run the migration to backfill existing registrations:

```bash
# Using curl (replace with your admin password)
curl -X POST https://entersoma.space/api/admin/migrate-registrations \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json"
```

Or create a simple script to call this endpoint once.

**Note**: The migration will:
- Find all soma space registrations in Stripe
- Sync them to Supabase
- Skip sessions that don't match soma space criteria
- Report how many were migrated

### 4. Verify Setup

1. Go to `/admin` dashboard
2. Check that registrations are showing
3. Test excluding a registration:
   - Click "exclude" on a registration
   - Enter a reason (optional)
   - Verify it shows "(excluded)" and is grayed out
   - Check that capacity count decreases
4. Test un-excluding:
   - Click "un-exclude" on an excluded registration
   - Verify it's back in the count

## How It Works

### Registration Flow

1. **New Registration**: User completes Stripe checkout
2. **Webhook Triggered**: Stripe sends `checkout.session.completed` event
3. **Auto-Sync**: Webhook handler syncs registration to Supabase
4. **Dashboard**: Admin dashboard reads from Supabase (fast!)

### Exclusion Flow

1. **Exclude**: Click "exclude" button → stored in `excluded_registrations` table
2. **Capacity Count**: Excluded registrations are subtracted from total count
3. **Visual Indicator**: Excluded registrations show "(excluded)" and are grayed out
4. **Un-Exclude**: Click "un-exclude" to restore to capacity count

### Fallback Behavior

- If Supabase isn't configured: System reads directly from Stripe (slower)
- If webhook fails: You can manually run migration again
- If registration missing: System will fetch from Stripe on next load

## Admin Dashboard Features

- **Exclude Button**: Mark registrations as excluded (duplicates, refunds, etc.)
- **Un-Exclude Button**: Restore excluded registrations to capacity count
- **Visual Indicators**: Excluded registrations are grayed out with "(excluded)" label
- **Reason Tracking**: Optional reason field when excluding

## Troubleshooting

**Registrations not showing in dashboard:**
- Check Supabase tables exist
- Run migration endpoint
- Check browser console for errors
- Verify Supabase environment variables are set

**Webhook not working:**
- Verify webhook URL is correct in Stripe dashboard
- Check `STRIPE_WEBHOOK_SECRET` is set in Vercel
- Check Vercel function logs for webhook errors
- Test webhook in Stripe dashboard (send test event)

**Exclusion not working:**
- Check `excluded_registrations` table exists in Supabase
- Verify Supabase environment variables
- Check browser console for API errors

**Capacity count seems wrong:**
- Check excluded registrations are properly marked
- Verify migration completed successfully
- Check that both tables (`registrations` and `excluded_registrations`) exist

## API Endpoints

- `POST /api/webhooks/stripe` - Stripe webhook handler (automatic)
- `POST /api/admin/migrate-registrations` - Manual migration endpoint
- `POST /api/admin/exclude` - Exclude a registration
- `DELETE /api/admin/exclude?sessionId=...` - Un-exclude a registration

