# Refund tracking (admin + Supabase)

Refunds are **not** stored in a separate table. They are stored on the existing **`registrations`** table via the **`refunded_at`** column.

## How it works

1. **Stripe** sends a `charge.refunded` webhook when you refund a payment.
2. The webhook finds the checkout session (from payment intent metadata or Stripe API) and updates **`registrations.refunded_at`** for that `session_id`.
3. The **admin dashboard** reads `refunded_at` to show “(refunded)” next to the row and to include that amount in the **refunded** metric. Refunded registrations are **not** auto-excluded from capacity.

## If refunds don’t show in admin or Supabase

Stripe returning 200 just means the webhook ran. If nothing appears in the admin or Supabase, usually:

### 1. Production Supabase is missing the column

The **live** Supabase project (the one used when `APP_MODE=live`) must have the **`refunded_at`** column on `registrations`.

**Fix:** In the **Supabase SQL Editor** for that project, run either:

- **`ADD_REFUNDED_AT.sql`** (adds only `refunded_at`), or  
- **`SYNC_REGISTRATIONS_TABLE.sql`** (adds `refunded_at` and any other missing columns/indexes).

After that, new refunds will update `registrations.refunded_at` and show in the admin.

### 2. Webhook can’t find the session or no row to update

The webhook looks up the checkout session from the refunded charge (payment intent metadata or listing sessions). If it can’t find a session, or the registration for that session doesn’t exist in **this** Supabase project (e.g. different project or the registration was never synced), the update will not run.

Check your **Vercel (or server) logs** for the webhook. You’ll see one of:

- `charge.refunded: could not find session_id for charge` → session lookup failed.
- `charge.refunded: failed to set refunded_at for ... column ... does not exist` → run the SQL above in that Supabase project.
- `charge.refunded: no row updated for session_id` → no row with that `session_id` in `registrations` (wrong project or registration not synced).

### 3. APP_MODE / Supabase project mismatch

The webhook uses the same Supabase client as the rest of the app (via `APP_MODE` and `NEXT_PUBLIC_SUPABASE_URL_LIVE` / `SUPABASE_SERVICE_ROLE_KEY_LIVE`). If the dashboard and webhook use different projects, refunds will be written to one project and the admin will read from the other. Ensure **one** live Supabase project and that both the app and webhook use it when `APP_MODE=live`.

## Summary

- **No new table.** Use **`registrations.refunded_at`**.
- **Production:** Run **`ADD_REFUNDED_AT.sql`** or **`SYNC_REGISTRATIONS_TABLE.sql`** in the **live** Supabase SQL Editor.
- **Debugging:** Use webhook logs (and the hints above) to see whether the problem is missing column, session lookup, or wrong project.
