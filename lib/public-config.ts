// Public Supabase configuration (publishable key only — protected by RLS).
// Never put SUPABASE_SECRET_KEY in this file.

export const SUPABASE_URL = "https://zwopaqmnzdxcxijiciqq.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_FTpcUxkGG8rOa0U5QzLHsQ_zgT9fyuP";

// Public ntfy.sh topic name (never put NTFY_TOKEN here). Leave empty to hide the card.
export const NTFY_PUBLIC_TOPIC = "";

export const FEATURES = {
  phonePush: true,
} as const;
