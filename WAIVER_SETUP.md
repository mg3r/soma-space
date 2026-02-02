# Waiver (Participation Agreement) Setup

## Overview

Before registering for an event, users are asked for first name, last name, and email. If they haven’t signed the waiver before, they’re sent to a waiver page to read and sign; then they continue to Stripe payment. If they’ve already signed (matched by email), they skip the waiver and go straight to checkout.

## Flow

1. **Chat (home page)**  
   User unlocks with password → sees “reserve your spot” with amount and button.

2. **Register**  
   Clicking “reserve your spot” starts the register flow: bot asks **first name** → **last name** → **email** (we use email to remember who has signed).

3. **Waiver check**  
   We call `/api/waiver/check?email=...`:
   - **Already signed:** user goes straight to Stripe checkout (same amount).
   - **Not signed:** user is redirected to `/waiver?firstName=...&lastName=...&email=...&amount=...`.

4. **Waiver page**  
   User reads the full agreement, checks “I have read and agree,” types their full name to sign, then clicks “Sign agreement.” We record the signature via `/api/waiver/sign`. Then they click “Continue to payment” to go to Stripe checkout.

5. **Future visits**  
   Same email → waiver check finds a signature → skip waiver and go to checkout.

## Database (Supabase)

Run the migration in **test** first, then in **production**:

1. Open your Supabase project (test or production).
2. Go to **SQL Editor**.
3. Run the contents of `CREATE_WAIVER_SIGNATURES_TABLE.sql`.

That creates the `waiver_signatures` table (email, first_name, last_name, signed_at, ip_address, user_agent, waiver_version). Signatures are keyed by email so we can “remember” who has signed.

## Changing the waiver text

The default participation agreement is in `src/app/waiver/page.tsx` as `DEFAULT_WAIVER_TEXT`. Edit that constant to change the wording. For a separate legal version (e.g. waiver_version in DB), you can add a version identifier when updating the text and optionally store it in the database.

## APIs

- **GET `/api/waiver/check?email=...`**  
  Returns `{ signed: true | false }`. Used to decide whether to send the user to the waiver page or checkout.

- **POST `/api/waiver/sign`**  
  Body: `{ email, firstName, lastName }`. Records a waiver signature (and optional IP/user-agent server-side). Returns `{ success: true }` or an error.

## Testing

1. Use **test** Stripe and **test** Supabase (run the waiver SQL there).
2. Unlock the chat, choose an amount, click “reserve your spot.”
3. Enter first name, last name, email when asked.
4. First time: you should be sent to `/waiver`, sign, then “Continue to payment” → Stripe.
5. Second time (same email): after entering name/email, you should go straight to Stripe without the waiver page.

## Guest waiver (multi-ticket)

Guests receive an email with a link to **sign the participation agreement** at `/waiver/guest?token=...&email=...`. The page lives at `src/app/waiver/guest/page.tsx`; the API is `GET/POST /api/waiver/guest`. Links are built using `NEXT_PUBLIC_BASE_URL` (webhook and resend-waiver API).

## Production

When ready:

1. Run `CREATE_WAIVER_SIGNATURES_TABLE.sql` in your **production** Supabase project.
2. Deploy the app; no extra env vars are required beyond existing Supabase and Stripe config.
3. Set **`NEXT_PUBLIC_BASE_URL`** in production to your canonical URL (e.g. `https://www.entersoma.space` or `https://entersoma.space`) so guest waiver links in emails point to the same host users visit.

### 404 on /waiver/guest in production

If guests get a **404** when clicking the waiver link:

1. **Deploy the latest code**  
   The route is `src/app/waiver/guest/page.tsx`. Ensure production has been redeployed so this page exists (e.g. push to main if Vercel auto-deploys, or trigger a new deploy).

2. **Match www and non-www**  
   If the link in the email uses one host (e.g. `https://entersoma.space`) but the user visits the other (e.g. `https://www.entersoma.space`), they might hit a different server that doesn’t have the app. Set `NEXT_PUBLIC_BASE_URL` to the canonical domain you use (e.g. `https://www.entersoma.space`), and in Vercel (or your host) ensure both `www.entersoma.space` and `entersoma.space` point to the **same** Next.js project so `/waiver/guest` works from either.
