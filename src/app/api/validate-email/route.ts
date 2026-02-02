import { NextResponse } from "next/server";

// Format-only check: fast, no DNS/MX (avoids 5–8s timeouts in serverless).
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.trim();

  if (!email) {
    return NextResponse.json(
      { valid: false, error: "email is required" },
      { status: 400 }
    );
  }

  if (email.length > 254) {
    return NextResponse.json(
      { valid: false, error: "email too long" },
      { status: 200 }
    );
  }

  if (!EMAIL_FORMAT.test(email)) {
    return NextResponse.json(
      { valid: false, error: "please enter a valid email address" },
      { status: 200 }
    );
  }

  return NextResponse.json({ valid: true });
}
