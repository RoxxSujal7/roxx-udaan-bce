import type { LeaderboardRanking } from "@/components/ui/leaderboard-podium";
import type { Player } from "@/components/ui/leaderboard-table";
import type {
  ChampionshipStanding,
  Podium,
  TeamStanding,
} from "@/src/live/types";

const INDIVIDUAL_EVENTS = new Set<string>([
  "Badminton",
  "Table Tennis",
  "Athletics",
  "Board Games",
  "Javelin",
  "Literary",
]);

const TEAM_POINTS: Record<1 | 2 | 3, number> = { 1: 10, 2: 6, 3: 3 };
const INDIVIDUAL_POINTS: Record<1 | 2 | 3, number> = { 1: 5, 2: 3, 3: 1 };

export interface LeaderboardDataset {
  podiumRankings: LeaderboardRanking[];
  tablePlayers: Player[];
  entityHeader: "Team" | "Participant" | "Department";
  scoreHeader: "Pts";
}

export function isIndividualEvent(event: string): boolean {
  return INDIVIDUAL_EVENTS.has(event);
}

export function sortTeamStandings(rows: TeamStanding[]): TeamStanding[] {
  return rows.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.difference !== a.difference) return b.difference - a.difference;
    if (b.scored !== a.scored) return b.scored - a.scored;
    return a.team_name.localeCompare(b.team_name);
  });
}

/**
 * Adapt league/group `team_standings` for a single event (and optional group)
 * into synchronized `LeaderboardPodium` + `LeaderboardTable` datasets.
 */
export function adaptTeamStandingsToLeaderboard(
  standings: TeamStanding[],
  event: string,
  groupLabel?: string | null,
): LeaderboardDataset {
  const scoped = standings.filter((s) => {
    if (s.event !== event) return false;
    if (groupLabel !== undefined && groupLabel !== null) {
      return (s.group_label ?? "") === groupLabel;
    }
    return true;
  });

  const sorted = sortTeamStandings(scoped);

  const podiumRankings: LeaderboardRanking[] = sorted.slice(0, 3).map((r, idx) => ({
    userId: r.team_id,
    userName: r.team_name,
    rank: idx + 1,
    value: r.points,
    avatarUrl: null,
  }));

  const tablePlayers: Player[] = sorted.map((r, idx) => ({
    id: r.team_id,
    rank: idx + 1,
    name: r.team_name,
    handle: `${r.department}${r.group_label ? ` · ${r.group_label}` : ""} · ${r.wins}W-${r.losses}L · ${r.difference >= 0 ? `+${r.difference}` : r.difference}`,
    score: r.points,
  }));

  return {
    podiumRankings,
    tablePlayers,
    entityHeader: isIndividualEvent(event) ? "Participant" : "Team",
    scoreHeader: "Pts",
  };
}

/**
 * Adapt `podiums` for a single event (used for individual sports or events
 * with final podium results and no league `team_standings`).
 */
export function adaptPodiumsToLeaderboard(
  podiums: Podium[],
  event: string,
): LeaderboardDataset {
  const scoped = podiums
    .filter((p) => p.event === event)
    .slice()
    .sort((a, b) => a.place - b.place || a.awarded_at.localeCompare(b.awarded_at));

  const pointsMap = isIndividualEvent(event) ? INDIVIDUAL_POINTS : TEAM_POINTS;

  const podiumRankings: LeaderboardRanking[] = scoped.slice(0, 3).map((p) => ({
    userId: p.id,
    userName: p.label || p.department,
    rank: p.place,
    value: pointsMap[p.place],
    avatarUrl: null,
  }));

  const tablePlayers: Player[] = scoped.map((p) => ({
    id: p.id,
    rank: p.place,
    name: p.label || p.department,
    handle: p.label ? `${p.department} · ${event}` : event,
    score: pointsMap[p.place],
  }));

  return {
    podiumRankings,
    tablePlayers,
    entityHeader: isIndividualEvent(event) ? "Participant" : "Team",
    scoreHeader: "Pts",
  };
}

/**
 * Adapt overall `championship_standings` (already sorted by points, gold, silver, bronze, department)
 * into synchronized `LeaderboardPodium` + `LeaderboardTable` datasets.
 */
export function adaptChampionshipToLeaderboard(
  sortedRows: ChampionshipStanding[],
): LeaderboardDataset {
  const podiumRankings: LeaderboardRanking[] = sortedRows.slice(0, 3).map((r, idx) => ({
    userId: r.department,
    userName: r.department,
    rank: idx + 1,
    value: r.points,
    avatarUrl: null,
  }));

  const tablePlayers: Player[] = sortedRows.map((r, idx) => ({
    id: r.department,
    rank: idx + 1,
    name: r.department,
    handle: `🥇 ${r.gold} · 🥈 ${r.silver} · 🥉 ${r.bronze}`,
    score: r.points,
  }));

  return {
    podiumRankings,
    tablePlayers,
    entityHeader: "Department",
    scoreHeader: "Pts",
  };
}
