import { NextResponse } from "next/server";
import { getEventCapacity, setEventCapacity } from "@/lib/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId parameter is required" },
        { status: 400 }
      );
    }

    const capacity = await getEventCapacity(eventId);

    return NextResponse.json({ eventId, capacity }, { status: 200 });
  } catch (error) {
    console.error("Error fetching capacity:", error);
    return NextResponse.json(
      { error: "Failed to fetch capacity" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const { eventId, capacity } = await req.json();

    if (!eventId || capacity === undefined) {
      return NextResponse.json(
        { error: "eventId and capacity are required" },
        { status: 400 }
      );
    }

    if (typeof capacity !== "number" || capacity < 0) {
      return NextResponse.json(
        { error: "Capacity must be a positive number" },
        { status: 400 }
      );
    }

    try {
      // Update capacity in Supabase
      await setEventCapacity(eventId, capacity);
      
      return NextResponse.json(
        {
          eventId,
          capacity,
          message: "Capacity updated successfully",
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error updating capacity:", error);
      // Fallback: return success but note that Supabase might not be configured
      return NextResponse.json(
        {
          eventId,
          capacity,
          message: "Capacity update noted. If Supabase is not configured, update environment variables in Vercel.",
          note: `Set EVENT_CAPACITY_${eventId}=${capacity} or EVENT_CAPACITY=${capacity} in Vercel environment variables if Supabase is not set up`,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error updating capacity:", error);
    return NextResponse.json(
      { error: "Failed to update capacity" },
      { status: 500 }
    );
  }
}

