# Soma Space - Project Summary

## Current Status: ✅ Fully Operational

All systems are live and working. The application handles event registrations, capacity management, waitlists, and admin dashboard functionality.

---

## 🎯 Core Functionality

### Public-Facing Pages

1. **Homepage (`/`)**
   - Interactive chat interface
   - Password-protected access to event details
   - Capacity-aware: Shows "join waitlist" if event is full
   - Waitlist collection flow (first name, last name, email, phone)
   - Direct link to manifesto

2. **Reserve Page (`/reserve`)**
   - Password-protected booking page
   - Sliding scale contribution selector ($22-$44)
   - Real-time capacity display (shows remaining spots when ≤10)
   - Waitlist form when event is full
   - Stripe Checkout integration

3. **Welcome Page (`/welcome`)**
   - Post-payment confirmation page
   - Verifies Stripe payment via session ID
   - Displays event details and location
   - Link to manifesto
   - Mobile-optimized layout

4. **Manifesto Page (`/manifesto`)**
   - Event philosophy and guidelines
   - Updated with "shared contribution" language

### Admin Dashboard (`/admin`)

**Features:**
- ✅ Session-based authentication (30-day cookie, remembers login)
- ✅ Event selector (currently: RENEWAL)
- ✅ Real-time statistics:
  - Registered count / Capacity
  - Remaining spots
  - Total revenue
  - Average contribution
  - Waitlist count
- ✅ Registration management:
  - View all registrations (name, email, phone, amount, date)
  - Exclude/unexclude registrations
  - Visual indicators for excluded registrations
- ✅ Capacity management:
  - Update capacity in real-time (stored in Supabase)
  - No redeploy needed
- ✅ Waitlist management:
  - View all waitlist entries
  - See who joined and when

---

## 🗄️ Database Architecture (Supabase)

### Tables

1. **`registrations`**
   - Stores all event registrations synced from Stripe
   - Fields: session_id, event_id, customer info, amount, payment_date, is_excluded
   - Auto-synced via webhook on payment completion

2. **`excluded_registrations`**
   - Tracks excluded registrations (duplicates, refunds)
   - Fields: session_id, event_id, customer info, reason
   - Excluded registrations don't count toward capacity/revenue

3. **`event_capacities`**
   - Dynamic capacity management per event
   - Fields: event_id, capacity
   - Updated from admin dashboard

4. **`waitlist`**
   - Stores waitlist entries
   - Fields: event_id, name, email, phone, created_at

---

## 🔄 Stripe Integration

### Payment Flow
1. User selects contribution amount ($22-$44)
2. Creates Stripe Checkout Session with:
   - Dynamic price based on user selection
   - Product image and description
   - Email and phone collection enabled
   - Event metadata (event_id, event_name, event_date)
3. User completes payment in Stripe
4. Redirects to `/welcome` page
5. Webhook syncs registration to Supabase

### Webhook Events
- **`checkout.session.completed`**: Auto-syncs new registrations to Supabase
- **`charge.refunded`**: Auto-excludes refunded registrations

### Payment Intent Metadata
- Session ID stored in payment intent metadata for refund tracking
- Allows system to find checkout session when refund happens

---

## 🚫 Exclusion System

### How It Works
- **Manual Exclusion**: Click "exclude" in admin dashboard
- **Automatic Exclusion**: Refund in Stripe → webhook auto-excludes
- **Effects**:
  - Removed from capacity count
  - Removed from revenue calculations
  - Still visible in dashboard (grayed out with "(excluded)" label)
  - Can be un-excluded

### Data Storage
- `excluded_registrations` table stores exclusion records
- `registrations.is_excluded` flag for fast queries
- Customer info (name, email, phone) stored in excluded_registrations

---

## 📧 Email Notifications

- **Capacity Reached**: Sends email to `ADMIN_EMAIL` when event reaches capacity
- **Provider**: Resend API
- **Config**: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` env vars

---

## 🔐 Authentication

### Public Pages
- `/reserve`: Protected with `EVENT_PASSWORD`
- Homepage chat: Protected with `EVENT_PASSWORD`

### Admin Dashboard
- Protected with `ADMIN_PASSWORD`
- Session-based (30-day cookie)
- Auto-login on return visits
- Sign out functionality

---

## 📱 Mobile Optimizations

- Input fields use `text-base` (16px) to prevent zoom on focus
- `/welcome` page: Wider text column, smaller spiral on mobile
- Responsive layouts throughout

---

## 🎨 UI/UX Features

- Fade-in animations on welcome page
- Typing indicators in chat
- Visual capacity indicators (remaining spots when ≤10)
- Clean, minimal dark theme
- Green accent color (#05fd00) for CTAs

---

## 🔧 Technical Stack

- **Framework**: Next.js 15.5.9 (App Router)
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe Checkout Sessions API
- **Email**: Resend API
- **Deployment**: Vercel
- **Version Control**: GitHub

---

## 📋 Environment Variables

### Required
- `STRIPE_MODE` (test/live)
- `STRIPE_SECRET_KEY_TEST` or `STRIPE_SECRET_KEY_LIVE`
- `STRIPE_WEBHOOK_SECRET`
- `EVENT_PASSWORD`
- `ADMIN_PASSWORD`
- `ADMIN_EMAIL`

### Optional (with fallbacks)
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `EVENT_CAPACITY` (fallback if Supabase not configured)
- `EVENT_CAPACITY_{EVENT_ID}` (event-specific fallback)
- `NEXT_PUBLIC_BASE_URL`

---

## 📊 Current Event Configuration

**Event**: RENEWAL
- Date: Friday, 1/23
- Time: 7:00–9:30 pm
- Location: Farfields Farm
- Capacity: Managed in Supabase (default: 22)

---

## 🚀 Recent Improvements

1. ✅ Supabase registrations table for faster queries
2. ✅ Automatic webhook syncing for new registrations
3. ✅ Exclusion system with customer info tracking
4. ✅ Auto-exclude on Stripe refunds
5. ✅ Session-based admin authentication
6. ✅ Real-time capacity management
7. ✅ Waitlist system with full data collection
8. ✅ Email notifications for capacity reached
9. ✅ Mobile optimizations
10. ✅ Legacy registration support (sessions without metadata)

---

## 📚 Documentation Files

- `STRIPE_SETUP.md` - Stripe configuration guide
- `SUPABASE_SETUP.md` - Database setup instructions
- `WEBHOOK_SETUP_GUIDE.md` - Webhook configuration walkthrough
- `REGISTRATIONS_SETUP.md` - Registration system overview
- `EXCLUSION_SYSTEM.md` - Exclusion system guide
- `ADMIN_DASHBOARD.md` - Admin dashboard documentation
- `WAITLIST_SETUP.md` - Waitlist system guide
- `UPDATE_SUPABASE_SCHEMA.sql` - Database migration script
- `EMAIL_SETUP.md` - Email notification setup

---

## ✅ System Health

- **Stripe**: ✅ Configured (Live mode)
- **Supabase**: ✅ Configured and operational
- **Webhooks**: ✅ Configured and working
- **Email**: ✅ Configured (Resend)
- **Admin Auth**: ✅ Session-based, working
- **Capacity Management**: ✅ Dynamic, Supabase-backed
- **Exclusion System**: ✅ Fully functional
- **Waitlist**: ✅ Operational

---

## 🎯 Next Steps (When Needed)

1. **New Event**: Update `src/config/event.ts` with new event details
2. **Capacity Change**: Update in admin dashboard (no code changes needed)
3. **View Old Events**: Add to admin dashboard event selector dropdown

---

**Last Updated**: January 2025  
**Status**: Production Ready ✅

