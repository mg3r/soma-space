import { getStripeClient } from "./stripe";
import { supabase } from "./supabase";
import { sendCapacityReachedNotification } from "./email";
import Stripe from "stripe";

/**
 * Get the capacity for a specific event from Supabase (with fallback to env vars)
 */
export async function getEventCapacity(eventId: string): Promise<number> {
  // Try to get from Supabase first (if configured)
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("event_capacities")
        .select("capacity")
        .eq("event_id", eventId)
        .single();

      if (!error && data) {
        return data.capacity;
      }
    } catch (error) {
      console.log("Supabase query failed, falling back to env vars:", error);
    }
  }

  // Fallback to environment variables
  const eventSpecificCapacity = process.env[`EVENT_CAPACITY_${eventId}`];
  if (eventSpecificCapacity) {
    return parseInt(eventSpecificCapacity, 10);
  }
  
  // Fall back to global capacity
  const globalCapacity = process.env.EVENT_CAPACITY;
  if (globalCapacity) {
    return parseInt(globalCapacity, 10);
  }
  
  // Default to 22 if not set
  return 22;
}

/**
 * Set the capacity for a specific event in Supabase
 */
export async function setEventCapacity(eventId: string, capacity: number): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  try {
    // Upsert (insert or update) the capacity
    const { error } = await supabase
      .from("event_capacities")
      .upsert(
        {
          event_id: eventId,
          capacity: capacity,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "event_id",
        }
      );

    if (error) {
      console.error("Error setting capacity in Supabase:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error setting capacity:", error);
    throw error;
  }
}

/**
 * Count the number of paid registrations for a specific event
 */
export async function countEventRegistrations(eventId: string): Promise<number> {
  const stripe = getStripeClient();
  
  try {
    let count = 0;
    let hasMore = true;
    let startingAfter: string | undefined = undefined;
    
    // Paginate through all sessions to get accurate count
    while (hasMore) {
      const sessions: Stripe.Response<Stripe.ApiList<Stripe.Checkout.Session>> = await stripe.checkout.sessions.list({
        limit: 100,
        starting_after: startingAfter,
      });
      
      // Filter for completed sessions with matching event_id metadata
      const eventSessions = sessions.data.filter(
        (session: Stripe.Checkout.Session) =>
          session.payment_status === "paid" &&
          session.status === "complete" &&
          session.metadata?.event_id === eventId
      );
      
      count += eventSessions.length;
      hasMore = sessions.has_more;
      
      if (sessions.data.length > 0) {
        startingAfter = sessions.data[sessions.data.length - 1].id;
      }
    }
    
    return count;
  } catch (error) {
    console.error(`Error counting registrations for event ${eventId}:`, error);
    throw error;
  }
}

/**
 * Get all registrations for a specific event
 */
export async function getEventRegistrations(eventId: string) {
  const stripe = getStripeClient();
  
  try {
    type RegistrationData = {
      sessionId: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      amountPaid: number;
      paymentDate: string;
      eventId: string;
    };
    
    const allEventSessions: RegistrationData[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;
    
    // Paginate through all sessions to get all registrations
    while (hasMore) {
      const sessions: Stripe.Response<Stripe.ApiList<Stripe.Checkout.Session>> = await stripe.checkout.sessions.list({
        limit: 100,
        starting_after: startingAfter,
      });
      
      // Filter for completed sessions with matching event_id
      const eventSessions = sessions.data
        .filter(
          (session: Stripe.Checkout.Session) =>
            session.payment_status === "paid" &&
            session.status === "complete" &&
            session.metadata?.event_id === eventId
        )
        .map((session: Stripe.Checkout.Session) => {
          // Get the amount paid from line items
          const amountTotal = session.amount_total || 0;
          const amountPaid = amountTotal / 100; // Convert from cents to dollars
          
          return {
            sessionId: session.id,
            customerName: session.customer_details?.name || "N/A",
            customerEmail: session.customer_details?.email || "N/A",
            customerPhone: session.customer_details?.phone || "N/A",
            amountPaid: amountPaid,
            paymentDate: new Date(session.created * 1000).toISOString(),
            eventId: session.metadata?.event_id || eventId,
          };
        });
      
      allEventSessions.push(...eventSessions);
      hasMore = sessions.has_more;
      
      if (sessions.data.length > 0) {
        startingAfter = sessions.data[sessions.data.length - 1].id;
      }
    }
    
    // Sort by payment date (newest first)
    return allEventSessions.sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );
  } catch (error) {
    console.error(`Error getting registrations for event ${eventId}:`, error);
    throw error;
  }
}

/**
 * Get summary statistics for an event
 */
export async function getEventStats(eventId: string) {
  const registrations = await getEventRegistrations(eventId);
  const capacity = await getEventCapacity(eventId);
  const count = registrations.length;
  const totalRevenue = registrations.reduce((sum, reg) => sum + reg.amountPaid, 0);
  const remainingSpots = Math.max(0, capacity - count);
  
  return {
    eventId,
    capacity,
    registered: count,
    remainingSpots,
    totalRevenue,
    averageContribution: count > 0 ? totalRevenue / count : 0,
  };
}

/**
 * Add someone to the waitlist
 */
export async function addToWaitlist(
  eventId: string,
  name: string,
  email: string,
  phone?: string
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured. Cannot add to waitlist.");
  }

  try {
    const { error } = await supabase.from("waitlist").insert({
      event_id: eventId,
      name: name,
      email: email,
      phone: phone || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error adding to waitlist:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error adding to waitlist:", error);
    throw error;
  }
}

/**
 * Get waitlist entries for an event
 */
export async function getWaitlistEntries(eventId: string) {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("waitlist")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching waitlist:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching waitlist:", error);
    return [];
  }
}

/**
 * Check if event just reached capacity and send notification
 */
export async function checkAndNotifyCapacityReached(
  eventId: string,
  capacity: number,
  currentCount: number
): Promise<void> {
  // Only notify if we just hit exactly the capacity (not over)
  if (currentCount === capacity) {
    console.log(`🎯 Event ${eventId} has reached capacity (${capacity} spots filled)`);
    
    // Get event name for notification
    const eventName = eventId === "RENEWAL" ? "RENEWAL" : eventId;
    
    // Send email notification
    await sendCapacityReachedNotification(eventId, eventName, capacity);
  }
}

