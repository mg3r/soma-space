# Exclusion System & Session Auth Guide

## How Exclusion Works

### Manual Exclusion
- **When**: You manually click "exclude" on a registration in the admin dashboard
- **What happens**:
  1. Registration is added to `excluded_registrations` table with customer info
  2. `registrations.is_excluded` flag is set to `true`
  3. Registration is removed from capacity counts
  4. Registration is removed from revenue calculations
  5. Registration still appears in dashboard (grayed out with "(excluded)" label)

### Automatic Exclusion (Refunds)
- **When**: You refund a payment in Stripe Dashboard
- **What happens**:
  1. Stripe sends `charge.refunded` webhook event
  2. System automatically excludes the registration
  3. Reason is set to: "Auto-excluded: Payment refunded in Stripe"
  4. Same effects as manual exclusion (removed from capacity/revenue)

### Important Notes
- **Exclusion is NOT automatic** unless you refund in Stripe
- If you just want to exclude a duplicate (without refunding), use the manual exclude button
- Excluded registrations can be un-excluded using the "un-exclude" button
- Excluded registrations still appear in the registrations table for record-keeping

## Database Schema Updates

### Run Migration SQL

You need to run the migration SQL to update your existing tables. Go to Supabase SQL Editor and run:

```sql
-- See UPDATE_SUPABASE_SCHEMA.sql for the full migration script
```

Or run it directly from the file `UPDATE_SUPABASE_SCHEMA.sql`.

### New Columns Added

**excluded_registrations table:**
- `customer_name` (TEXT)
- `customer_email` (TEXT)
- `customer_phone` (TEXT)

**registrations table:**
- `is_excluded` (BOOLEAN, default FALSE)

## Session-Based Authentication

### How It Works
- After entering password once, a cookie is set (30-day expiration)
- Cookie is checked on page load
- If valid cookie exists, you're automatically logged in
- No need to enter password again for 30 days

### Logout
- Click "sign out" button in admin dashboard
- Cookie is cleared
- You'll need to enter password again next time

### Security
- Cookie is `httpOnly` (not accessible via JavaScript)
- `secure` flag in production (HTTPS only)
- `sameSite: lax` for CSRF protection

## Stripe Webhook Events

### Current Events Handled

1. **checkout.session.completed**
   - Syncs new registrations to Supabase
   - Automatically runs when payment completes

2. **charge.refunded** (NEW)
   - Automatically excludes refunded registrations
   - Sets reason: "Auto-excluded: Payment refunded in Stripe"

### Adding Refund Event to Webhook

1. Go to Stripe Dashboard → Webhooks → Your endpoint
2. Click "Add events"
3. Search for: `charge.refunded`
4. Select it and save

The webhook will now automatically exclude registrations when you refund in Stripe!

## Admin Dashboard Features

- **Exclude Button**: Manually exclude a registration (duplicates, etc.)
- **Un-Exclude Button**: Restore an excluded registration
- **Visual Indicators**: Excluded registrations are grayed out with "(excluded)" label
- **Customer Info in Excluded Table**: All excluded registrations show customer details
- **Auto-Login**: Remembers your session for 30 days

## Troubleshooting

**Exclusion not working:**
- Check that migration SQL was run
- Verify `is_excluded` column exists in `registrations` table
- Check browser console for errors

**Auto-exclude on refund not working:**
- Verify `charge.refunded` event is added to Stripe webhook
- Check Vercel function logs for webhook processing
- Ensure webhook secret is set in Vercel

**Session not persisting:**
- Check browser allows cookies
- Verify you're on the same domain (www vs non-www)
- Clear cookies and try again

