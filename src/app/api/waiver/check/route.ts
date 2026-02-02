import { NextResponse } from "next/server";
import { hasSignedWaiver } from "@/lib/waiver";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  if (!email || !email.trim()) {
    return NextResponse.json(
      { error: "Email is required", signed: false },
      { status: 400 }
    );
  }
  try {
    const signed = await hasSignedWaiver(email.trim());
    return NextResponse.json({ signed });
  } catch (error) {
    console.error("Waiver check error:", error);
    return NextResponse.json(
      { error: "Failed to check waiver status", signed: false },
      { status: 500 }
    );
  }
}
