import { NextResponse } from "next/server";
import { getActiveEventConfig } from "@/lib/event-config";

// GET - Get active event config (for client-side components)
export async function GET() {
  try {
    const config = await getActiveEventConfig();
    
    // Convert to nextEvent format for backward compatibility
    const event = {
      id: config.event_id,
      name: config.event_name,
      date: config.event_date,
      time: config.event_time,
      place: config.event_place,
      address: config.event_address,
      note: config.event_note || "",
    };

    return NextResponse.json({ 
      event,
      config, // Also return full config for advanced use
    });
  } catch (error) {
    console.error("Error fetching active event config:", error);
    // Return default fallback
    return NextResponse.json({
      event: {
        id: "RENEWAL",
        name: "RENEWAL",
        date: "friday, 1/23",
        time: "7:00–9:30 pm",
        place: "farfields farm",
        address: "40 farfields ln, afton, va 22920",
        note: "exact address shared after reserving.",
      },
      config: null,
    });
  }
}
