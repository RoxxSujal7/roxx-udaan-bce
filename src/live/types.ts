export type MatchStatus =
  | "upcoming"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

export type MatchRound = "league" | "QF" | "SF" | "3P" | "F";

export type Department = "CSE" | "ECE" | "EE" | "ME" | "CE" | "Other";

export interface Team {
  id: string;
  event: string;
  name: string;
  department: Department;
  group_label: string | null;
  created_at: string;
}

export interface TeamStanding {
  team_id: string;
  team_name: string;
  department: Department;
  event: string;
  group_label: string | null;
  played: number;
  wins: number;
  losses: number;
  scored: number;
  conceded: number;
  difference: number;
  points: number;
}

export interface TeamHistoryEntry {
  team_id: string;
  match_id: string;
  event: string;
  round: MatchRound;
  stage: string | null;
  starts_at: string;
  venue: string;
  opponent: string | null;
  own_score: string | null;
  opp_score: string | null;
  outcome: "W" | "L";
  result: string | null;
}

export interface Match {
  id: string;
  event: string;
  title: string | null;
  stage: string | null;
  team_a: string | null;
  team_b: string | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  group_label?: string | null;
  round?: MatchRound;
  points_a?: number | null;
  points_b?: number | null;
  winner_id?: string | null;
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
