# Email Notification Setup

## Overview

Email notifications are sent when an event reaches capacity. The system uses Resend for email delivery.

## Setup Instructions

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up
2. Verify your email address
3. Navigate to **API Keys** in the dashboard

### 2. Get Your API Key

1. In Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Name it something like "soma-space-capacity-notifications"
4. Copy the API key (starts with `re_`)

### 3. Set Up Your Domain (Optional but Recommended)

For production, you should verify your domain:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter `entersoma.space`
4. Follow the DNS setup instructions:
   - Add the provided DNS records to your domain (GoDaddy, etc.)
   - Wait for verification (usually a few minutes)

**Note:** You can use Resend's default domain for testing, but you'll need to verify your domain for production use.

### 4. Add Environment Variables to Vercel

Add these to your Vercel project environment variables:

```bash
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Optional - custom from email (must be verified domain)
# If not set, defaults to ovi@entersoma.space
# Current setting: ovi@entersoma.space
# To change the from email:
# 1. Go to Resend dashboard > Domains
# 2. Verify your domain (e.g., entersoma.space)
# 3. Add DNS records as instructed
# 4. Once verified, you can use any email @yourdomain.com
# 5. Set RESEND_FROM_EMAIL=your-email@entersoma.space in Vercel
RESEND_FROM_EMAIL=ovi@entersoma.space
```

**Important:**
- `RESEND_API_KEY` is required for emails to send
- `RESEND_FROM_EMAIL` is optional - if not set, uses `noreply@entersoma.space`
- Make sure your domain is verified in Resend if using a custom from email

### 5. Redeploy

After adding environment variables, trigger a new deployment in Vercel.

## Testing

1. Set event capacity to a low number (e.g., 2)
2. Book spots until capacity is reached
3. Check your email (`max@asterisk.foundation`) for the notification
4. Check Vercel logs to see if email was sent successfully

## Email Content

The email includes:
- Subject: "[Event Name] has reached capacity"
- Body: Event details and link to admin dashboard

## Troubleshooting

**Emails not sending:**
- Check that `RESEND_API_KEY` is set in Vercel
- Check that `ADMIN_EMAIL` is set in Vercel
- Check Vercel logs for error messages
- Verify your domain in Resend (if using custom from email)

**Using default Resend domain:**
- If you haven't verified your domain, use Resend's default domain
- Set `RESEND_FROM_EMAIL=onboarding@resend.dev` (or another Resend default)
- Note: This is for testing only - verify your domain for production

## Free Tier Limits

Resend free tier includes:
- 3,000 emails/month
- 100 emails/day
- Perfect for capacity notifications!

