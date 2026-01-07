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
 * Check if a Stripe Checkout Session is a soma space registration
 * This handles both new sessions (with event_id metadata) and legacy sessions (without metadata)
 */
function isSomaSpaceRegistration(
  session: Stripe.Checkout.Session,
  eventId: string
): boolean {
  // Must be paid and complete
  if (session.payment_status !== "paid" || session.status !== "complete") {
    return false;
  }

  // New sessions: has matching event_id metadata
  if (session.metadata?.event_id === eventId) {
    return true;
  }

  // Legacy sessions: check if it's a soma space registration
  // by verifying amount range and success URL
  const amountTotal = session.amount_total || 0;
  const amountInDollars = amountTotal / 100;
  const successUrl = session.success_url || "";

  // Must be in soma space price range ($22-44)
  const isInPriceRange = amountInDollars >= 22 && amountInDollars <= 44;

  // Must have soma space success URL (contains /welcome and your domain)
  const hasSomaSpaceUrl =
    successUrl.includes("/welcome") &&
    (successUrl.includes("entersoma.space") ||
      successUrl.includes("localhost:3000"));

  return isInPriceRange && hasSomaSpaceUrl;
}

/**
 * Get excluded session IDs for an event
 */
async function getExcludedSessionIds(eventId: string): Promise<Set<string>> {
  if (!supabase) {
    return new Set();
  }

  try {
    const { data, error } = await supabase
      .from("excluded_registrations")
      .select("session_id")
      .eq("event_id", eventId);

    if (error) {
      console.error("Error fetching excluded registrations:", error);
      return new Set();
    }

    return new Set(data?.map((row) => row.session_id) || []);
  } catch (error) {
    console.error("Error in getExcludedSessionIds:", error);
    return new Set();
  }
}

/**
 * Count the number of paid registrations for a specific event
 * Uses Supabase if available, falls back to Stripe
 * Excludes excluded registrations
 */
export async function countEventRegistrations(eventId: string): Promise<number> {
  // Try Supabase first (faster)
  if (supabase) {
    try {
      const excludedIds = await getExcludedSessionIds(eventId);

      const { count, error } = await supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId);

      if (!error && count !== null) {
        // Subtract excluded registrations
        const excludedCount = excludedIds.size;
        return Math.max(0, count - excludedCount);
      }
    } catch (error) {
      console.log("Supabase count failed, falling back to Stripe:", error);
    }
  }

  // Fallback to Stripe
  const stripe = getStripeClient();
  const excludedIds = await getExcludedSessionIds(eventId);

  try {
    let count = 0;
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    // Paginate through all sessions to get accurate count
    while (hasMore) {
      const sessions: Stripe.Response<Stripe.ApiList<Stripe.Checkout.Session>> =
        await stripe.checkout.sessions.list({
          limit: 100,
          starting_after: startingAfter,
        });

      // Filter for soma space registrations (with metadata or legacy)
      const eventSessions = sessions.data.filter(
        (session: Stripe.Checkout.Session) =>
          isSomaSpaceRegistration(session, eventId) &&
          !excludedIds.has(session.id)
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

type RegistrationData = {
  sessionId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amountPaid: number;
  paymentDate: string;
  eventId: string;
  notes?: string;
  isExcluded?: boolean;
};

/**
 * Get all registrations for a specific event
 * Uses Supabase if available, falls back to Stripe
 * Includes excluded registrations (marked with isExcluded flag)
 */
export async function getEventRegistrations(
  eventId: string
): Promise<RegistrationData[]> {
  // Try Supabase first (faster)
  if (supabase) {
    try {
      const excludedIds = await getExcludedSessionIds(eventId);

      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .eq("event_id", eventId)
        .order("payment_date", { ascending: false });

      if (!error && data) {
        return data.map((row) => ({
          sessionId: row.session_id,
          customerName: row.customer_name,
          customerEmail: row.customer_email,
          customerPhone: row.customer_phone || "N/A",
          amountPaid: parseFloat(row.amount_paid),
          paymentDate: row.payment_date,
          eventId: row.event_id,
          notes: row.notes || undefined,
          isExcluded: excludedIds.has(row.session_id),
        }));
      }
    } catch (error) {
      console.log("Supabase query failed, falling back to Stripe:", error);
    }
  }

  // Fallback to Stripe
  const stripe = getStripeClient();
  const excludedIds = await getExcludedSessionIds(eventId);

  try {
    const allEventSessions: RegistrationData[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    // Paginate through all sessions to get all registrations
    while (hasMore) {
      const sessions: Stripe.Response<Stripe.ApiList<Stripe.Checkout.Session>> =
        await stripe.checkout.sessions.list({
          limit: 100,
          starting_after: startingAfter,
        });

      // Filter for soma space registrations (with metadata or legacy)
      const eventSessions = sessions.data
        .filter((session: Stripe.Checkout.Session) =>
          isSomaSpaceRegistration(session, eventId)
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
            isExcluded: excludedIds.has(session.id),
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
      (a, b) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );
  } catch (error) {
    console.error(`Error getting registrations for event ${eventId}:`, error);
    throw error;
  }
}

/**
 * Get summary statistics for an event
 * Excludes excluded registrations from counts and revenue
 */
export async function getEventStats(eventId: string) {
  const registrations = await getEventRegistrations(eventId);
  const capacity = await getEventCapacity(eventId);
  
  // Filter out excluded registrations for stats
  const activeRegistrations = registrations.filter((reg) => !reg.isExcluded);
  const count = activeRegistrations.length;
  const totalRevenue = activeRegistrations.reduce((sum, reg) => sum + reg.amountPaid, 0);
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

/**
 * Exclude a registration from capacity counts
 */
export async function excludeRegistration(
  sessionId: string,
  eventId: string,
  reason?: string
): Promise<void> {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Cannot exclude registration."
    );
  }

  try {
    const { error } = await supabase.from("excluded_registrations").upsert(
      {
        session_id: sessionId,
        event_id: eventId,
        reason: reason || null,
      },
      {
        onConflict: "session_id",
      }
    );

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Error excluding registration:", error);
    throw error;
  }
}

/**
 * Remove a registration from the exclusion list (un-exclude)
 */
export async function unexcludeRegistration(sessionId: string): Promise<void> {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Cannot un-exclude registration."
    );
  }

  try {
    const { error } = await supabase
      .from("excluded_registrations")
      .delete()
      .eq("session_id", sessionId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Error un-excluding registration:", error);
    throw error;
  }
}

/**
 * Get all excluded registrations for an event
 */
export async function getExcludedRegistrations(eventId: string) {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("excluded_registrations")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching excluded registrations:", error);
    return [];
  }
}

