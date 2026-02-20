import { NextResponse } from "next/server";
import { listWaiverSignaturesBySource } from "@/lib/waiver";
import type { WaiverSignatureSource } from "@/lib/waiver";

/**
 * GET /api/admin/waiver-signatures?source=walk_in&hours=168
 * Returns waiver signatures for the given source within the last N hours.
 * Used by admin "link to QR signer" picker.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source") as WaiverSignatureSource | null;
    const hoursParam = searchParams.get("hours");
    const hours = hoursParam ? parseInt(hoursParam, 10) : 168;

    if (!source || !["walk_in", "walk_in_paper", "admin", "web"].includes(source)) {
      return NextResponse.json(
        { error: "source is required and must be walk_in, walk_in_paper, admin, or web" },
        { status: 400 }
      );
    }

    const list = await listWaiverSignaturesBySource(source, hours);
    return NextResponse.json({ signatures: list });
  } catch (error) {
    console.error("[waiver-signatures] GET error:", error);
    return NextResponse.json(
      { error: "Failed to list waiver signatures" },
      { status: 500 }
    );
  }
}
