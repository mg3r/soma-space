# Local testing checklist

Use this checklist to test the full flow: event config, single- and multi-ticket checkout, webhook emails, guest waiver signing, admin waiver column and resend, and capacity. Assumes local dev with Stripe CLI for webhooks.

## Prerequisites

**Env and infra**

- [ ] `.env.local` (see [env.example](env.example)): Stripe test keys, `STRIPE_WEBHOOK_SECRET` (from `npm run stripe:listen`), `RESEND_API_KEY`, `WAIVER_GUEST_SECRET`, `ADMIN_PASSWORD`, Supabase URL + service role key, `NEXT_PUBLIC_BASE_URL=http://localhost:3000` for local waiver links.
- [ ] Supabase: Run migrations in order in SQL Editor — [CREATE_EVENT_CONFIG_TABLE.sql](CREATE_EVENT_CONFIG_TABLE.sql), [ADD_MULTI_TICKET_EVENT_CONFIG.sql](ADD_MULTI_TICKET_EVENT_CONFIG.sql), [CREATE_PENDING_ORDERS_AND_GUESTS.sql](CREATE_PENDING_ORDERS_AND_GUESTS.sql), [CREATE_WAIVER_SIGNATURES_TABLE.sql](CREATE_WAIVER_SIGNATURES_TABLE.sql), [ADD_GUEST_IS_EXCLUDED.sql](ADD_GUEST_IS_EXCLUDED.sql) (for admin guest exclude), plus registrations/excluded_registrations from [WEBHOOK_SETUP_GUIDE.md](WEBHOOK_SETUP_GUIDE.md).
- [ ] Two terminals: `npm run dev` in one; `npm run stripe:listen` in the other. Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET` and restart `npm run dev` ([LOCAL_WEBHOOK_SETUP.md](LOCAL_WEBHOOK_SETUP.md)).

**Event config**

- [ ] Admin → Event configuration: One event is **active**, **multi-ticket enabled**, and uses a **primary color that is not green** (e.g. orange/blue) so you can confirm emails use it later.

---

## 1. Single-ticket flow (payer only, no guest emails)

- [ ] Home → enter event password → register with one ticket (don’t add guests).
- [ ] Complete waiver, then Stripe Checkout (use test card `4242 4242 4242 4242`).
- [ ] After payment, confirm Stripe CLI shows `checkout.session.completed` forwarded and dev server logs show webhook running.
- [ ] **Email 1**: Payer receives one “you’re in” confirmation (no waiver link). Check subject/body and that accent color in the email is the **active event primary color** (not green).

---

## 2. Multi-ticket flow (payer + guests, automatic guest emails)

- [ ] Home → event password → register with **2+ tickets** (e.g. 2: yourself + one guest). Enter guest name, email, amount.
- [ ] Complete **payer** waiver only → redirect to Stripe Checkout. Pay; ensure session metadata includes `pending_order_id` (create-checkout sends it when `pendingOrderId` is present).
- [ ] Webhook: In dev logs, confirm lines like:  
  `Multi-ticket: inserting N guest(s) and sending 'you're in' + waiver email to each`  
  and `Guest 'you're in' + waiver email sent to <guest@...>`.
- [ ] **Email 1**: Payer gets one “you’re in” (no waiver link).
- [ ] **Email 2**: Each guest gets one “you’re in” + “sign the participation agreement” link. Open the link; URL should be `/waiver/guest?token=...&email=...`.

---

## 3. Guest waiver signing

- [ ] From the guest “you’re in” email, click “sign the participation agreement”.
- [ ] Guest waiver page loads (token + email validated). Sign and submit.
- [ ] Confirm success; in Supabase, `registration_guests.waiver_signed_at` for that guest is set and `waiver_signatures` has a row for that email.

---

## 4. Admin: waiver column, guest rows, and guest exclude

- [ ] Admin → Overview: Select the same event. Registrations table shows a **Waiver** column: payer and guests listed; guests show “(guest)”.
- [ ] Waiver column: **✓** for signed, **—** for not signed. For guests who have not signed, a **“resend waiver”** button appears next to the dash.
- [ ] For guest rows, **actions** column shows **exclude** / **un-exclude**. Exclude a guest (e.g. can’t make it); confirm they show “(excluded)” and no longer count toward capacity. Un-exclude and confirm they count again.

---

## 5. Resend waiver (Email 3 + active color + “gathering”)

- [ ] In Admin, for a guest who has **not** signed, click **resend waiver**.
- [ ] Guest receives the waiver-only email (no event details, only “please sign the participation agreement” and the link).
- [ ] Copy: “you’re registered for an upcoming soma space **gathering**” (not “evening”).
- [ ] Email accent color (header line, link, footer “entersoma.space”) uses the **active event primary color**, not green.

---

## 6. Capacity

- [ ] Admin → Overview: “registered” / capacity counts include **payer + all guests** (e.g. one order with 1 payer + 2 guests = 3 toward capacity). **Active** count (and remaining spots) excludes any guest or payer you marked **excluded**; refunded are still counted unless excluded.

---

## 7. When you're ready for production

- [ ] **Deploy** the app (e.g. push to main if Vercel auto-deploys).
- [ ] **Supabase**: Run the same migrations in your **production** project (including [ADD_GUEST_IS_EXCLUDED.sql](ADD_GUEST_IS_EXCLUDED.sql) if you use guest exclude).
- [ ] **Env (e.g. Vercel)**: Set `NEXT_PUBLIC_BASE_URL` to your live URL (e.g. `https://www.entersoma.space`), and ensure both www and non-www point to the same app so waiver links work ([WAIVER_SETUP.md](WAIVER_SETUP.md)).
- [ ] **Stripe**: Add a **production** webhook endpoint for your live URL and set `STRIPE_WEBHOOK_SECRET` in production to that endpoint's signing secret ([WEBHOOK_SETUP_GUIDE.md](WEBHOOK_SETUP_GUIDE.md)).
- [ ] **Resend**: Verify your sending domain for production deliverability.

---

## Quick reference

| What | Where to look |
|------|----------------|
| Webhook not firing | Stripe CLI terminal + `STRIPE_WEBHOOK_SECRET` in `.env.local`; restart dev server |
| No guest emails | Webhook logs for `pending_order_id` and “Multi-ticket: inserting”; confirm multi-ticket path in create-checkout and webhook |
| Guest link invalid | `WAIVER_GUEST_SECRET` set and same as when token was created; `NEXT_PUBLIC_BASE_URL` correct for links |
| Resend email still green | Admin “active” event config has a non-green `primary_color`; resend-waiver uses `getActiveEventConfig()` |
