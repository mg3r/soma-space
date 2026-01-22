# Testing Setup Guide

This guide helps you set up a separate Supabase project for testing the event configuration system without affecting production.

## Step 1: Create a Test Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Name it something like "soma-space-test" or "soma-space-dev"
4. Choose a database password (save it somewhere safe)
5. Select a region close to you
6. Wait for the project to be created (takes ~2 minutes)

## Step 2: Get Your Test Project Credentials

1. In your test project dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (under "Project URL")
   - **service_role key** (under "Project API keys" → "service_role" - this is the secret key)

## Step 3: Run SQL Migrations on Test Project

1. In your test project, go to **SQL Editor**
2. Run the following migrations in order:
   - `CREATE_EVENT_CONFIG_TABLE.sql`
   - `CREATE_EMAIL_TEMPLATES_TABLE.sql` (if you haven't already)
   - Any other migrations you need

## Step 4: Set Up Local Environment

1. Create or update `.env.local` in your project root:

```bash
# Test Supabase Project (for local development)
NEXT_PUBLIC_SUPABASE_URL=your_test_project_url_here
SUPABASE_SERVICE_ROLE_KEY=your_test_service_role_key_here

# Keep your other environment variables (Stripe, Resend, etc.)
# These can point to test/staging versions if you have them
STRIPE_MODE=test
STRIPE_SECRET_KEY_TEST=your_test_stripe_key
RESEND_API_KEY=your_resend_key
ADMIN_PASSWORD=your_admin_password
EVENT_PASSWORD=your_test_event_password
```

2. **Important**: Make sure `.env.local` is in `.gitignore` (it should be by default)

## Step 5: Test Locally

1. Start your local development server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:3000/admin`

3. Log in with your admin password

4. Go to the "Event Config" tab

5. Click "initialize with defaults" to create your first test event config

6. Make changes and test the functionality

## Step 6: Switch Back to Production

When you're ready to deploy to production:

1. **Don't commit `.env.local`** - it stays local only

2. In Vercel, make sure your production environment variables are set to your **production Supabase project**

3. Deploy as normal - production will use the production Supabase project

## Testing Checklist

- [ ] Test event config creation
- [ ] Test updating event details
- [ ] Test changing colors
- [ ] Test updating chat messages
- [ ] Test Stripe configuration
- [ ] Test setting event as active
- [ ] Verify checkout uses new config
- [ ] Verify emails use new config
- [ ] Test with multiple event configs

## Troubleshooting

**Issue**: Can't connect to Supabase
- Check that your `.env.local` has the correct test project URL and service role key
- Make sure you're using the **service_role** key, not the anon key

**Issue**: Table doesn't exist
- Make sure you ran the SQL migrations in your test project's SQL Editor

**Issue**: Changes not saving
- Check browser console for errors
- Verify your service role key has the correct permissions
- Check Supabase logs in the dashboard

## Safety Notes

- ✅ Your test project is completely separate from production
- ✅ You can delete and recreate the test project anytime
- ✅ Production data is never touched when testing locally
- ✅ `.env.local` is gitignored, so test credentials stay local
