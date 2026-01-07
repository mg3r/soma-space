import { NextResponse } from "next/server";
import { getEventStats } from "@/lib/admin";
import { nextEvent } from "@/config/event";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || nextEvent.id;

    const stats = await getEventStats(eventId);

    return NextResponse.json({ stats }, { status: 200 });
  } catch (error) {
    console.error("Error fetching event status:", error);
    return NextResponse.json(
      { error: "Failed to fetch event status" },
      { status: 500 }
    );
  }
}

