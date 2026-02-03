import { NextResponse } from "next/server";
import { getAbandonmentFunnel } from "@/lib/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json({ error: "eventId parameter is required" }, { status: 400 });
    }
    const funnel = await getAbandonmentFunnel(eventId);
    return NextResponse.json({ funnel }, { status: 200 });
  } catch (error) {
    console.error("Error fetching funnel:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch funnel", details: errorMessage },
      { status: 500 }
    );
  }
}
