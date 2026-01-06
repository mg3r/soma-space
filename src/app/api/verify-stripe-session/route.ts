import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";

export async function GET(req: Request) {
  try {
    const stripe = getStripeClient();

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    console.log("Verification request received. Session ID:", sessionId);
    console.log("All search params:", Object.fromEntries(searchParams.entries()));

    if (!sessionId) {
      console.error("No session ID provided in request");
      return NextResponse.json(
        { error: "No session ID provided" },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    console.log("Retrieving session from Stripe:", sessionId);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log("Session retrieved:", {
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      mode: session.mode
    });

    // Verify the session is paid and completed
    if (session.payment_status === "paid" && session.status === "complete") {
      console.log("Session verified successfully");
      return NextResponse.json({ 
        verified: true,
        customerEmail: session.customer_details?.email 
      });
    }

    console.log("Session not paid or not complete:", {
      payment_status: session.payment_status,
      status: session.status
    });
    return NextResponse.json(
      { verified: false, reason: "Payment not completed" },
      { status: 403 }
    );
  } catch (error) {
    console.error("Stripe verification error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Handle configuration errors
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
    
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
    } : {};
    console.error("Error details:", errorDetails);
    return NextResponse.json(
      { error: "Invalid session", details: errorMessage },
      { status: 400 }
    );
  }
}
