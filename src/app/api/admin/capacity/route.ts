import { NextResponse } from "next/server";
import { getEventCapacity } from "@/lib/admin";

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

    const capacity = getEventCapacity(eventId);

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

    // Note: In a production app, you might want to store this in a database
    // For now, we'll use environment variables which require a redeploy to change
    // This endpoint will return success but note that env vars need to be updated in Vercel
    
    return NextResponse.json(
      {
        eventId,
        capacity,
        message: "Capacity updated. Note: Environment variables must be updated in Vercel for this to take effect.",
        note: `Set EVENT_CAPACITY_${eventId}=${capacity} or EVENT_CAPACITY=${capacity} in Vercel environment variables`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating capacity:", error);
    return NextResponse.json(
      { error: "Failed to update capacity" },
      { status: 500 }
    );
  }
}

