export type MatchStatus =
  | "upcoming"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

export interface Match {
  id: string;
  event: string;
  title: string | null;
  stage: string | null;
  team_a: string | null;
  team_b: string | null;
  venue: string;
  starts_at: string;
  status: MatchStatus;
  score_a: string | null;
  score_b: string | null;
  result: string | null;
  hidden: boolean;
  updated_at: string;
  created_at: string;
}

export type AnnouncementLevel = "info" | "important" | "urgent";

export interface Announcement {
  id: string;
  message: string;
  level: AnnouncementLevel;
  link: string | null;
  active: boolean;
  expires_at: string | null;
  created_at: string;
  source?: "admin" | "whatsapp";
  posted_by?: string | null;
}

export type LiveConnectionState =
  | "connecting"
  | "realtime"
  | "fallback"
  | "offline";
