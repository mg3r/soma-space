import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { sendRegistrationConfirmationEmail, sendGuestWaiverEmail } from "@/lib/email";
import { getEventConfigByEventId } from "@/lib/event-config";
import { createGuestWaiverToken } from "@/lib/waiver";
import { capitalizeName } from "@/lib/format";

const stripe = getStripeClient();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature || !webhookSecret) {
      const msg = !webhookSecret
        ? "STRIPE_WEBHOOK_SECRET is not set. Put it in .env.local (same folder as package.json) and restart the dev server (stop npm run dev, then run it again)."
        : "Missing Stripe signature or webhook secret.";
      console.error("[webhook]", msg);
      return NextResponse.json(
        { error: msg },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("[webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    console.log("[webhook] Event verified:", event.type);

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("[webhook] checkout.session.completed received", {
        sessionId: session.id,
        payment_status: session.payment_status,
        success_url: session.success_url,
      });

      // Only process if it's a soma space registration
      const amountTotal = session.amount_total || 0;
      const amountInDollars = amountTotal / 100;
      const successUrl = session.success_url || "";
      const eventId = session.metadata?.event_id;

      // Check if it's a soma space registration
      const isSomaSpace =
        eventId ||
        (amountInDollars >= 22 &&
          amountInDollars <= 44 &&
          successUrl.includes("/welcome") &&
          (          successUrl.includes("entersoma.space") ||
            successUrl.includes("localhost:3000") ||
            successUrl.includes("localhost:3001")));

      if (!isSomaSpace) {
        console.log("[webhook] Skipping: not a soma space registration", {
          amountInDollars,
          hasWelcome: successUrl.includes("/welcome"),
          hasLocalhost: successUrl.includes("localhost"),
          hasEntersoma: successUrl.includes("entersoma.space"),
        });
      }

      if (isSomaSpace && session.payment_status === "paid") {
        const finalEventId = eventId || "RENEWAL";
        // Retrieve full session so metadata (pre_waiver_name, pre_waiver_email) is present; webhook payload can omit it
        let sessionToSync = session;
        try {
          const fullSession = await stripe.checkout.sessions.retrieve(session.id);
          sessionToSync = fullSession as Stripe.Checkout.Session;
        } catch (e) {
          console.warn("[webhook] Could not retrieve session for metadata, using event payload:", e);
        }
        // Prefer actual payer email (e.g. from Link) over session contact (prefilled form) for customer_email and confirmation
        const chargePayerEmail = await getPayerEmailFromCharge(sessionToSync);
        const sessionContact = sessionToSync.customer_details?.email?.trim();
        const customerEmail =
          (chargePayerEmail || sessionContact) || "N/A";

        // Log which Supabase we're using (APP_MODE must be "live" to use _LIVE URL/key; else we use default = test project)
        const appMode = process.env.APP_MODE?.toLowerCase();
        const supabaseUrlUsed = appMode === "live"
          ? process.env.NEXT_PUBLIC_SUPABASE_URL_LIVE
          : process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseHost = supabaseUrlUsed ? new URL(supabaseUrlUsed).hostname : "(none)";
        console.log("[webhook] APP_MODE=", process.env.APP_MODE ?? "(unset)", "Supabase host=", supabaseHost, "eventId=", finalEventId);
        await syncRegistrationToSupabase(sessionToSync, finalEventId, customerEmail);

        // Get the correct event config for this specific event (not the active one)
        const eventConfig = await getEventConfigByEventId(finalEventId);

        // Fetch pending order first (multi-ticket) so we can exclude guest emails from payer confirmation.
        const pendingOrderId = sessionToSync.metadata?.pending_order_id as string | undefined;
        let tickets: Array<{ name: string; email: string; amount: number }> | null = null;
        if (pendingOrderId && supabase) {
          const { data: order } = await supabase
            .from("pending_orders")
            .select("tickets")
            .eq("id", pendingOrderId)
            .single();
          tickets = order?.tickets as Array<{ name: string; email: string; amount: number }> | null;
          if (!Array.isArray(tickets) || tickets.length < 1) {
            console.warn("[webhook] pending_order_id present but order not found or tickets empty, id:", pendingOrderId);
            tickets = null;
          } else {
            // Mark this pending order as completed (same session) so admin "abandoned only" excludes it
            const { error: updateErr } = await supabase
              .from("pending_orders")
              .update({ completed_at: new Date().toISOString(), session_id: sessionToSync.id })
              .eq("id", pendingOrderId);
            if (updateErr) console.warn("[webhook] Could not mark pending_order completed:", updateErr.message);
          }
        }

        // Guest emails (multi-ticket): never send payer confirmation to these; they get Email 2 only.
        const guestEmails = new Set<string>();
        if (Array.isArray(tickets) && tickets.length > 1) {
          for (let i = 1; i < tickets.length; i++) {
            const e = (tickets[i].email || "").trim().toLowerCase();
            if (e) guestEmails.add(e);
          }
        }

        // Email 1 — Primary payer only: "you're in" (no waiver). Payer signs waiver on site before checkout.
        // Send to checkout email and, if different, pre-waiver (chat) email. Exclude guest emails so guests get Email 2 only.
        const preWaiverEmail = (sessionToSync.metadata?.pre_waiver_email as string)?.trim()?.toLowerCase();
        const customerName =
          (sessionToSync.metadata?.pre_waiver_name as string)?.trim() ||
          sessionToSync.customer_details?.name ||
          customerEmail ||
          "there";

        const emailsToSend = new Set<string>();
        if (customerEmail && customerEmail !== "N/A") {
          const ce = customerEmail.trim().toLowerCase();
          if (!guestEmails.has(ce)) emailsToSend.add(ce);
        }
        if (preWaiverEmail && preWaiverEmail !== "N/A" && !emailsToSend.has(preWaiverEmail) && !guestEmails.has(preWaiverEmail)) {
          emailsToSend.add(preWaiverEmail);
        }

        if (emailsToSend.size === 0) {
          console.warn("[webhook] No recipient emails (customer_email or pre_waiver_email). Skipping confirmation email.");
        } else {
          console.log("[webhook] Sending confirmation emails to:", Array.from(emailsToSend));
          for (const toEmail of emailsToSend) {
            if (!toEmail) continue;
            try {
              await sendRegistrationConfirmationEmail(
                toEmail,
                customerName,
                eventConfig.event_name,
                eventConfig.event_date,
                eventConfig.event_time,
                eventConfig.event_place,
                eventConfig.event_address,
                eventConfig.primary_color || "#05fd00"
              );
              console.log("[webhook] ✅ Registration confirmation email sent to", toEmail);
            } catch (emailErr) {
              console.error("[webhook] Failed to send confirmation to", toEmail, emailErr);
            }
          }
        }

        // Email 2 — Each guest (multi-ticket): automatically send "you're in" + sign waiver.
        // tickets[0] = payer (already got Email 1 above); tickets[1..] = guests.
        if (Array.isArray(tickets) && tickets.length > 1 && supabase) {
          const guestCount = tickets.length - 1;
            console.log("[webhook] Multi-ticket: inserting", guestCount, "guest(s) and sending 'you're in' + waiver email to each");
            const eventIdForGuests = sessionToSync.metadata?.event_id || "RENEWAL";
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://entersoma.space";
            for (let i = 1; i < tickets.length; i++) {
              const t = tickets[i];
              const amountPaid = Number(t.amount) || 0;
              const { error: guestErr } = await supabase.from("registration_guests").insert({
                session_id: sessionToSync.id,
                event_id: eventIdForGuests,
                guest_index: i,
                name: capitalizeName((t.name || "").trim()),
                email: (t.email || "").trim().toLowerCase(),
                amount_paid: amountPaid,
              });
              if (guestErr) console.error("[webhook] registration_guests insert:", guestErr);
              const guestEmail = (t.email || "").trim().toLowerCase();
              if (guestEmail) {
                const waiverToken = createGuestWaiverToken(sessionToSync.id, i, guestEmail);
                const waiverLink = `${baseUrl}/waiver/guest?token=${encodeURIComponent(waiverToken)}&email=${encodeURIComponent(guestEmail)}`;
                try {
                  await sendGuestWaiverEmail(
                    guestEmail,
                    (t.name || "").trim(),
                    eventConfig.event_name,
                    eventConfig.event_date,
                    eventConfig.event_time,
                    eventConfig.event_place,
                    eventConfig.event_address,
                    waiverLink,
                    eventConfig.primary_color || "#05fd00"
                  );
                  console.log("[webhook] ✅ Guest 'you're in' + waiver email sent to", guestEmail);
                } catch (guestEmailErr) {
                  console.error("[webhook] Guest waiver email failed:", guestEmailErr);
                }
              }
            }
        }
      }
    }

    // charge.refunded: record refund on registration so admin shows "(refunded)". Do not auto-exclude from capacity.
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      await markRegistrationRefunded(charge);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * When customer pays with Link (or similar), session.customer_details may still be the prefilled
 * form email. The actual payer email can be on the charge's billing_details or payment_method.
 * Prefer that for customer_email when present so we store who actually paid.
 */
async function getPayerEmailFromCharge(session: Stripe.Checkout.Session): Promise<string | null> {
  const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!piId) return null;
  try {
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge", "payment_method"] });
    const charge = pi.latest_charge;
    const chargeObj = typeof charge === "string" ? null : charge;
    const chargeEmail = chargeObj?.billing_details?.email?.trim()?.toLowerCase() ?? null;
    const chargeReceiptEmail = (chargeObj as Stripe.Charge | null)?.receipt_email?.trim()?.toLowerCase() ?? null;
    const pm = pi.payment_method;
    const pmObj = typeof pm === "string" ? null : pm;
    const pmEmail = (pmObj as Stripe.PaymentMethod | null)?.billing_details?.email?.trim()?.toLowerCase() ?? null;
    return chargeEmail || chargeReceiptEmail || pmEmail || null;
  } catch {
    return null;
  }
}

async function syncRegistrationToSupabase(
  session: Stripe.Checkout.Session,
  eventId: string,
  customerEmailOverride?: string
): Promise<void> {
  if (!supabase) {
    const msg =
      "Supabase not configured. When APP_MODE=live set NEXT_PUBLIC_SUPABASE_URL_LIVE and SUPABASE_SERVICE_ROLE_KEY_LIVE in Vercel.";
    console.error("[webhook]", msg);
    throw new Error(msg);
  }

  const amountPaid = (session.amount_total || 0) / 100;
  const paymentDate = new Date((session.created || 0) * 1000).toISOString();

  const customerEmailToWrite =
    customerEmailOverride?.trim() ||
    session.customer_details?.email?.trim() ||
    "N/A";
  const sessionContactEmail = session.customer_details?.email?.trim()?.toLowerCase() ?? null;

  // Pre-waiver email: from metadata (chat/waiver flow), fallback so column is always set when we have an email
  const metaPreWaiver = (session.metadata?.pre_waiver_email as string)?.trim()?.toLowerCase() ?? null;
  const preWaiverEmail = metaPreWaiver || sessionContactEmail || customerEmailToWrite?.toLowerCase() || null;
  // Prefer chat/waiver name over Stripe checkout name so we store the name they gave in our flow (capitalized for DB)
  const rawName =
    (session.metadata?.pre_waiver_name as string)?.trim() ||
    session.customer_details?.name ||
    session.customer_details?.email ||
    "N/A";
  const customerName = capitalizeName(rawName);

  const { error } = await supabase.from("registrations").upsert(
    {
      session_id: session.id,
      event_id: eventId,
      customer_name: customerName,
      customer_email: customerEmailToWrite,
      customer_phone: session.customer_details?.phone || null,
      pre_waiver_email: preWaiverEmail,
      amount_paid: amountPaid,
      payment_date: paymentDate,
      stripe_customer_id: session.customer || null,
      is_excluded: false,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "session_id",
    }
  );

  if (error) {
    console.error("[webhook] Error syncing registration to Supabase:", error.message, error.details);
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }
  // Read-after-write: confirm row exists in same project (helps debug "row not showing" when waiver works)
  const { data: row, error: selectError } = await supabase
    .from("registrations")
    .select("session_id, event_id, customer_email")
    .eq("session_id", session.id)
    .maybeSingle();
  if (selectError) {
    console.warn("[webhook] Read-after-write check failed:", selectError.message);
  } else if (row) {
    console.log("[webhook] ✅ Synced registration", session.id, "to Supabase (event_id:", eventId, ") verified row:", row.event_id, row.customer_email);
  } else {
    console.warn("[webhook] ✅ Upsert returned no error but row not found by session_id — check table/schema in project", process.env.NEXT_PUBLIC_SUPABASE_URL_LIVE ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL_LIVE).hostname : "");
  }
}

