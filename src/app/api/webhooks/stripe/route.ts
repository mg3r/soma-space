import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { sendRegistrationConfirmationEmail, sendGuestWaiverEmail } from "@/lib/email";
import { getEventConfigByEventId } from "@/lib/event-config";
import { createGuestWaiverToken } from "@/lib/waiver";

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

        console.log("[webhook] Syncing registration to Supabase, eventId:", finalEventId);
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
                name: (t.name || "").trim(),
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

    // Handle charge.refunded event - auto-exclude refunded registrations
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      await handleRefundedCharge(charge);
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
) {
  if (!supabase) {
    console.warn("Supabase not configured, skipping registration sync");
    return;
  }

  try {
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
    // Prefer chat/waiver name over Stripe checkout name so we store the name they gave in our flow
    const customerName =
      (session.metadata?.pre_waiver_name as string)?.trim() ||
      session.customer_details?.name ||
      session.customer_details?.email ||
      "N/A";

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
      console.error("Error syncing registration to Supabase:", error);
    } else {
      console.log(`✅ Synced registration ${session.id} to Supabase (event_id: ${eventId})`);
    }
  } catch (error) {
    console.error("Error in syncRegistrationToSupabase:", error);
  }
}

async function handleRefundedCharge(charge: Stripe.Charge) {
  if (!supabase) {
    console.warn("Supabase not configured, skipping auto-exclude");
    return;
  }

  try {
    let sessionId: string | null = null;

    // Try to get session ID from charge metadata first
    if (charge.metadata?.checkout_session_id) {
      sessionId = charge.metadata.checkout_session_id;
    } else if (charge.payment_intent) {
      // If not in metadata, try to find checkout session via payment intent
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent.id
        );

        // Payment intent metadata might have session ID
        if (paymentIntent.metadata?.checkout_session_id) {
          sessionId = paymentIntent.metadata.checkout_session_id;
        } else {
          // Search for checkout sessions with this payment intent
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntent.id,
            limit: 1,
          });

          if (sessions.data.length > 0) {
            sessionId = sessions.data[0].id;
          }
        }
      } catch (error) {
        console.error("Error retrieving payment intent:", error);
      }
    }

    // If we still don't have a session ID, try to find by customer and amount
    if (!sessionId && charge.customer) {
      try {
        const amountInCents = charge.amount;
        const sessions = await stripe.checkout.sessions.list({
          customer: typeof charge.customer === "string" ? charge.customer : charge.customer.id,
          limit: 100,
        });

        // Find session with matching amount (within $22-44 range)
        const matchingSession = sessions.data.find((session) => {
          const sessionAmount = session.amount_total || 0;
          return (
            sessionAmount >= 2200 &&
            sessionAmount <= 4400 &&
            Math.abs(sessionAmount - amountInCents) < 100 // Allow small variance
          );
        });

        if (matchingSession) {
          sessionId = matchingSession.id;
        }
      } catch (error) {
        console.error("Error searching for checkout session:", error);
      }
    }

    if (!sessionId) {
      console.log(
        `Could not find checkout session for refunded charge ${charge.id}, skipping auto-exclude`
      );
      return;
    }

    await autoExcludeRefundedRegistration(sessionId);
  } catch (error) {
    console.error("Error in handleRefundedCharge:", error);
  }
}

async function autoExcludeRefundedRegistration(sessionId: string) {
  if (!supabase) {
    console.warn("Supabase not configured, skipping auto-exclude");
    return;
  }

  try {
    // Get registration details
    const { data: registration, error: regError } = await supabase
      .from("registrations")
      .select("event_id, customer_name, customer_email, customer_phone")
      .eq("session_id", sessionId)
      .single();

    if (regError || !registration) {
      console.log(
        `Registration ${sessionId} not found in Supabase, skipping auto-exclude`
      );
      return;
    }

    // Add to excluded_registrations
    const { error: excludeError } = await supabase
      .from("excluded_registrations")
      .upsert(
        {
          session_id: sessionId,
          event_id: registration.event_id,
          customer_name: registration.customer_name,
          customer_email: registration.customer_email,
          customer_phone: registration.customer_phone,
          reason: "Auto-excluded: Payment refunded in Stripe",
        },
        {
          onConflict: "session_id",
        }
      );

    if (excludeError) {
      console.error("Error auto-excluding refunded registration:", excludeError);
      return;
    }

    // Update registrations table
    await supabase
      .from("registrations")
      .update({ is_excluded: true, updated_at: new Date().toISOString() })
      .eq("session_id", sessionId);

    console.log(`✅ Auto-excluded refunded registration ${sessionId}`);
  } catch (error) {
    console.error("Error in autoExcludeRefundedRegistration:", error);
  }
}

