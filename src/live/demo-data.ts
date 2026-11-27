import type {
  ChampionshipStanding,
  Podium,
  TeamStanding,
} from "@/src/live/types";

export function isLocalDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host !== "127.0.0.1" && host !== "localhost") return false;
  return new URLSearchParams(window.location.search).get("demo") === "1";
}

export const DEMO_TEAM_STANDINGS: TeamStanding[] = [
  { team_id: "d-c1", team_name: "CSE Strikers", department: "CSE", event: "Cricket", group_label: "Group A", played: 3, wins: 3, losses: 0, scored: 320, conceded: 240, difference: 80, points: 9 },
  { team_id: "d-c2", team_name: "ME Titans", department: "ME", event: "Cricket", group_label: "Group A", played: 3, wins: 2, losses: 1, scored: 290, conceded: 265, difference: 25, points: 6 },
  { team_id: "d-c3", team_name: "ECE Royals", department: "ECE", event: "Cricket", group_label: "Group A", played: 3, wins: 1, losses: 2, scored: 250, conceded: 270, difference: -20, points: 3 },
  { team_id: "d-c4", team_name: "CE Warriors", department: "CE", event: "Cricket", group_label: "Group A", played: 3, wins: 0, losses: 3, scored: 210, conceded: 295, difference: -85, points: 0 },
  { team_id: "d-f1", team_name: "EE United", department: "EE", event: "Football", group_label: null, played: 3, wins: 3, losses: 0, scored: 8, conceded: 2, difference: 6, points: 9 },
  { team_id: "d-f2", team_name: "CSE FC", department: "CSE", event: "Football", group_label: null, played: 3, wins: 2, losses: 1, scored: 6, conceded: 4, difference: 2, points: 6 },
  { team_id: "d-f3", team_name: "ME Rovers", department: "ME", event: "Football", group_label: null, played: 3, wins: 1, losses: 2, scored: 4, conceded: 6, difference: -2, points: 3 },
  { team_id: "d-b1", team_name: "CSE Phantom", department: "CSE", event: "BGMI", group_label: null, played: 4, wins: 3, losses: 1, scored: 68, conceded: 32, difference: 36, points: 9 },
  { team_id: "d-b2", team_name: "ECE Apex", department: "ECE", event: "BGMI", group_label: null, played: 4, wins: 2, losses: 2, scored: 54, conceded: 41, difference: 13, points: 6 },
  { team_id: "d-b3", team_name: "EE Blitz", department: "EE", event: "BGMI", group_label: null, played: 4, wins: 1, losses: 3, scored: 39, conceded: 55, difference: -16, points: 3 },
  { team_id: "d-ff1", team_name: "ME Inferno", department: "ME", event: "Free Fire", group_label: null, played: 3, wins: 3, losses: 0, scored: 52, conceded: 20, difference: 32, points: 9 },
  { team_id: "d-ff2", team_name: "CSE Rush", department: "CSE", event: "Free Fire", group_label: null, played: 3, wins: 2, losses: 1, scored: 41, conceded: 29, difference: 12, points: 6 },
  { team_id: "d-ff3", team_name: "CE Spark", department: "CE", event: "Free Fire", group_label: null, played: 3, wins: 1, losses: 2, scored: 28, conceded: 42, difference: -14, points: 3 },
  { team_id: "d-v1", team_name: "CSE Vanguards", department: "CSE", event: "Valorant", group_label: null, played: 2, wins: 2, losses: 0, scored: 26, conceded: 14, difference: 12, points: 6 },
  { team_id: "d-v2", team_name: "ECE Sentinels", department: "ECE", event: "Valorant", group_label: null, played: 2, wins: 1, losses: 1, scored: 20, conceded: 21, difference: -1, points: 3 },
  { team_id: "d-v3", team_name: "ME Clutch", department: "ME", event: "Valorant", group_label: null, played: 2, wins: 0, losses: 2, scored: 12, conceded: 26, difference: -14, points: 0 },
];

export const DEMO_PODIUMS: Podium[] = [
  { id: "dp-1", event: "Badminton", place: 1, department: "CSE", team_id: null, label: "Aarav Sharma", awarded_at: "2026-11-27T10:00:00Z" },
  { id: "dp-2", event: "Badminton", place: 2, department: "ECE", team_id: null, label: "Riya Verma", awarded_at: "2026-11-27T10:05:00Z" },
  { id: "dp-3", event: "Badminton", place: 3, department: "ME", team_id: null, label: "Kabir Das", awarded_at: "2026-11-27T10:10:00Z" },
  { id: "dp-4", event: "Athletics", place: 1, department: "EE", team_id: null, label: "Vikram Singh", awarded_at: "2026-11-27T11:00:00Z" },
  { id: "dp-5", event: "Athletics", place: 2, department: "CSE", team_id: null, label: "Ananya Roy", awarded_at: "2026-11-27T11:05:00Z" },
  { id: "dp-6", event: "Athletics", place: 3, department: "CE", team_id: null, label: "Rohan Kumar", awarded_at: "2026-11-27T11:10:00Z" },
];

export const DEMO_CHAMPIONSHIP_STANDINGS: ChampionshipStanding[] = [
  { department: "CSE", counts_for: "udaan", gold: 3, silver: 2, bronze: 1, points: 43 },
  { department: "ECE", counts_for: "udaan", gold: 2, silver: 2, bronze: 1, points: 35 },
  { department: "ME", counts_for: "udaan", gold: 1, silver: 2, bronze: 2, points: 28 },
  { department: "EE", counts_for: "udaan", gold: 1, silver: 1, bronze: 1, points: 19 },
  { department: "CE", counts_for: "udaan", gold: 0, silver: 1, bronze: 2, points: 12 },
  { department: "CSE", counts_for: "ignition", gold: 2, silver: 1, bronze: 0, points: 26 },
  { department: "ME", counts_for: "ignition", gold: 1, silver: 0, bronze: 1, points: 13 },
  { department: "ECE", counts_for: "ignition", gold: 0, silver: 2, bronze: 0, points: 12 },
];
