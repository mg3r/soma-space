import { NextResponse } from "next/server";
import { getStripeClient, isTestMode } from "@/lib/stripe";
import { nextEvent } from "@/config/event";
import { getEventCapacity, countEventRegistrations, checkAndNotifyCapacityReached } from "@/lib/admin";

export async function POST(req: Request) {
  try {
    const stripe = getStripeClient();
    const testMode = isTestMode();
    
    if (testMode) {
      console.log("🔧 Running in TEST mode - no real charges will be made");
    } else {
      console.log("💰 Running in LIVE mode - real charges will be made");
    }

    // Get the amount from the request body
    // Get the amount from the request body
    const { amount } = await req.json();
    
    // Validate amount is between $22 and $44
    const amountInCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountInCents) || amountInCents < 2200 || amountInCents > 4400) {
      return NextResponse.json(
        { error: "Amount must be between $22 and $44" },
        { status: 400 }
      );
    }

    // Check capacity before creating checkout session
    const eventId = nextEvent.id;
    const capacity = await getEventCapacity(eventId);
    const currentRegistrations = await countEventRegistrations(eventId);
    
    // Check if we just reached capacity (for notification)
    await checkAndNotifyCapacityReached(eventId, capacity, currentRegistrations);
    
    if (currentRegistrations >= capacity) {
      return NextResponse.json(
        { 
          error: "This event is full",
          message: `All ${capacity} spots have been reserved.`,
          isFull: true
        },
        { status: 400 }
      );
    }

    // Use production domain for success URL, or fallback to NEXT_PUBLIC_BASE_URL
    // In production, always use the production domain to ensure proper redirects
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   (process.env.NODE_ENV === 'production' ? 'https://entersoma.space' : 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));

    // For images, always use production domain since Stripe requires publicly accessible HTTPS URLs
    // Even in test mode, the image must be accessible via HTTPS
    const imageUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://entersoma.space';
    console.log('Using image URL:', `${imageUrl}/renewal-checkout.jpg`);

    // Create Checkout Session with dynamic price
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'soma space',
              description: 'soma space is a guided movement gathering rooted in presence, free expression, and connection. participants are invited to move with music and explore embodied awareness. no prior movement or dance experience is required.\n\nno one is ever turned away for not having enough. if you need financial support, please reach out to us directly.',
              images: [
                `${imageUrl}/renewal-checkout.jpg`,
              ],
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}`,
      allow_promotion_codes: true,
      // Collect phone number (email is collected by default)
      phone_number_collection: {
        enabled: true,
      },
      // Add metadata to identify the event
      metadata: {
        event_id: eventId,
        event_name: nextEvent.name,
        event_date: nextEvent.date,
      },
    });

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

