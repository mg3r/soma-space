import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { password } = await req.json().catch(() => ({ password: "" }));

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    // Set auth cookie (expires in 30 days)
    const cookieStore = await cookies();
    cookieStore.set("admin_auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Check if user is authenticated
  try {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get("admin_auth");

    if (authCookie?.value === "authenticated") {
      return NextResponse.json({ authenticated: true }, { status: 200 });
    }

    return NextResponse.json({ authenticated: false }, { status: 401 });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

export async function DELETE() {
  // Logout - clear auth cookie
  try {
    const cookieStore = await cookies();
    cookieStore.delete("admin_auth");
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
