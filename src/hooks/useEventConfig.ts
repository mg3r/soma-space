"use client";

import { useState, useEffect } from "react";

type EventConfig = {
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
  multi_ticket_enabled?: boolean;
  max_guests_per_order?: number;
};

type Event = {
  id: string;
  name: string;
  date: string;
  time: string;
  place: string;
  address: string;
  note: string;
};

export function useEventConfig() {
  const [event, setEvent] = useState<Event | null>(null);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [primaryColor, setPrimaryColor] = useState("#05fd00");
  const [backgroundColor, setBackgroundColor] = useState("#111111");

  useEffect(() => {
    async function fetchEventConfig() {
      try {
        const res = await fetch("/api/event-config");
        if (res.ok) {
          const data = await res.json();
          setEvent(data.event);
          setConfig(data.config);
          
          // Update colors if available
          if (data.config?.primary_color) {
            setPrimaryColor(data.config.primary_color);
          }
          if (data.config?.background_color) {
            setBackgroundColor(data.config.background_color);
          }
        }
      } catch (error) {
        console.error("Error fetching event config:", error);
        // Fallback to defaults
        setEvent({
          id: "RENEWAL",
          name: "RENEWAL",
          date: "friday, 1/23",
          time: "7:00–9:30 pm",
          place: "farfields farm",
          address: "40 farfields ln, afton, va 22920",
          note: "exact address shared after reserving.",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchEventConfig();
  }, []);

  return { event, config, isLoading, primaryColor, backgroundColor };
}
