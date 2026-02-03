import { NextResponse } from "next/server";
import { capitalizeName } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { getActiveEventConfig } from "@/lib/event-config";

/** POST: Create a pending order (tickets list) for multi-ticket checkout. Returns { id } for use in waiver URL and create-checkout. */
export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }
  try {
    const body = await req.json();
    const { eventId: bodyEventId, tickets } = body as { eventId?: string; tickets?: Array<{ name: string; email: string; amount: number }> };

    const eventConfig = await getActiveEventConfig();
    const eventId = bodyEventId || eventConfig.event_id;
    const minAmount = (eventConfig.stripe_min_amount || 2200) / 100;
    const maxAmount = (eventConfig.stripe_max_amount || 4400) / 100;

    if (!Array.isArray(tickets) || tickets.length < 1 || tickets.length > 4) {
      return NextResponse.json(
        { error: "tickets must be an array of 1–4 items (purchaser + up to 3 guests)" },
        { status: 400 }
      );
    }
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      if (!t || typeof t.name !== "string" || typeof t.email !== "string" || typeof t.amount !== "number") {
        return NextResponse.json(
          { error: `ticket ${i + 1}: name, email, and amount (number) required` },
          { status: 400 }
        );
      }
      const amt = t.amount;
      if (amt < minAmount || amt > maxAmount) {
        return NextResponse.json(
          { error: `ticket ${i + 1}: amount must be between $${minAmount} and $${maxAmount}` },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from("pending_orders")
      .insert({
        event_id: eventId,
        tickets: tickets.map((t) => ({
          name: capitalizeName(String(t.name).trim()),
          email: String(t.email).trim().toLowerCase(),
          amount: Number(t.amount),
        })),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating pending order:", error);
      return NextResponse.json(
        { error: "Failed to create pending order", details: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ id: data.id });
  } catch (e) {
    console.error("pending-order POST:", e);
    return NextResponse.json(
      { error: "Failed to create pending order" },
      { status: 500 }
    );
  }
}
