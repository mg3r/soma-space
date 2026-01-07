import { NextResponse } from "next/server";
import { addToWaitlist } from "@/lib/admin";
import { nextEvent } from "@/config/event";

export async function POST(req: Request) {
  try {
    const { name, email, phone, eventId } = await req.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const targetEventId = eventId || nextEvent.id;

    await addToWaitlist(targetEventId, name, email, phone);

    return NextResponse.json(
      { success: true, message: "Added to waitlist successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error adding to waitlist:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes("not configured")) {
      return NextResponse.json(
        {
          error: "Waitlist not available",
          message: "Please reach out directly to be added to the waitlist.",
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to add to waitlist", details: errorMessage },
      { status: 500 }
    );
  }
}

