import { NextResponse } from "next/server";
import { getRegistrationsOverTime } from "@/lib/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    const daysParam = searchParams.get("days");
    const days = daysParam ? Math.min(90, Math.max(7, parseInt(daysParam, 10) || 30)) : 30;
    if (!eventId) {
      return NextResponse.json({ error: "eventId parameter is required" }, { status: 400 });
    }
    const { series, newThisWeek } = await getRegistrationsOverTime(eventId, days);
    return NextResponse.json({ series, newThisWeek }, { status: 200 });
  } catch (error) {
    console.error("Error fetching registrations over time:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch registrations over time", details: errorMessage },
      { status: 500 }
    );
  }
}
