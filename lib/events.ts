// Shared event lists — imported by multistep-form.tsx, admin dashboard, and API function.
// Keep in sync with functions/api/registrations.ts ALLOWED_EVENTS.

export const UDAAN_SPORTS_AND_CULTURAL_EVENTS = [
  "Cricket",
  "Football",
  "Badminton",
  "Table Tennis",
  "Volleyball",
  "Athletics",
  "Board Games",
  "Javelin",
  "Kabaddi",
  "Tug of War",
  "Literary",
  "Cultural",
] as const;

export const IGNITION_ESPORTS_EVENTS = [
  "BGMI",
  "Free Fire",
  "Valorant",
] as const;

export const ALL_ALLOWED_EVENTS = [
  ...UDAAN_SPORTS_AND_CULTURAL_EVENTS,
  ...IGNITION_ESPORTS_EVENTS,
] as const;

export type UdaanEvent = (typeof ALL_ALLOWED_EVENTS)[number];

const IGNITION_SET = new Set<string>(IGNITION_ESPORTS_EVENTS);
const LEGACY_SET = new Set<string>(["COD Mobile", "Clash Royale"]);

export function getEventGroup(event: string): "UDAAN" | "IGNITION" | "Legacy" {
  if (IGNITION_SET.has(event)) return "IGNITION";
  if (LEGACY_SET.has(event)) return "Legacy";
  return "UDAAN";
}
