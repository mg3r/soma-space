// Default fallback event (for backward compatibility)
export const nextEvent = {
    id: "RENEWAL",
    name: "RENEWAL",
    date: "friday, 1/23",
    time: "7:00–9:30 pm",
    place: "farfields farm",
    address: "40 farfields ln, afton, va 22920",
    note: "exact address shared after reserving.",
  };

// Helper to convert EventConfig to nextEvent format
export function configToEvent(config: {
  event_id: string;
  event_name: string;
  event_date: string;
  event_time: string;
  event_place: string;
  event_address: string;
  event_note?: string;
}) {
  return {
    id: config.event_id,
    name: config.event_name,
    date: config.event_date,
    time: config.event_time,
    place: config.event_place,
    address: config.event_address,
    note: config.event_note || "",
  };
}