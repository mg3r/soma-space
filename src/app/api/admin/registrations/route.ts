import { NextResponse } from "next/server";
import { getEventRegistrations } from "@/lib/admin";

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

    const registrations = await getEventRegistrations(eventId);

    return NextResponse.json({ registrations }, { status: 200 });
  } catch (error) {
    console.error("Error fetching registrations:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch registrations", details: errorMessage },
      { status: 500 }
    );
  }
}

