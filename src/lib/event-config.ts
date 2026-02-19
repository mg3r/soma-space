import { supabase } from "./supabase";

export type EventConfig = {
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
  /** Allow purchaser to buy multiple tickets (1 + guests); max tickets = max_guests_per_order + 1 */
  multi_ticket_enabled?: boolean;
  /** Max additional guests per order (default 3 → max 4 tickets total) */
  max_guests_per_order?: number;
  created_at?: string;
  updated_at?: string;
};

// Default fallback event config (matches current hardcoded values)
const defaultEventConfig: EventConfig = {
  event_id: "RENEWAL",
  event_name: "RENEWAL",
  event_date: "friday, 1/23",
  event_time: "7:00–9:30 pm",
  event_place: "farfields farm",
  event_address: "40 farfields ln, afton, va 22920",
  event_note: "exact address shared after reserving.",
  event_description: "mountain views, earth home, farm setting, cacao, live dj set",
  chat_welcome_message: "hey :) welcome to soma space",
  chat_intro_message: "this is a movement gathering rooted in presence and free expression, with gentle guidance throughout. no experience required — just come as you are",
  chat_password_prompt: "to see details of our next gathering and reserve your spot, type the password",
  chat_access_granted_message: "access granted",
  chat_event_announcement: "join us for RENEWAL",
  chat_event_description: "mountain views, earth home, farm setting, cacao, live dj set",
  chat_location_message: "location shared after reserving (~25 minutes west of downtown mall)",
  chat_contribution_message: "sliding scale contribution ($22–$44, your choice). please reach out if you need support",
  chat_full_message: "we checked, and this gathering is currently full",
  chat_waitlist_message: "join the waitlist and we'll reach out if a spot opens. we'll also let you know about future gatherings",
  primary_color: "#05fd00",
  background_color: "#111111",
  stripe_product_name: "soma space",
  stripe_product_description: "soma space is a guided movement gathering rooted in presence, free expression, and connection. participants are invited to move with music and explore embodied awareness. no prior movement or dance experience is required.\n\nno one is ever turned away for not having enough. if you need financial support, please reach out to us directly.",
  stripe_image_url: "",
  stripe_min_amount: 2200,
  stripe_max_amount: 4400,
  capacity: 25,
  multi_ticket_enabled: false,
  max_guests_per_order: 3,
};

/**
 * Get the active event config from database, with fallback to default
 */
export async function getActiveEventConfig(): Promise<EventConfig> {
  // Try to get from Supabase first (if configured)
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("event_config")
        .select("*")
        .eq("is_active", true)
        .single();

      if (!error && data) {
        // Merge with defaults to ensure all fields are present
        return { ...defaultEventConfig, ...data };
      }
    } catch (error) {
      console.log("Supabase query failed, falling back to default config:", error);
    }
  }

  // Fallback to default config
  return defaultEventConfig;
}

/**
 * Get event config by event_id, with fallback to default
 */
export async function getEventConfigByEventId(eventId: string): Promise<EventConfig> {
  // Try to get from Supabase first (if configured)
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("event_config")
        .select("*")
        .eq("event_id", eventId)
        .single();

      if (!error && data) {
        // Merge with defaults to ensure all fields are present
        return { ...defaultEventConfig, ...data };
      }
    } catch (error) {
      console.log("Supabase query failed, falling back to default config:", error);
    }
  }

  // Fallback to default config if event_id matches, otherwise return default
  if (eventId === defaultEventConfig.event_id) {
    return defaultEventConfig;
  }

  // Return default config with updated event_id
  return { ...defaultEventConfig, event_id: eventId };
}

/**
 * Get event password from config, with fallback to environment variable
 */
export async function getEventPassword(): Promise<string | undefined> {
  const config = await getActiveEventConfig();
  return config.event_password || process.env.EVENT_PASSWORD;
}
