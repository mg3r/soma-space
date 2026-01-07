import { NextResponse } from "next/server";
import { getWaitlistEntries } from "@/lib/admin";

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

    const waitlist = await getWaitlistEntries(eventId);

    return NextResponse.json({ waitlist }, { status: 200 });
  } catch (error) {
    console.error("Error fetching waitlist:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch waitlist", details: errorMessage },
      { status: 500 }
    );
  }
}

