import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { password } = await req.json().catch(() => ({ password: "" }));

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

