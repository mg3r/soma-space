import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "No session ID provided" },
      { status: 400 }
    );
  }

  try {
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify the session is paid and completed
    if (session.payment_status === "paid" && session.status === "complete") {
      return NextResponse.json({ 
        verified: true,
        customerEmail: session.customer_details?.email 
      });
    }

    return NextResponse.json(
      { verified: false, reason: "Payment not completed" },
      { status: 403 }
    );
  } catch (error) {
    console.error("Stripe verification error:", error);
    return NextResponse.json(
      { error: "Invalid session" },
      { status: 400 }
    );
  }
}

