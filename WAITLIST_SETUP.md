# Waitlist System Setup

## Overview

The waitlist system allows users to sign up when an event is full. Waitlist entries are stored in Supabase and visible in the admin dashboard.

## Supabase Table Setup

Run this SQL in your Supabase SQL Editor:

```sql
-- Create waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_waitlist_event_id ON waitlist(event_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
```

## Features

### 1. **Remaining Spots Indicator**
- Shows on `/reserve` page: "X spots remaining" or "this event is full"
- Updates in real-time when page loads

### 2. **Waitlist Form**
- Automatically shown when:
  - User tries to book and event is full
  - Event is already full when page loads
- Collects: Name, Email, Phone (optional)
- Success message after submission

### 3. **Admin Dashboard**
- View all waitlist entries in `/admin`
- Shows: Name, Email, Phone, Date joined
- Filtered by selected event

### 4. **Email Notifications** (Optional)

To enable email notifications when capacity is reached:

1. **Option A: Using Resend (Recommended)**
   ```bash
   npm install resend
   ```
   
   Add to Vercel environment variables:
   ```bash
   RESEND_API_KEY=re_xxxxx
   ADMIN_EMAIL=your-email@example.com
   ```
   
   Then uncomment the Resend code in `src/lib/email.ts`

2. **Option B: Using SendGrid**
   - Install SendGrid package
   - Update `src/lib/email.ts` with SendGrid integration

3. **Option C: Custom Email Service**
   - Update `src/lib/email.ts` with your preferred service

## How It Works

1. **User tries to book when full:**
   - Checkout API detects capacity reached
   - Returns `isFull: true` flag
   - Reserve page shows waitlist form

2. **User submits waitlist:**
   - Data saved to Supabase `waitlist` table
   - Success message shown
   - Entry appears in admin dashboard

3. **Admin views waitlist:**
   - Go to `/admin` dashboard
   - Select event
   - See all waitlist entries below registrations

## Testing

1. Set event capacity to a low number (e.g., 2)
2. Book 2 spots
3. Try to book a 3rd spot
4. Waitlist form should appear
5. Submit waitlist entry
6. Check admin dashboard to see entry

## Notes

- Waitlist entries are stored per event (filtered by `event_id`)
- Phone number is optional
- All waitlist data is visible in admin dashboard
- Email notifications are logged to console by default (set up email service for actual emails)

