import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient, isTestMode } from "@/lib/stripe";
import { getEventCapacity, countEventRegistrations, checkAndNotifyCapacityReached } from "@/lib/admin";
import { getActiveEventConfig } from "@/lib/event-config";
import { hasSignedWaiver } from "@/lib/waiver";
import { supabase } from "@/lib/supabase";

type TicketRow = { name: string; email: string; amount: number };

export async function POST(req: Request) {
  try {
    const stripe = getStripeClient();
    const testMode = isTestMode();
    
    if (testMode) {
      console.log("🔧 Running in TEST mode - no real charges will be made");
    } else {
      console.log("💰 Running in LIVE mode - real charges will be made");
    }

    const body = await req.json();
    const { amount, email: preWaiverEmail, customerName: preWaiverName, pendingOrderId } = body;
    
    const eventConfig = await getActiveEventConfig();
    const minAmount = eventConfig.stripe_min_amount || 2200;
    const maxAmount = eventConfig.stripe_max_amount || 4400;
    const eventId = eventConfig.event_id;
    const capacity = eventConfig.capacity || await getEventCapacity(eventId);
    const currentRegistrations = await countEventRegistrations(eventId);

    // Determine base URL early (used for waiver redirect and images)
    const requestUrl = new URL(req.url);
    let baseUrl: string;
    if (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') {
      baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    } else {
      const origin = req.headers.get('origin');
      if (origin) {
        try {
          const originUrl = new URL(origin);
          baseUrl = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1'
            ? origin
            : origin.startsWith('https') ? origin : `https://${originUrl.host}`;
        } catch {
          baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://entersoma.space';
        }
      } else {
        baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                 (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://entersoma.space');
      }
    }
    console.log('Using base URL for redirects:', baseUrl);

    let tickets: TicketRow[] | null = null;
    let effectivePreWaiverEmail = typeof preWaiverEmail === "string" && preWaiverEmail.trim() ? preWaiverEmail.trim() : null;
    let effectivePreWaiverName = typeof preWaiverName === "string" && preWaiverName.trim() ? preWaiverName.trim() : null;
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

    if (pendingOrderId && supabase) {
      const { data: order, error } = await supabase
        .from("pending_orders")
        .select("event_id, tickets")
        .eq("id", pendingOrderId)
        .single();
      if (error || !order?.tickets) {
        return NextResponse.json(
          { error: "Invalid or expired pending order. Please start over." },
          { status: 400 }
        );
      }
      tickets = order.tickets as TicketRow[];
      if (!Array.isArray(tickets) || tickets.length < 1) {
        return NextResponse.json(
          { error: "Pending order has no tickets." },
          { status: 400 }
        );
      }
      effectivePreWaiverEmail = (tickets[0].email || "").trim().toLowerCase();
      effectivePreWaiverName = (tickets[0].name || "").trim();
      for (let i = 0; i < tickets.length; i++) {
        const amt = Math.round(Number(tickets[i].amount) * 100);
        if (isNaN(amt) || amt < minAmount || amt > maxAmount) {
          return NextResponse.json(
            { error: `Ticket ${i + 1}: amount must be between $${minAmount / 100} and $${maxAmount / 100}` },
            { status: 400 }
          );
        }
      }
      if (currentRegistrations + tickets.length > capacity) {
        return NextResponse.json(
          { error: "This event is full.", message: `Only ${Math.max(0, capacity - currentRegistrations)} spot(s) left.`, isFull: true },
          { status: 400 }
        );
      }
      await checkAndNotifyCapacityReached(eventId, capacity, currentRegistrations);
      const rawImage = eventConfig.stripe_image_url?.trim();
      const baseForImages = baseUrl.startsWith('https://')
        ? baseUrl.replace(/\/$/, '')
        : (process.env.NEXT_PUBLIC_BASE_URL || 'https://entersoma.space').replace(/\/$/, '');
      const stripeImageUrl = rawImage
        ? (rawImage.startsWith('http') ? rawImage : `${baseForImages}/${rawImage.replace(/^\//, '')}`)
        : `${baseForImages}/api/checkout-image?event_name=${encodeURIComponent(eventConfig.event_name || eventId)}&primary_color=${encodeURIComponent((eventConfig.primary_color || '#05fd00').replace(/^#/, ''))}`;
      lineItems = tickets.map((t) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: eventConfig.stripe_product_name || 'soma space',
            description: eventConfig.stripe_product_description || 'soma space – movement gathering',
            images: [stripeImageUrl],
          },
          unit_amount: Math.round(Number(t.amount) * 100),
        },
        quantity: 1,
      }));
    } else {
      const amountInCents = Math.round(parseFloat(amount) * 100);
      if (isNaN(amountInCents) || amountInCents < minAmount || amountInCents > maxAmount) {
        return NextResponse.json(
          { error: `Amount must be between $${minAmount / 100} and $${maxAmount / 100}` },
          { status: 400 }
        );
      }
      await checkAndNotifyCapacityReached(eventId, capacity, currentRegistrations);
      if (currentRegistrations >= capacity) {
        return NextResponse.json(
          { error: "This event is full", message: `All ${capacity} spots have been reserved.`, isFull: true },
          { status: 400 }
        );
      }
      const baseForImages = baseUrl.startsWith('https://')
        ? baseUrl.replace(/\/$/, '')
        : (process.env.NEXT_PUBLIC_BASE_URL || 'https://entersoma.space').replace(/\/$/, '');
      const rawImage = eventConfig.stripe_image_url?.trim();
      const stripeImageUrl = rawImage
        ? (rawImage.startsWith('http') ? rawImage : `${baseForImages}/${rawImage.replace(/^\//, '')}`)
        : `${baseForImages}/api/checkout-image?event_name=${encodeURIComponent(eventConfig.event_name || eventId)}&primary_color=${encodeURIComponent((eventConfig.primary_color || '#05fd00').replace(/^#/, ''))}`;
      lineItems = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: eventConfig.stripe_product_name || 'soma space',
              description: eventConfig.stripe_product_description || 'soma space is a guided movement gathering rooted in presence, free expression, and connection. participants are invited to move with music and explore embodied awareness. no prior movement or dance experience is required.\n\nno one is ever turned away for not having enough. if you need financial support, please reach out to us directly.',
              images: [stripeImageUrl],
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ];
    }

    if (effectivePreWaiverEmail) {
      const signed = await hasSignedWaiver(effectivePreWaiverEmail);
      if (!signed) {
        const waiverAmount = tickets ? String(tickets[0].amount) : amount;
        return NextResponse.json(
          {
            needWaiver: true,
            waiverUrl: `${baseUrl}/waiver?email=${encodeURIComponent(effectivePreWaiverEmail)}&amount=${waiverAmount}${pendingOrderId ? `&pendingOrderId=${encodeURIComponent(pendingOrderId)}` : ""}`,
          },
          { status: 403 }
        );
      }
    }

    const metadata: Record<string, string> = {
      event_id: eventId,
      event_name: eventConfig.event_name ?? "",
      event_date: eventConfig.event_date ?? "",
    };
    if (effectivePreWaiverEmail) metadata.pre_waiver_email = effectivePreWaiverEmail.toLowerCase();
    if (effectivePreWaiverName) metadata.pre_waiver_name = effectivePreWaiverName;
    if (pendingOrderId) metadata.pending_order_id = pendingOrderId;

    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${baseUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}`,
      allow_promotion_codes: true,
      phone_number_collection: { enabled: true },
      metadata,
    };

    const session = await stripe.checkout.sessions.create(sessionOptions);

    // Update payment intent metadata with session ID (for refund tracking)
    // This allows us to find the checkout session when a refund happens
    if (session.payment_intent) {
      try {
        await stripe.paymentIntents.update(
          typeof session.payment_intent === 'string' 
            ? session.payment_intent 
            : session.payment_intent.id,
          {
            metadata: {
              checkout_session_id: session.id,
              event_id: eventId,
            },
          }
        );
      } catch (error) {
        console.warn("Could not update payment intent metadata:", error);
        // Non-critical, continue anyway
      }
    }

    return NextResponse.json({ 
      sessionId: session.id, 
      url: session.url 
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // If it's a Stripe configuration error, provide helpful message
    if (errorMessage.includes("not configured")) {
      return NextResponse.json(
        { 
          error: "Stripe not configured", 
          details: errorMessage,
          hint: "Make sure STRIPE_MODE is set to 'test' or 'live' and the corresponding key is configured"
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create checkout session", details: errorMessage },
      { status: 500 }
    );
  }
}

