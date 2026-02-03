import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { nextEvent } from "@/config/event";
import Stripe from "stripe";

/**
 * Migration endpoint to backfill existing Stripe registrations to Supabase
 * This should be called once after setting up the registrations table
 */
export async function POST(req: Request) {
  try {
    // Add CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 200, headers });
    }

    // Simple auth check - you might want to add proper admin auth
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const stripe = getStripeClient();
    const eventId = nextEvent.id;

    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    console.log(`Starting migration for event: ${eventId}`);

    while (hasMore) {
      const sessions: Stripe.Response<Stripe.ApiList<Stripe.Checkout.Session>> =
        await stripe.checkout.sessions.list({
          limit: 100,
          starting_after: startingAfter,
        });

      // Filter for soma space registrations
      const eventSessions = sessions.data.filter((session) => {
        if (session.payment_status !== "paid" || session.status !== "complete") {
          return false;
        }

        // Check if it has event_id metadata
        if (session.metadata?.event_id === eventId) {
          return true;
        }

        // Check if it's a legacy soma space registration
        const amountTotal = session.amount_total || 0;
        const amountInDollars = amountTotal / 100;
        const successUrl = session.success_url || "";

        const isInPriceRange = amountInDollars >= 22 && amountInDollars <= 44;
        const hasSomaSpaceUrl =
          successUrl.includes("/welcome") &&
          (successUrl.includes("entersoma.space") ||
            successUrl.includes("localhost:3000"));

        return isInPriceRange && hasSomaSpaceUrl;
      });

      // Sync each session to Supabase
      for (const session of eventSessions) {
        try {
          const amountPaid = (session.amount_total || 0) / 100;
          const paymentDate = new Date(
            (session.created || 0) * 1000
          ).toISOString();

          const rawName =
            session.customer_details?.name ||
            session.customer_details?.email ||
            "N/A";
          const { error } = await supabase.from("registrations").upsert(
            {
              session_id: session.id,
              event_id: session.metadata?.event_id || eventId,
              customer_name: capitalizeName(rawName),
              customer_email: session.customer_details?.email || "N/A",
              customer_phone: session.customer_details?.phone || null,
              amount_paid: amountPaid,
              payment_date: paymentDate,
              stripe_customer_id: session.customer || null,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "session_id",
            }
          );

          if (error) {
            console.error(`Error migrating session ${session.id}:`, error);
            errors++;
          } else {
            migrated++;
          }
        } catch (error) {
          console.error(`Error processing session ${session.id}:`, error);
          errors++;
        }
      }

      skipped += sessions.data.length - eventSessions.length;
      hasMore = sessions.has_more;

      if (sessions.data.length > 0) {
        startingAfter = sessions.data[sessions.data.length - 1].id;
      }
    }

    return NextResponse.json(
      {
        success: true,
        migrated,
        skipped,
        errors,
        message: `Migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`,
      },
      { headers }
    );
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      {
        error: "Migration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

