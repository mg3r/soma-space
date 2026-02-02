import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createGuestWaiverToken } from "@/lib/waiver";
import { sendGuestWaiverReminderEmail } from "@/lib/email";
import { getActiveEventConfig } from "@/lib/event-config";

/**
 * POST /api/admin/resend-waiver
 * Body: { sessionId: string, guestIndex: number }
 * Loads guest from registration_guests, verifies they haven't signed, creates waiver token, sends waiver-only email.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, guestIndex } = body;

    if (sessionId == null || guestIndex == null) {
      return NextResponse.json(
        { error: "sessionId and guestIndex are required" },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const { data: guest, error: fetchError } = await supabase
      .from("registration_guests")
      .select("session_id, guest_index, name, email, waiver_signed_at")
      .eq("session_id", sessionId)
      .eq("guest_index", Number(guestIndex))
      .maybeSingle();

    if (fetchError || !guest) {
      return NextResponse.json(
        { error: "Guest not found" },
        { status: 404 }
      );
    }

    if (guest.waiver_signed_at) {
      return NextResponse.json(
        { error: "Guest has already signed the waiver" },
        { status: 400 }
      );
    }

    const email = (guest.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "Guest has no email" },
        { status: 400 }
      );
    }

    const token = createGuestWaiverToken(
      guest.session_id,
      guest.guest_index,
      email
    );
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://entersoma.space";
    const waiverLink = `${baseUrl}/waiver/guest?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    const eventConfig = await getActiveEventConfig();
    const primaryColor = eventConfig.primary_color || "#05fd00";

    await sendGuestWaiverReminderEmail(
      email,
      guest.name || "Guest",
      waiverLink,
      primaryColor
    );

    return NextResponse.json({
      success: true,
      message: "Waiver reminder email sent",
    });
  } catch (error) {
    console.error("Error resending waiver:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to resend waiver", details: errorMessage },
      { status: 500 }
    );
  }
}
