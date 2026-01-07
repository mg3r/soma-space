import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";

const stripe = getStripeClient();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature || !webhookSecret) {
      console.error("Missing Stripe signature or webhook secret");
      return NextResponse.json(
        { error: "Missing signature or webhook secret" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

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
          (successUrl.includes("entersoma.space") ||
            successUrl.includes("localhost:3000")));

      if (isSomaSpace && session.payment_status === "paid") {
        await syncRegistrationToSupabase(session, eventId || "RENEWAL");
      }
    }

    // Handle charge.refunded event - auto-exclude refunded registrations
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const sessionId = charge.metadata?.checkout_session_id;

      if (sessionId) {
        await autoExcludeRefundedRegistration(sessionId, charge);
      }
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

async function syncRegistrationToSupabase(
  session: Stripe.Checkout.Session,
  eventId: string
) {
  if (!supabase) {
    console.warn("Supabase not configured, skipping registration sync");
    return;
  }

  try {
    const amountPaid = (session.amount_total || 0) / 100;
    const paymentDate = new Date((session.created || 0) * 1000).toISOString();

    const { error } = await supabase.from("registrations").upsert(
      {
        session_id: session.id,
        event_id: eventId,
        customer_name:
          session.customer_details?.name ||
          session.customer_details?.email ||
          "N/A",
        customer_email: session.customer_details?.email || "N/A",
        customer_phone: session.customer_details?.phone || null,
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
      console.log(`✅ Synced registration ${session.id} to Supabase`);
    }
  } catch (error) {
    console.error("Error in syncRegistrationToSupabase:", error);
  }
}

async function autoExcludeRefundedRegistration(
  sessionId: string,
  charge: Stripe.Charge
) {
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
      console.log(`Registration ${sessionId} not found in Supabase, skipping auto-exclude`);
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

