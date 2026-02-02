import { NextResponse } from "next/server";
import { recordWaiverSignature } from "@/lib/waiver";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, firstName, lastName } = body;
    if (!email || !String(email).trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }
    if (!firstName || !String(firstName).trim()) {
      return NextResponse.json(
        { error: "First name is required" },
        { status: 400 }
      );
    }
    if (!lastName || !String(lastName).trim()) {
      return NextResponse.json(
        { error: "Last name is required" },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    const result = await recordWaiverSignature(
      String(email).trim(),
      String(firstName).trim(),
      String(lastName).trim(),
      { ipAddress: ip ?? undefined, userAgent: userAgent ?? undefined, waiverVersion: "1" }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to record signature" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waiver sign error:", error);
    return NextResponse.json(
      { error: "Failed to record waiver signature" },
      { status: 500 }
    );
  }
}