/** Find checkout session_id from a refunded charge, then set registrations.refunded_at. Does not exclude from capacity. */
async function markRegistrationRefunded(charge: Stripe.Charge): Promise<void> {
  if (!supabase) return;

  let sessionId: string | null = null;
  if (charge.metadata?.checkout_session_id) {
    sessionId = charge.metadata.checkout_session_id;
  } else if (charge.payment_intent) {
    try {
      const pi = await stripe.paymentIntents.retrieve(
        typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent.id
      );
      if (pi.metadata?.checkout_session_id) {
        sessionId = pi.metadata.checkout_session_id;
      } else {
        const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        if (sessions.data.length > 0) sessionId = sessions.data[0].id;
      }
    } catch {
      // ignore
    }
  }
  if (!sessionId && charge.customer) {
    try {
      const sessions = await stripe.checkout.sessions.list({
        customer: typeof charge.customer === "string" ? charge.customer : charge.customer.id,
        limit: 100,
      });
      const match = sessions.data.find((s) => {
        const amt = s.amount_total || 0;
        return amt >= 2200 && amt <= 4400 && Math.abs(amt - charge.amount) < 100;
      });
      if (match) sessionId = match.id;
    } catch {
      // ignore
    }
  }

  if (!sessionId) {
    console.warn("[webhook] charge.refunded: could not find session_id for charge", charge.id, {
      payment_intent: charge.payment_intent,
      customer: charge.customer,
      hint: "Ensure create-checkout sets payment_intent metadata (checkout_session_id) or session exists in Stripe.",
    });
    return;
  }

  const { data: updated, error } = await supabase
    .from("registrations")
    .update({ refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .select("session_id");

  if (error) {
    console.error("[webhook] charge.refunded: failed to set refunded_at for", sessionId, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: "If column refunded_at does not exist, run ADD_REFUNDED_AT.sql or SYNC_REGISTRATIONS_TABLE.sql in Supabase SQL Editor.",
    });
    return;
  }
  if (!updated?.length) {
    console.warn("[webhook] charge.refunded: no row updated for session_id", sessionId, {
      hint: "Registration may not exist in this Supabase project (e.g. different APP_MODE or table).",
    });
    return;
  }
  console.log("[webhook] ✅ Marked registration", sessionId, "as refunded (not excluded from capacity)");
}
