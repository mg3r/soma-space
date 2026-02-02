import { NextResponse } from "next/server";
import { excludeGuest, unexcludeGuest } from "@/lib/admin";

export async function POST(req: Request) {
  try {
    const { sessionId, guestIndex, eventId } = await req.json();

    if (sessionId == null || guestIndex == null || !eventId) {
      return NextResponse.json(
        { error: "sessionId, guestIndex, and eventId are required" },
        { status: 400 }
      );
    }

    await excludeGuest(sessionId, Number(guestIndex));

    return NextResponse.json({
      success: true,
      message: "Guest excluded from capacity count",
    });
  } catch (error) {
    console.error("Error excluding guest:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to exclude guest", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const guestIndex = searchParams.get("guestIndex");

    if (!sessionId || guestIndex == null) {
      return NextResponse.json(
        { error: "sessionId and guestIndex are required" },
        { status: 400 }
      );
    }

    await unexcludeGuest(sessionId, Number(guestIndex));

    return NextResponse.json({
      success: true,
      message: "Guest un-excluded from capacity count",
    });
  } catch (error) {
    console.error("Error un-excluding guest:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to un-exclude guest", details: errorMessage },
      { status: 500 }
    );
  }
}
