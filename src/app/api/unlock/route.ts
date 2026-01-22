import { NextResponse } from "next/server";
import { getEventPassword } from "@/lib/event-config";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));

  const eventPassword = await getEventPassword();
  const correctPassword = eventPassword || process.env.EVENT_PASSWORD;

  if (!correctPassword || password !== correctPassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}