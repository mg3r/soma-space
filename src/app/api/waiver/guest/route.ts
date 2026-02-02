import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyGuestWaiverToken, recordWaiverSignature } from "@/lib/waiver";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email")?.trim()?.toLowerCase();
  if (!token || !email) {
    return NextResponse.json({ valid: false, error: "token and email required" }, { status: 400 });
  }
  if (!supabase) {
    return NextResponse.json({ valid: false, error: "not configured" }, { status: 500 });
  }
  // Token format: session_id|guest_index|email (signed). We need to find the guest row to get session_id and guest_index.
  // We can't decode session_id from token without verifying. So we need to verify by trying registration_guests: get by email and session_id... We don't have session_id in the URL. So we need to encode session_id and guest_index in the token payload so we can verify: verify(token, session_id, guest_index, email). So we need to look up by email and find which session_id + guest_index match. So: select session_id, guest_index, name from registration_guests where email = ?. Then for each row verifyGuestWaiverToken(token, session_id, guest_index, email). If one matches, return valid and guest name.
  const { data: guests } = await supabase
    .from("registration_guests")
    .select("session_id, guest_index, name")
    .eq("email", email);
  if (!guests?.length) {
    return NextResponse.json({ valid: false, error: "guest not found" }, { status: 404 });
  }
  for (const g of guests) {
    if (verifyGuestWaiverToken(token, g.session_id, g.guest_index, email)) {
      return NextResponse.json({
        valid: true,
        guestName: g.name || email,
        sessionId: g.session_id,
        guestIndex: g.guest_index,
      });
    }
  }
  return NextResponse.json({ valid: false, error: "invalid or expired link" }, { status: 400 });
}

export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  try {
    const body = await req.json();
    const { token, email: bodyEmail, firstName, lastName } = body;
    const email = (bodyEmail as string)?.trim()?.toLowerCase();
    if (!token || !email) {
      return NextResponse.json({ error: "token and email required" }, { status: 400 });
    }
    const { data: guests } = await supabase
      .from("registration_guests")
      .select("session_id, guest_index, name")
      .eq("email", email);
    if (!guests?.length) {
      return NextResponse.json({ error: "guest not found" }, { status: 404 });
    }
    let matched: { session_id: string; guest_index: number } | null = null;
    for (const g of guests) {
      if (verifyGuestWaiverToken(token, g.session_id, g.guest_index, email)) {
        matched = { session_id: g.session_id, guest_index: g.guest_index };
        break;
      }
    }
    if (!matched) {
      return NextResponse.json({ error: "invalid or expired link" }, { status: 400 });
    }
    const { error: signError } = await recordWaiverSignature(
      email,
      (firstName as string)?.trim() || "",
      (lastName as string)?.trim() || ""
    );
    if (signError) {
      return NextResponse.json({ error: signError }, { status: 500 });
    }
    const { error: updateError } = await supabase
      .from("registration_guests")
      .update({ waiver_signed_at: new Date().toISOString() })
      .eq("session_id", matched.session_id)
      .eq("guest_index", matched.guest_index);
    if (updateError) {
      console.error("[waiver/guest] update waiver_signed_at:", updateError);
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[waiver/guest] POST:", e);
    return NextResponse.json({ error: "Failed to record signature" }, { status: 500 });
  }
}
