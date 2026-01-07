import { NextResponse } from "next/server";
import { getEventStats } from "@/lib/admin";

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

    const stats = await getEventStats(eventId);

    return NextResponse.json({ stats }, { status: 200 });
  } catch (error) {
    console.error("Error fetching stats:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch stats", details: errorMessage },
      { status: 500 }
    );
  }
}

