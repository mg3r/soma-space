import { NextResponse } from "next/server";
import { getStripeClient, isTestMode } from "@/lib/stripe";
import { getEventCapacity, countEventRegistrations, checkAndNotifyCapacityReached } from "@/lib/admin";
import { getActiveEventConfig } from "@/lib/event-config";

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
    
    // Get active event config for price validation and event details
    const eventConfig = await getActiveEventConfig();
    const minAmount = eventConfig.stripe_min_amount || 2200;
    const maxAmount = eventConfig.stripe_max_amount || 4400;
    
    // Validate amount is within configured range
    const amountInCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountInCents) || amountInCents < minAmount || amountInCents > maxAmount) {
      return NextResponse.json(
        { error: `Amount must be between $${minAmount / 100} and $${maxAmount / 100}` },
        { status: 400 }
      );
    }

    const eventId = eventConfig.event_id;
    const capacity = eventConfig.capacity || await getEventCapacity(eventId);
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
    const stripeImageUrl = eventConfig.stripe_image_url 
      ? (eventConfig.stripe_image_url.startsWith('http') ? eventConfig.stripe_image_url : `${imageUrl}${eventConfig.stripe_image_url}`)
      : `${imageUrl}/renewal-checkout.jpg`;
    console.log('Using image URL:', stripeImageUrl);

    // Create Checkout Session with dynamic price
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
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
        event_name: eventConfig.event_name,
        event_date: eventConfig.event_date,
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

