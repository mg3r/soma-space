import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error("STRIPE_SECRET_KEY is not configured");
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });

  try {
    const stripePriceId = process.env.STRIPE_PRICE_ID;

    if (!stripePriceId) {
      console.error("STRIPE_PRICE_ID is not configured");
      return NextResponse.json(
        { error: "Stripe price ID not configured" },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/reserve?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ 
      sessionId: session.id, 
      url: session.url 
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create checkout session", details: errorMessage },
      { status: 500 }
    );
  }
}

