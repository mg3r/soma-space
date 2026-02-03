# Soma Space

Event registration, waitlist, and admin for soma space gatherings. Built with Next.js, Stripe, Supabase, and Resend.

## Quick start

```bash
npm install
npm run dev
```

Copy `env.example` to `.env.local` and fill in the values. See the docs below for required env vars and setup.

Open [http://localhost:3000](http://localhost:3000).

## Docs

- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** — Overview of features, architecture, and database.
- **[env.example](./env.example)** — Required environment variables (Stripe, Supabase, Resend, admin password, etc.).

Setup guides:

- [STRIPE_SETUP.md](./STRIPE_SETUP.md) — Stripe checkout and webhooks
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) — Database and schema
- [EMAIL_SETUP.md](./EMAIL_SETUP.md) — Resend and admin email
- [WEBHOOK_SETUP_GUIDE.md](./WEBHOOK_SETUP_GUIDE.md) — Stripe webhook configuration
- [TESTING_SETUP.md](./TESTING_SETUP.md), [WAITLIST_SETUP.md](./WAITLIST_SETUP.md), [WAIVER_SETUP.md](./WAIVER_SETUP.md), and others as needed.

## Deploy

Deploy to [Vercel](https://vercel.com). Configure environment variables in the Vercel dashboard (see `env.example`). For production, set `APP_MODE=live` and use live Stripe/Supabase keys.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
