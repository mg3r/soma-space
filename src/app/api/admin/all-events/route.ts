import { NextResponse } from "next/server";
import { getAllEventsSummary } from "@/lib/admin";

export async function GET() {
  try {
    const { metrics, people } = await getAllEventsSummary();
    return NextResponse.json({ metrics, people }, { status: 200 });
  } catch (error) {
    console.error("Error fetching all-events summary:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch all-events summary", details: errorMessage },
      { status: 500 }
    );
  }
}
