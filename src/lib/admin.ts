import { sendCapacityReachedNotification } from "./email";
import { capitalizeName } from "./format";
import { getStripeClient } from "./stripe";
import { supabase } from "./supabase";
import {
  getWaiverDetailsForEmails,
  getWaiverDetailsByIds,
} from "./waiver";
import Stripe from "stripe";

/**
 * Get the capacity for a specific event.
 * Source of truth: event_config.capacity, then event_capacities, then env vars.
 */
export async function getEventCapacity(eventId: string): Promise<number> {
  if (supabase) {
    try {
      // Prefer event config capacity (set in Event Configuration tab)
      const { data: configData } = await supabase
        .from("event_config")
        .select("capacity")
        .eq("event_id", eventId)
        .not("capacity", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (configData?.capacity != null) {
        return configData.capacity;
      }

      // Fallback to event_capacities (updated from overview or by event-config save)
      const { data: capData, error } = await supabase
        .from("event_capacities")
        .select("capacity")
        .eq("event_id", eventId)
        .single();

      if (!error && capData) {
        return capData.capacity;
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
 * Get excluded registrations with their reasons for an event
 */
async function getExcludedRegistrationsWithReasons(eventId: string): Promise<Map<string, { reason: string | null; isRefunded: boolean }>> {
  if (!supabase) {
    return new Map();
  }

  try {
    const { data, error } = await supabase
      .from("excluded_registrations")
      .select("session_id, reason")
      .eq("event_id", eventId);

    if (error) {
      console.error("Error fetching excluded registrations with reasons:", error);
      return new Map();
    }

    const result = new Map<string, { reason: string | null; isRefunded: boolean }>();
    data?.forEach((row) => {
      const isRefunded = row.reason?.includes("refunded") || row.reason?.includes("Refunded") || false;
      result.set(row.session_id, {
        reason: row.reason,
        isRefunded: isRefunded,
      });
    });

    return result;
  } catch (error) {
    console.error("Error in getExcludedRegistrationsWithReasons:", error);
    return new Map();
  }
}

/**
 * Count the number of attendees (payer + guests) for a specific event
 * Uses Supabase if available, falls back to Stripe
 * Excludes excluded registrations; counts main registrations + registration_guests
 */
export async function countEventRegistrations(eventId: string): Promise<number> {
  // Try Supabase first (faster)
  if (supabase) {
    try {
      const excludedIds = await getExcludedSessionIds(eventId);

      const { data: regs, error: regError } = await supabase
        .from("registrations")
        .select("session_id")
        .eq("event_id", eventId);

      if (!regError && regs) {
        const activeSessionIds = regs
          .filter((r) => !excludedIds.has(r.session_id))
          .map((r) => r.session_id);
        const mainCount = activeSessionIds.length;

        if (activeSessionIds.length === 0) return 0;

        const { count: guestCount, error: guestError } = await supabase
          .from("registration_guests")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .in("session_id", activeSessionIds)
          .or("is_excluded.is.null,is_excluded.eq.false");

        if (!guestError && guestCount !== null) {
          return mainCount + guestCount;
        }
        return mainCount;
      }
    } catch (error) {
      console.log("Supabase count failed, falling back to Stripe:", error);
    }
  }

  // Fallback to Stripe (no guest table; count sessions only)
  const stripe = getStripeClient();
  const excludedIds = await getExcludedSessionIds(eventId);

  try {
    let count = 0;
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const sessions: Stripe.Response<Stripe.ApiList<Stripe.Checkout.Session>> =
        await stripe.checkout.sessions.list({
          limit: 100,
          starting_after: startingAfter,
        });

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
  preWaiverEmail?: string;
  amountPaid: number;
  paymentDate: string;
  eventId: string;
  notes?: string;
  isExcluded?: boolean;
  isRefunded?: boolean;
  exclusionReason?: string;
  waiverSigned?: boolean;
  waiverSource?: string;
  /** When set, links to a specific waiver (e.g. admin linked to QR signature) */
  waiverSignatureId?: string;
  isGuest?: boolean;
  /** Set only for guest rows; used for resend waiver */
  guestIndex?: number;
};

/** Add waiver-signed status and source to each registration (batch lookup). */
async function addWaiverStatus(
  list: RegistrationData[]
): Promise<RegistrationData[]> {
  const byId = list.filter((r) => r.waiverSignatureId);
  const byEmail = list.filter((r) => !r.waiverSignatureId);
  const ids = byId.map((r) => r.waiverSignatureId!);
  const emails = byEmail
    .map((r) => (r.preWaiverEmail || r.customerEmail || "").trim().toLowerCase())
    .filter(Boolean);

  const [idDetails, emailDetails] = await Promise.all([
    ids.length > 0 ? getWaiverDetailsByIds(ids) : Promise.resolve<Record<string, { source?: string }>>({}),
    emails.length > 0 ? getWaiverDetailsForEmails(emails) : Promise.resolve<Record<string, { signed: boolean; source?: string }>>({}),
  ]);

  return list.map((r) => {
    if (r.waiverSignatureId && idDetails[r.waiverSignatureId]) {
      const d = idDetails[r.waiverSignatureId];
      return { ...r, waiverSigned: true, waiverSource: d.source };
    }
    const primary = (r.preWaiverEmail || r.customerEmail || "").trim().toLowerCase();
    const d = primary ? emailDetails[primary] : undefined;
    return {
      ...r,
      waiverSigned: d?.signed ?? false,
      waiverSource: d?.source,
    };
  });
}

/**
 * Get all registrations for a specific event
 * Uses Supabase if available, falls back to Stripe
 * Includes excluded registrations (marked with isExcluded flag)
 * Includes waiverSigned (batch check against waiver_signatures)
 */
export async function getEventRegistrations(
  eventId: string
): Promise<RegistrationData[]> {
  // Try Supabase first (faster)
  if (supabase) {
    try {
      const excludedIds = await getExcludedSessionIds(eventId);
      const excludedWithReasons = await getExcludedRegistrationsWithReasons(eventId);

      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .eq("event_id", eventId)
        .order("payment_date", { ascending: false });

      if (!error && data) {
        const list = data.map((row) => {
          const isExcluded = row.is_excluded || excludedIds.has(row.session_id);
          const exclusionInfo = excludedWithReasons.get(row.session_id);
          const isRefunded = row.refunded_at != null || exclusionInfo?.isRefunded || false;

          return {
            sessionId: row.session_id,
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            customerPhone: row.customer_phone || "N/A",
            preWaiverEmail: row.pre_waiver_email || undefined,
            amountPaid: parseFloat(row.amount_paid),
            paymentDate: row.payment_date,
            eventId: row.event_id,
            notes: row.notes || undefined,
            isExcluded: isExcluded,
            isRefunded: isRefunded,
            exclusionReason: exclusionInfo?.reason || undefined,
            waiverSignatureId: (row as { waiver_signature_id?: string }).waiver_signature_id || undefined,
          };
        });
        const sessionMap = new Map(list.map((r) => [r.sessionId, r]));
        const { data: guests } = await supabase
          .from("registration_guests")
          .select("session_id, guest_index, name, email, amount_paid, waiver_signed_at, waiver_signature_id, is_excluded")
          .eq("event_id", eventId);
        if (guests?.length) {
          const guestRows: RegistrationData[] = guests.map((g: {
            session_id: string;
            guest_index: number;
            name: string;
            email: string;
            amount_paid: number;
            waiver_signed_at: string | null;
            waiver_signature_id?: string | null;
            is_excluded?: boolean | null;
          }) => {
            const main = sessionMap.get(g.session_id);
            return {
              sessionId: g.session_id,
              guestIndex: g.guest_index,
              customerName: (g.name || "").trim() || "Guest",
              customerEmail: (g.email || "").trim(),
              customerPhone: "N/A",
              preWaiverEmail: (g.email || "").trim() || undefined,
              amountPaid: Number(g.amount_paid) || 0,
              paymentDate: main?.paymentDate || new Date().toISOString(),
              eventId,
              isExcluded: g.is_excluded === true,
              isRefunded: main?.isRefunded ?? false,
              waiverSignatureId: g.waiver_signature_id || undefined,
              waiverSigned: !!(g.waiver_signed_at || g.waiver_signature_id),
              isGuest: true,
            };
          });
          const combinedWithWaiver = await addWaiverStatus([...list, ...guestRows]);
          return combinedWithWaiver;
        }
        return addWaiverStatus(list);
      }
    } catch (error) {
      console.log("Supabase query failed, falling back to Stripe:", error);
    }
  }

  // Fallback to Stripe
  const stripe = getStripeClient();
  const excludedIds = await getExcludedSessionIds(eventId);
  const excludedWithReasons = await getExcludedRegistrationsWithReasons(eventId);

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
          const isExcluded = excludedIds.has(session.id);
          const exclusionInfo = excludedWithReasons.get(session.id);
          const isRefunded = exclusionInfo?.isRefunded || false;

          return {
            sessionId: session.id,
            customerName: session.customer_details?.name || "N/A",
            customerEmail: session.customer_details?.email || "N/A",
            customerPhone: session.customer_details?.phone || "N/A",
            preWaiverEmail: (session.metadata?.pre_waiver_email as string) || undefined,
            amountPaid: amountPaid,
            paymentDate: new Date(session.created * 1000).toISOString(),
            eventId: session.metadata?.event_id || eventId,
            isExcluded: isExcluded,
            isRefunded: isRefunded,
            exclusionReason: exclusionInfo?.reason || undefined,
          };
        });

      allEventSessions.push(...eventSessions);
      hasMore = sessions.has_more;

      if (sessions.data.length > 0) {
        startingAfter = sessions.data[sessions.data.length - 1].id;
      }
    }

    // Sort by payment date (newest first), then add waiver status
    const sorted = allEventSessions.sort(
      (a, b) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );
    return addWaiverStatus(sorted);
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
  
  // Total registered includes ALL registrations (including excluded)
  const totalRegistered = registrations.length;
  
  // Filter out excluded registrations for active count/capacity
  const activeRegistrations = registrations.filter((reg) => !reg.isExcluded);
  const activeCount = activeRegistrations.length;
  
  // Count excluded registrations
  const excludedCount = registrations.filter((reg) => reg.isExcluded).length;
  
  // Total revenue includes all registrations EXCEPT refunded ones
  // Manually excluded users still count towards revenue
  const totalRevenue = registrations
    .filter((reg) => !reg.isRefunded)
    .reduce((sum, reg) => sum + reg.amountPaid, 0);
  
  // Calculate refunded amount
  const refundedAmount = registrations
    .filter((reg) => reg.isRefunded)
    .reduce((sum, reg) => sum + reg.amountPaid, 0);
  
  // Remaining spots based on active (non-excluded) registrations
  const remainingSpots = Math.max(0, capacity - activeCount);
  
  return {
    eventId,
    capacity,
    totalParticipantsAttending: activeCount,
    registered: totalRegistered,
    activeRegistered: activeCount,
    excluded: excludedCount,
    remainingSpots,
    totalRevenue,
    refundedAmount,
    averageContribution: activeCount > 0 ? totalRevenue / activeCount : 0,
  };
}

export type RegistrationsOverTimePoint = { date: string; count: number };

function buildEmptySeries(days: number): RegistrationsOverTimePoint[] {
  const series: RegistrationsOverTimePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    series.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  return series;
}

/**
 * Get registrations over time (by day) for the last N days and count of new this week.
 * Buckets by local calendar date in ADMIN_TIMEZONE (default America/New_York) so the chart
 * matches the registrations table (which shows local dates).
 */
const ADMIN_CHART_TIMEZONE = process.env.ADMIN_TIMEZONE || "America/New_York";

function toLocalDateString(isoDate: string, timeZone: string): string {
  return new Date(isoDate).toLocaleDateString("en-CA", { timeZone });
}

export async function getRegistrationsOverTime(
  eventId: string,
  days = 30
): Promise<{ series: RegistrationsOverTimePoint[]; newThisWeek: number }> {
  if (!supabase) return { series: buildEmptySeries(days), newThisWeek: 0 };
  try {
    const tz = ADMIN_CHART_TIMEZONE;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    const [regResult, guestResult] = await Promise.all([
      supabase
        .from("registrations")
        .select("payment_date")
        .eq("event_id", eventId)
        .gte("payment_date", sinceStr.slice(0, 10)),
      supabase
        .from("registration_guests")
        .select("created_at")
        .eq("event_id", eventId)
        .gte("created_at", sinceStr),
    ]);

    const rows = regResult.data ?? [];
    const guestRows = guestResult.data ?? [];
    if (regResult.error) return { series: buildEmptySeries(days), newThisWeek: 0 };

    const byDay = new Map<string, number>();
    let newThisWeek = 0;
    for (const r of rows) {
      const raw = (r.payment_date as string)?.trim();
      if (!raw) continue;
      const localKey = toLocalDateString(raw, tz);
      byDay.set(localKey, (byDay.get(localKey) ?? 0) + 1);
      if (r.payment_date >= weekAgoStr) newThisWeek += 1;
    }
    for (const g of guestRows) {
      const raw = (g.created_at as string)?.trim();
      if (!raw) continue;
      const localKey = toLocalDateString(raw, tz);
      byDay.set(localKey, (byDay.get(localKey) ?? 0) + 1);
      if (raw >= weekAgoStr) newThisWeek += 1;
    }

    // Build full window oldest-first (left = oldest, right = today) in same timezone so keys match
    const series: RegistrationsOverTimePoint[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toLocaleDateString("en-CA", { timeZone: tz });
      series.push({ date: dateStr, count: byDay.get(dateStr) ?? 0 });
    }
    // Trim so left = first day with registration, right = today (max 30 days)
    const firstActiveIdx = series.findIndex((s) => s.count > 0);
    const trimmed = firstActiveIdx >= 0 ? series.slice(firstActiveIdx) : series;
    const capped = trimmed.length > days ? trimmed.slice(-days) : trimmed;
    const sorted = [...capped].sort((a, b) => a.date.localeCompare(b.date));
    return { series: sorted, newThisWeek };
  } catch (e) {
    console.error("getRegistrationsOverTime error:", e);
    return { series: buildEmptySeries(days), newThisWeek: 0 };
  }
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
      name: capitalizeName(name),
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

export type AbandonedPendingOrder = {
  id: string;
  event_id: string;
  tickets: Array<{ name: string; email: string; amount: number }>;
  created_at: string;
};

/**
 * Get pending orders that never completed (abandoned only).
 * Excludes: same-session completion (completed_at set by webhook) and
 * different-session completion (purchaser email found in registrations for this event).
 */
export async function getAbandonedPendingOrders(eventId: string): Promise<AbandonedPendingOrder[]> {
  if (!supabase) return [];

  try {
    const { data: orders, error: ordersError } = await supabase
      .from("pending_orders")
      .select("id, event_id, tickets, created_at")
      .eq("event_id", eventId)
      .is("completed_at", null)
      .order("created_at", { ascending: false });

    if (ordersError || !orders?.length) return orders || [];

    const { data: regs } = await supabase
      .from("registrations")
      .select("customer_email, pre_waiver_email")
      .eq("event_id", eventId);

    const registeredEmails = new Set<string>();
    regs?.forEach((r: { customer_email?: string; pre_waiver_email?: string }) => {
      const c = (r.customer_email || "").trim().toLowerCase();
      const p = (r.pre_waiver_email || "").trim().toLowerCase();
      if (c) registeredEmails.add(c);
      if (p) registeredEmails.add(p);
    });

    return orders.filter((order) => {
      const tickets = order.tickets as Array<{ name?: string; email?: string; amount?: number }>;
      const purchaserEmail = (tickets?.[0]?.email || "").trim().toLowerCase();
      return !purchaserEmail || !registeredEmails.has(purchaserEmail);
    }) as AbandonedPendingOrder[];
  } catch (error) {
    console.error("Error fetching abandoned pending orders:", error);
    return [];
  }
}

export type AbandonmentFunnel = {
  started: number;
  abandoned: number;
  completed: number;
  guests: number;
};

/**
 * Get sign-up funnel for an event.
 * completed = registration count (source of truth); started = max(pending_orders count, completed); abandoned = pending orders that never registered.
 * guests = count of registration_guests (additional sign-ups from multi-ticket orders).
 */
export async function getAbandonmentFunnel(eventId: string): Promise<AbandonmentFunnel> {
  if (!supabase) return { started: 0, abandoned: 0, completed: 0, guests: 0 };
  try {
    const [
      { count: pendingCount, error: pendingError },
      { count: completedCount, error: regError },
      { count: guestCount, error: guestError },
    ] = await Promise.all([
      supabase.from("pending_orders").select("id", { count: "exact", head: true }).eq("event_id", eventId),
      supabase.from("registrations").select("session_id", { count: "exact", head: true }).eq("event_id", eventId),
      supabase.from("registration_guests").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    ]);
    if (pendingError || regError) return { started: 0, abandoned: 0, completed: 0, guests: 0 };
    const completed = completedCount ?? 0;
    const startedNum = pendingCount ?? 0;
    const started = Math.max(startedNum, completed);
    const abandoned = await getAbandonedPendingOrders(eventId);
    const abandonedNum = abandoned.length;
    const guests = !guestError && guestCount != null ? guestCount : 0;
    return { started, abandoned: abandonedNum, completed, guests };
  } catch (e) {
    console.error("getAbandonmentFunnel error:", e);
    return { started: 0, abandoned: 0, completed: 0, guests: 0 };
  }
}

export type AllEventsMetrics = {
  totalRegistrations: number;
  totalRevenue: number;
  totalRefunded: number;
};

export type PersonSummary = {
  email: string;
  name: string;
  phone: string;
  eventIds: string[];
  eventCount: number;
  totalAmount: number;
};

/**
 * Get all-events summary: metrics (totals) and people (one per email, with events attended and totals).
 * Uses main registrations only (from registrations table); groups by canonical email (pre_waiver_email || customer_email).
 */
export async function getAllEventsSummary(): Promise<{
  metrics: AllEventsMetrics;
  people: PersonSummary[];
}> {
  if (!supabase) {
    return { metrics: { totalRegistrations: 0, totalRevenue: 0, totalRefunded: 0 }, people: [] };
  }

  try {
    const { data: rows, error } = await supabase
      .from("registrations")
      .select("event_id, customer_name, customer_email, customer_phone, pre_waiver_email, amount_paid, payment_date, refunded_at, is_excluded")
      .order("payment_date", { ascending: false });

    if (error) {
      console.error("Error fetching all registrations:", error);
      return { metrics: { totalRegistrations: 0, totalRevenue: 0, totalRefunded: 0 }, people: [] };
    }

    if (!rows?.length) {
      return { metrics: { totalRegistrations: 0, totalRevenue: 0, totalRefunded: 0 }, people: [] };
    }

    let totalRevenue = 0;
    let totalRefunded = 0;
    const byEmail = new Map<string, { name: string; phone: string; eventIds: Set<string>; totalAmount: number; latestPayment: string }>();

    for (const r of rows) {
      const refunded = !!r.refunded_at;
      const excluded = !!(r as { is_excluded?: boolean | null }).is_excluded;
      const amount = parseFloat(r.amount_paid) ?? 0;
      if (refunded) totalRefunded += amount;
      else totalRevenue += amount;

      const canonicalEmail = ((r.pre_waiver_email || r.customer_email) ?? "").trim().toLowerCase();
      if (!canonicalEmail) continue;

      const existing = byEmail.get(canonicalEmail);
      const eventId = (r.event_id ?? "").trim();
      if (existing) {
        if (!excluded && eventId) existing.eventIds.add(eventId);
        if (!refunded) existing.totalAmount += amount;
        if ((r.payment_date ?? "") > existing.latestPayment) {
          existing.latestPayment = r.payment_date ?? "";
          existing.name = (r.customer_name ?? "").trim() || existing.name;
          existing.phone = (r.customer_phone ?? "").trim() || existing.phone;
        }
      } else {
        byEmail.set(canonicalEmail, {
          name: (r.customer_name ?? "").trim() || "—",
          phone: (r.customer_phone ?? "").trim() || "—",
          eventIds: new Set(!excluded && eventId ? [eventId] : []),
          totalAmount: refunded ? 0 : amount,
          latestPayment: r.payment_date ?? "",
        });
      }
    }

    const people: PersonSummary[] = Array.from(byEmail.entries()).map(([email, v]) => ({
      email,
      name: v.name,
      phone: v.phone,
      eventIds: Array.from(v.eventIds).filter(Boolean).sort(),
      eventCount: v.eventIds.size,
      totalAmount: Math.round(v.totalAmount * 100) / 100,
    }));

    return {
      metrics: {
        totalRegistrations: rows.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalRefunded: Math.round(totalRefunded * 100) / 100,
      },
      people,
    };
  } catch (err) {
    console.error("getAllEventsSummary error:", err);
    return { metrics: { totalRegistrations: 0, totalRevenue: 0, totalRefunded: 0 }, people: [] };
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
 * Fetches customer info from registrations table and stores in excluded_registrations
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
    // First, get customer info from registrations table
    const { data: registration, error: regError } = await supabase
      .from("registrations")
      .select("customer_name, customer_email, customer_phone")
      .eq("session_id", sessionId)
      .single();

    if (regError && regError.code !== "PGRST116") {
      // PGRST116 is "not found" - that's okay, we'll just not have customer info
      console.warn("Could not fetch registration for customer info:", regError);
    }

    // Add to excluded_registrations with customer info
    const { error: excludeError } = await supabase
      .from("excluded_registrations")
      .upsert(
        {
          session_id: sessionId,
          event_id: eventId,
          customer_name: registration?.customer_name || null,
          customer_email: registration?.customer_email || null,
          customer_phone: registration?.customer_phone || null,
          reason: reason || null,
        },
        {
          onConflict: "session_id",
        }
      );

    if (excludeError) {
      throw excludeError;
    }

    // Update registrations table to mark as excluded
    const { error: updateError } = await supabase
      .from("registrations")
      .update({ is_excluded: true, updated_at: new Date().toISOString() })
      .eq("session_id", sessionId);

    if (updateError) {
      console.warn("Could not update registrations.is_excluded:", updateError);
      // Don't throw - exclusion was successful, just the flag update failed
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
    // Remove from excluded_registrations
    const { error: deleteError } = await supabase
      .from("excluded_registrations")
      .delete()
      .eq("session_id", sessionId);

    if (deleteError) {
      throw deleteError;
    }

    // Update registrations table to mark as not excluded
    const { error: updateError } = await supabase
      .from("registrations")
      .update({ is_excluded: false, updated_at: new Date().toISOString() })
      .eq("session_id", sessionId);

    if (updateError) {
      console.warn("Could not update registrations.is_excluded:", updateError);
      // Don't throw - un-exclusion was successful, just the flag update failed
    }
  } catch (error) {
    console.error("Error un-excluding registration:", error);
    throw error;
  }
}

/**
 * Exclude a guest from capacity count (e.g. can't attend). Does not mark as refunded.
 */
export async function excludeGuest(sessionId: string, guestIndex: number): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured. Cannot exclude guest.");
  }
  const { error } = await supabase
    .from("registration_guests")
    .update({ is_excluded: true })
    .eq("session_id", sessionId)
    .eq("guest_index", guestIndex);
  if (error) throw error;
}

/**
 * Remove a guest from the exclusion list (un-exclude)
 */
export async function unexcludeGuest(sessionId: string, guestIndex: number): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured. Cannot un-exclude guest.");
  }
  const { error } = await supabase
    .from("registration_guests")
    .update({ is_excluded: false })
    .eq("session_id", sessionId)
    .eq("guest_index", guestIndex);
  if (error) throw error;
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

