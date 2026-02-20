import { NextResponse } from "next/server";
import { recordWaiverSignature } from "@/lib/waiver";
import { supabase } from "@/lib/supabase";
import type { WaiverSignatureSource } from "@/lib/waiver";

/**
 * POST /api/admin/mark-waiver-signed
 *
 * Path A (link to QR signature): { source: 'walk_in', waiverSignatureId, sessionId, guestIndex? }
 * Path B (create new): { source: 'walk_in_paper' | 'admin', email, firstName, lastName, sessionId, guestIndex? }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      source,
      waiverSignatureId,
      sessionId,
      guestIndex,
      email,
      firstName,
      lastName,
    } = body;

    if (!source || !["walk_in", "walk_in_paper", "admin"].includes(source)) {
      return NextResponse.json(
        { error: "source is required and must be walk_in, walk_in_paper, or admin" },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const isPathA = source === "walk_in" && waiverSignatureId && sessionId != null;

    if (isPathA) {
      if (guestIndex != null) {
        const { error: guestErr } = await supabase
          .from("registration_guests")
          .update({
            waiver_signature_id: waiverSignatureId,
            waiver_signed_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId)
          .eq("guest_index", Number(guestIndex));
        if (guestErr) {
          console.error("[mark-waiver-signed] guest update:", guestErr);
          return NextResponse.json(
            { error: guestErr.message || "Failed to link guest to waiver" },
            { status: 500 }
          );
        }
      } else {
        const { error: regErr } = await supabase
          .from("registrations")
          .update({ waiver_signature_id: waiverSignatureId })
          .eq("session_id", sessionId);
        if (regErr) {
          console.error("[mark-waiver-signed] registration update:", regErr);
          return NextResponse.json(
            { error: regErr.message || "Failed to link registration to waiver" },
            { status: 500 }
          );
        }
      }
      return NextResponse.json({ success: true });
    }

    if (source === "walk_in_paper" || source === "admin") {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const fn = String(firstName || "").trim();
      const ln = String(lastName || "").trim();
      if (!normalizedEmail || !fn || !ln) {
        return NextResponse.json(
          { error: "email, firstName, and lastName are required for walk_in_paper and admin" },
          { status: 400 }
        );
      }
      const result = await recordWaiverSignature(normalizedEmail, fn, ln, {
        source: source as WaiverSignatureSource,
      });
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to record signature" },
          { status: 500 }
        );
      }
      const { error: guestErr } = await supabase
        .from("registration_guests")
        .update({ waiver_signed_at: new Date().toISOString() })
        .eq("email", normalizedEmail);
      if (guestErr) {
        console.error("[mark-waiver-signed] registration_guests update:", guestErr);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("[mark-waiver-signed] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to mark waiver as signed" },
      { status: 500 }
    );
  }
}
