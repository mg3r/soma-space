import { NextResponse } from "next/server";
import {
  excludeRegistration,
  unexcludeRegistration,
} from "@/lib/admin";

export async function POST(req: Request) {
  try {
    const { sessionId, eventId, reason } = await req.json();

    if (!sessionId || !eventId) {
      return NextResponse.json(
        { error: "sessionId and eventId are required" },
        { status: 400 }
      );
    }

    await excludeRegistration(sessionId, eventId, reason);

    return NextResponse.json({
      success: true,
      message: "Registration excluded from capacity counts",
    });
  } catch (error) {
    console.error("Error excluding registration:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to exclude registration", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    await unexcludeRegistration(sessionId);

    return NextResponse.json({
      success: true,
      message: "Registration un-excluded from capacity counts",
    });
  } catch (error) {
    console.error("Error un-excluding registration:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to un-exclude registration", details: errorMessage },
      { status: 500 }
    );
  }
}

