# Admin Dashboard Setup

## Overview

The admin dashboard allows you to:
- View all registrations for each event
- See customer details (name, email, phone, contribution amount)
- Track capacity and remaining spots
- Update event capacity limits
- View summary statistics (total revenue, average contribution, etc.)

## Setup Instructions

### 1. Environment Variables

Add these to your Vercel environment variables:

```bash
# Admin password (required)
ADMIN_PASSWORD=nfuwehiu8236!JNBjX*noob

# Event capacity (optional - defaults to 22 if not set)
EVENT_CAPACITY_RENEWAL=22
# Or use a global capacity for all events:
EVENT_CAPACITY=22
```

### 2. Access the Dashboard

Navigate to: `https://entersoma.space/admin`

Enter your admin password to access the dashboard.

### 3. Features

**Event Selection:**
- Currently supports "RENEWAL" event
- Dropdown selector to switch between events (add more events in the code as needed)

**Registration List:**
- Shows all paid registrations for the selected event
- Displays: Name, Email, Phone, Contribution Amount, Payment Date
- Sorted by most recent first

**Capacity Management:**
- View current capacity for the event
- Update capacity (note: you'll need to update environment variables in Vercel for changes to persist)
- Shows remaining spots in real-time

**Statistics:**
- Total registered count
- Current capacity
- Remaining spots
- Total revenue
- Average contribution amount

## How It Works

1. **Event Tracking:** Each checkout session includes metadata (`event_id`, `event_name`, `event_date`) to identify which event it belongs to.

2. **Capacity Checking:** Before creating a checkout session, the system checks if the event has reached capacity. If full, users see a message: "This event is full. All X spots have been reserved. Please reach out if you'd like to be added to the waitlist."

3. **Data Source:** All registration data comes directly from Stripe checkout sessions. No database required!

## Adding New Events

To add a new event:

1. Update `src/config/event.ts` with the new event details
2. Add the event ID to the dropdown in `src/app/admin/page.tsx`
3. Set `EVENT_CAPACITY_[EVENT_ID]` in Vercel environment variables

## Notes

- Capacity updates in the dashboard are noted, but you must update environment variables in Vercel for them to take effect permanently
- The system paginates through all Stripe sessions to get accurate counts (handles 100+ registrations)
- All data is read-only from Stripe - no data is stored locally

