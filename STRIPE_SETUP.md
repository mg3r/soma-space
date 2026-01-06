# Stripe Test/Live Mode Setup

This project supports both Stripe test mode and live mode. By default, it runs in **test mode** for safety.

## Environment Variables

### Local Development (.env.local)

```bash
# Stripe Mode: 'test' or 'live' (defaults to 'test' if not set)
STRIPE_MODE=test

# Test Mode Keys (for testing - no real charges)
STRIPE_SECRET_KEY_TEST=sk_test_...

# Live Mode Keys (for production - real charges)
STRIPE_SECRET_KEY_LIVE=sk_live_...

# Fallback (if you only want to use one key, set this)
# STRIPE_SECRET_KEY=sk_test_... or sk_live_...

# Other variables
EVENT_PASSWORD=123
NEXT_PUBLIC_EVENT_NAME=soma space
NEXT_PUBLIC_BASE_URL=https://entersoma.space
```

### Vercel Environment Variables

**For Preview/Development:**
- `STRIPE_MODE` = `test`
- `STRIPE_SECRET_KEY_TEST` = `sk_test_...`

**For Production:**
- `STRIPE_MODE` = `live`
- `STRIPE_SECRET_KEY_LIVE` = `sk_live_...`

## Switching Between Test and Live Mode

Simply change the `STRIPE_MODE` environment variable:

- **Test Mode**: `STRIPE_MODE=test` (default)
- **Live Mode**: `STRIPE_MODE=live`

## Test Cards

When in test mode, use these Stripe test cards:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Authentication**: `4000 0025 0000 3155`

For all test cards:
- Use any future expiration date (e.g., 12/34)
- Use any 3-digit CVC
- Use any ZIP code

## Getting Your Keys

1. **Test Keys**: https://dashboard.stripe.com/test/apikeys
2. **Live Keys**: https://dashboard.stripe.com/apikeys (toggle to "Live mode")

## Important Notes

- Test mode keys start with `sk_test_` and `pk_test_`
- Live mode keys start with `sk_live_` and `pk_live_`
- Test payments don't charge real money
- Test payments appear in Stripe Dashboard under "Test mode"
- The code will warn you if you're using the wrong key type for the selected mode

