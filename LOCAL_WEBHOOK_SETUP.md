# Local webhook setup (Stripe CLI)

**Registrations only get saved to Supabase when the Stripe webhook runs.** On localhost, Stripe can’t reach your app unless you forward webhooks. Without this setup, test checkouts will not appear in Supabase or in the admin dashboard.

**What to do:** Run `npm run stripe:listen` in a second terminal, copy the `whsec_...` secret from the output, add `STRIPE_WEBHOOK_SECRET=whsec_...` to `.env.local`, then restart `npm run dev`. Details below.

## 1. Install Stripe CLI

**macOS (Homebrew):**
```bash
brew install stripe/stripe-cli/stripe
```

**Windows:** [Download from Stripe](https://github.com/stripe/stripe-cli/releases)

**Or:** [Stripe CLI docs](https://stripe.com/docs/stripe-cli)

Log in once:
```bash
stripe login
```

## 2. Start webhook forwarding

**Use the directory that has your Next.js app** (the folder with `package.json` that has the `stripe:listen` script). If you see "Missing script: stripe:listen", you're one level up — run `cd soma-space` first (or whatever your app folder is named).

In a **separate terminal** (keep `npm run dev` running in another):

```bash
npm run stripe:listen
```

Or run Stripe CLI directly (works from any directory):

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The CLI will print something like:
```
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 3. Add the secret to .env.local

1. Copy the **webhook signing secret** (`whsec_...`) from the CLI output.
2. In your project root, open `.env.local` and add (or update):

   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. Restart your Next.js dev server (`npm run dev`) so it picks up the new env var.

## 4. Test the flow

1. Leave **both** running: `npm run dev` in one terminal, `npm run stripe:listen` in the other.
2. Go through the flow on localhost (password → register → waiver → checkout).
3. Complete a test payment; the CLI will show the event being forwarded and your app will run the webhook (sync registration, send confirmation email).

If you see `✅ Registration confirmation email sent to …` in the dev server logs, the webhook and email are working.

## Note

The secret from `stripe listen` is only for **local** forwarding. For production (or a deployed URL), use a webhook endpoint in the Stripe Dashboard and set `STRIPE_WEBHOOK_SECRET` to that endpoint’s signing secret (see WEBHOOK_SETUP_GUIDE.md).
