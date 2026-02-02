# Event and Stripe Integration Guide

## How Events Work with Stripe

### Overview
Events are **not** created as separate products in Stripe. Instead, we use **metadata** to distinguish between different events. This is a lightweight approach that doesn't require creating new Stripe products for each event.

### How It Works

1. **Event Configuration (Supabase)**
   - Each event is stored in the `event_config` table in Supabase
   - Each event has a unique `event_id` (e.g., "RENEWAL", "SPRING2025", etc.)
   - Only one event can be `is_active = true` at a time

2. **Checkout Session Creation**
   - When a user clicks to reserve a spot, `/api/create-checkout` is called
   - This endpoint:
     - Gets the **active event config** using `getActiveEventConfig()`
     - Creates a Stripe checkout session with the active event's details
     - **Crucially**: Adds `event_id` to the checkout session's `metadata`:
       ```javascript
       metadata: {
         event_id: eventId,
         event_name: eventConfig.event_name,
         event_date: eventConfig.event_date,
       }
       ```

3. **Payment Processing (Stripe Webhook)**
   - When payment is completed, Stripe sends a webhook to `/api/webhooks/stripe`
   - The webhook:
     - Extracts `event_id` from the session's `metadata`
     - Stores the registration in Supabase with the correct `event_id`
     - Sends confirmation email using the **specific event's config** (not the active one)

4. **Registration Storage**
   - All registrations are stored in the `registrations` table in Supabase
   - Each registration has an `event_id` column that links it to the event
   - This allows filtering registrations by event

5. **Admin Dashboard**
   - The admin dashboard shows registrations, stats, and waitlist filtered by `event_id`
   - When you select a different event in the dropdown, it queries:
     - `/api/admin/registrations?eventId=EVENT_ID`
     - `/api/admin/stats?eventId=EVENT_ID`
     - `/api/admin/waitlist?eventId=EVENT_ID`

### Key Points

✅ **No Stripe Products Needed**: We don't create separate Stripe products for each event. We use the same checkout flow with different metadata.

✅ **Metadata is Key**: The `event_id` in the checkout session metadata is what distinguishes one event from another.

✅ **Active Event vs Selected Event**: 
   - **Active Event**: The event that's currently accepting registrations (used for checkout)
   - **Selected Event**: The event you're viewing in the admin dashboard (used for filtering data)

✅ **Legacy Support**: Old registrations without `event_id` metadata default to "RENEWAL" for backward compatibility.

### Creating a New Event

1. **Create Event Config in Admin Dashboard**:
   - Go to "Event Configuration" tab
   - Click "Create New Event Configuration" or "Save as New Event"
   - Fill in event details (name, date, time, address, etc.)
   - Set colors, Stripe amounts, capacity, etc.
   - **Important**: Set `is_active = true` to make it the active event (this will deactivate the previous active event)

2. **No Stripe Setup Required**:
   - You don't need to create anything in Stripe
   - The checkout will automatically use the new event's details
   - The `event_id` will be automatically added to checkout metadata

3. **Test the Flow**:
   - Make sure the new event is set as active
   - Go through the checkout flow
   - Verify the registration appears in the admin dashboard for that event
   - Check that the confirmation email uses the correct event details

### Troubleshooting

**Issue**: Registrations showing up under wrong event
- **Check**: Make sure the checkout session has `event_id` in metadata
- **Check**: Verify the webhook is extracting `event_id` correctly
- **Check**: Old registrations without metadata default to "RENEWAL"

**Issue**: Admin dashboard not showing correct data
- **Check**: Make sure `selectedEvent` state is set correctly
- **Check**: Verify API endpoints are filtering by `eventId` correctly
- **Check**: Ensure `loadData()` is called when `selectedEvent` changes

**Issue**: Email using wrong event details
- **Check**: Webhook should use `getEventConfigByEventId(finalEventId)` not `getActiveEventConfig()`
- **Check**: The `event_id` from session metadata should match the event config

### Database Schema

**event_config table**:
- `event_id` (unique identifier, e.g., "RENEWAL")
- `event_name`, `event_date`, `event_time`, etc.
- `is_active` (boolean, only one can be true)

**registrations table**:
- `session_id` (Stripe checkout session ID)
- `event_id` (links to event_config)
- `customer_name`, `customer_email`, `amount_paid`, etc.

**excluded_registrations table**:
- `session_id`
- `event_id` (for filtering exclusions by event)

**waitlist table**:
- `event_id` (for filtering waitlist by event)
