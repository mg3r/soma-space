import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type EventConfig = {
  id?: string;
  event_id: string;
  event_name: string;
  event_date: string;
  event_time: string;
  event_place: string;
  event_address: string;
  event_note?: string;
  event_description?: string;
  chat_welcome_message?: string;
  chat_intro_message?: string;
  chat_password_prompt?: string;
  chat_access_granted_message?: string;
  chat_event_announcement?: string;
  chat_event_description?: string;
  chat_location_message?: string;
  chat_contribution_message?: string;
  chat_full_message?: string;
  chat_waitlist_message?: string;
  primary_color?: string;
  background_color?: string;
  stripe_product_name?: string;
  stripe_product_description?: string;
  stripe_image_url?: string;
  stripe_min_amount?: number;
  stripe_max_amount?: number;
  event_password?: string;
  capacity?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

// GET - Get active event config or list all configs
export async function GET(req: Request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    const activeOnly = searchParams.get("active") === "true";

    if (activeOnly) {
      // Get active event config
      const { data, error } = await supabase
        .from("event_config")
        .select("*")
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" - that's OK, we'll return null
        console.error("Error fetching active event config:", error);
        return NextResponse.json(
          { error: "Failed to fetch active config" },
          { status: 500 }
        );
      }

      return NextResponse.json({ config: data || null });
    }

    if (eventId) {
      // Get specific event config
      const { data, error } = await supabase
        .from("event_config")
        .select("*")
        .eq("event_id", eventId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching event config:", error);
        return NextResponse.json(
          { error: "Failed to fetch config" },
          { status: 500 }
        );
      }

      return NextResponse.json({ config: data || null });
    }

    // List all event configs
    const { data, error } = await supabase
      .from("event_config")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching event configs:", error);
      return NextResponse.json(
        { error: "Failed to fetch configs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ configs: data || [] });
  } catch (error) {
    console.error("Error in GET event config:", error);
    return NextResponse.json(
      { error: "Failed to fetch config" },
      { status: 500 }
    );
  }
}

// POST - Create a new event config
export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  try {
    const body: EventConfig = await req.json();
    const {
      event_id,
      event_name,
      event_date,
      event_time,
      event_place,
      event_address,
      is_active,
    } = body;

    if (!event_id || !event_name || !event_date || !event_time || !event_place || !event_address) {
      return NextResponse.json(
        { error: "event_id, event_name, event_date, event_time, event_place, and event_address are required" },
        { status: 400 }
      );
    }

    // If setting this as active, deactivate all other events
    if (is_active) {
      await supabase
        .from("event_config")
        .update({ is_active: false })
        .neq("event_id", event_id);
    }

    const { data, error } = await supabase
      .from("event_config")
      .insert({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating event config:", error);
      return NextResponse.json(
        { error: "Failed to create config" },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error("Error in POST event config:", error);
    return NextResponse.json(
      { error: "Failed to create config" },
      { status: 500 }
    );
  }
}

// PUT - Update an existing event config
export async function PUT(req: Request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  try {
    const body: EventConfig & { id?: string; event_id?: string } = await req.json();
    const { id, event_id, is_active } = body;

    if (!id && !event_id) {
      return NextResponse.json(
        { error: "id or event_id is required" },
        { status: 400 }
      );
    }

    // If setting this as active, deactivate all other events
    if (is_active) {
      const targetEventId = event_id || (await supabase
        .from("event_config")
        .select("event_id")
        .eq("id", id)
        .single()).data?.event_id;

      if (targetEventId) {
        await supabase
          .from("event_config")
          .update({ is_active: false })
          .neq("event_id", targetEventId);
      }
    }

    const updateData = { ...body };
    delete updateData.id;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("event_config")
      .update(updateData)
      .eq(id ? "id" : "event_id", id || event_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating event config:", error);
      return NextResponse.json(
        { error: "Failed to update config" },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error("Error in PUT event config:", error);
    return NextResponse.json(
      { error: "Failed to update config" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an event config
export async function DELETE(req: Request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const eventId = searchParams.get("eventId");

    if (!id && !eventId) {
      return NextResponse.json(
        { error: "id or eventId parameter is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("event_config")
      .delete()
      .eq(id ? "id" : "event_id", id || eventId);

    if (error) {
      console.error("Error deleting event config:", error);
      return NextResponse.json(
        { error: "Failed to delete config" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE event config:", error);
    return NextResponse.json(
      { error: "Failed to delete config" },
      { status: 500 }
    );
  }
}
