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

**Guest "you're in" + waiver email: Resend shows sent but guest never received it**

Resend marks an email as "sent" when they accept it; delivery to the inbox can still fail or be filtered.

1. **Check spam/junk** – Have the guest check their spam and "Promotions" (Gmail) folders.
2. **Resend delivery status** – In Resend dashboard, open the email and check status: Delivered, Bounced, or Complained. If it bounced, the address may be wrong or the provider rejected it.
3. **Unverified domain** – If `RESEND_FROM_EMAIL` uses your own domain (e.g. `ovi@entersoma.space`) and that domain is **not verified** in Resend, many providers (Gmail, etc.) will reject or spam the message. Verify the domain in Resend (Domains → Add Domain → add the DNS records they give you).
4. **Testing with a guaranteed inbox** – Use **`delivered@resend.dev`** as the **guest email** when testing multi-ticket. Resend delivers that to their test inbox so you can confirm the automated "you're in" + waiver email and link work. Your dev server logs will show `Guest 'you're in' + waiver email sent to delivered@resend.dev` and you can open it in Resend’s test view.

## Testing confirmation emails locally (Stripe test mode)

When testing the full flow (register → waiver → checkout) locally with Stripe test mode:

1. **Webhook must reach your app**  
   Run `npm run stripe:listen` in a second terminal and set `STRIPE_WEBHOOK_SECRET` in `.env.local` (see [LOCAL_WEBHOOK_SETUP.md](LOCAL_WEBHOOK_SETUP.md)).

2. **Resend recipient in test**  
   If your **sending domain is not verified** in Resend, they only deliver to:
   - **`delivered@resend.dev`** (recommended for testing)
   - Your Resend account email  

   So when testing checkout, use **`delivered@resend.dev`** (or your verified email) as the customer email. If you use a random Gmail and the domain isn’t verified, Resend may reject the send or not deliver.

3. **Check dev server logs**  
   After completing a test payment, look for:
   - `[webhook] checkout.session.completed received` – webhook hit
   - `[webhook] Sending confirmation emails to: [...]` – about to send
   - `[email] ✅ Confirmation sent to ...` – Resend accepted
   - `[email] Resend API error:` – Resend rejected (e.g. unverified domain / recipient)

## Free Tier Limits

Resend free tier includes:
- 3,000 emails/month
- 100 emails/day
- Perfect for capacity notifications!

