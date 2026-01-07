import { getStripeClient } from "./stripe";
import Stripe from "stripe";

/**
 * Get the capacity for a specific event from environment variables
 */
export function getEventCapacity(eventId: string): number {
  // Try event-specific capacity first (e.g., EVENT_CAPACITY_RENEWAL)
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
    const allEventSessions: any[] = [];
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
  const capacity = getEventCapacity(eventId);
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

