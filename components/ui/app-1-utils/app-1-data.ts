import { getEventGroup } from "@/lib/events";
import type { ChartConfig } from "@/components/ui/chart";

export interface Registration {
  id: string;
  submission_id: string;
  full_name: string;
  email: string;
  phone: string;
  college: string;
  roll_number: string | null;
  department: string | null;
  academic_year: string | null;
  events: string[];
  participation_type: "individual" | "team";
  team_name: string | null;
  team_members: string | null;
  notes: string | null;
  confirmed_details: boolean;
  status: string;
  created_at: string;
}

// ─── Chart Config ──────────────────────────────────────────────────────────

export const app1ChartConfig: ChartConfig = {
  udaan: {
    label: "UDAAN (Sports & Cultural)",
    color: "var(--chart-1)",
  },
  ignition: {
    label: "IGNITION (Esports)",
    color: "var(--chart-2)",
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Format a UTC ISO date string into an IST "26 Nov" label. */
function toISTDay(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  });
}

/** Get today's date string in IST. */
function todayIST(): string {
  return toISTDay(new Date().toISOString());
}

function startOfISTDay(daysAgo: number): Date {
  const ist = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  ist.setDate(ist.getDate() - daysAgo);
  ist.setHours(0, 0, 0, 0);
  return ist;
}

// ─── Daily Chart ───────────────────────────────────────────────────────────

export interface DailyChartPoint {
  day: string;
  udaan: number;
  ignition: number;
}

export function buildDailyChart(rows: Registration[]): DailyChartPoint[] {
  const cutoff = startOfISTDay(29); // Last 30 days (today is day 0)

  // Build a map: IST-day label → { udaan, ignition }
  const map = new Map<string, { udaan: number; ignition: number }>();

  // Pre-populate the last 30 days so we always have a point even with zero rows
  for (let i = 29; i >= 0; i--) {
    const label = toISTDay(startOfISTDay(i).toISOString());
    if (!map.has(label)) {
      map.set(label, { udaan: 0, ignition: 0 });
    }
  }

  for (const row of rows) {
    const d = new Date(row.created_at);
    if (d < cutoff) continue;
    const label = toISTDay(row.created_at);
    if (!map.has(label)) map.set(label, { udaan: 0, ignition: 0 });
    const entry = map.get(label)!;
    const events: string[] = Array.isArray(row.events) ? row.events : [];
    const hasUdaan = events.some((e) => getEventGroup(e) === "UDAAN");
    const hasIgnition = events.some((e) => getEventGroup(e) === "IGNITION");
    if (hasUdaan) entry.udaan += 1;
    if (hasIgnition) entry.ignition += 1;
  }

  return Array.from(map.entries()).map(([day, counts]) => ({
    day,
    ...counts,
  }));
}

// ─── Event Stats ───────────────────────────────────────────────────────────

export interface EventStat {
  event: string;
  group: "UDAAN" | "IGNITION" | "Legacy";
  count: number;
  teamCount: number;
}

export function buildEventStats(rows: Registration[]): EventStat[] {
  const statMap = new Map<string, { count: number; teamCount: number }>();

  for (const row of rows) {
    const events: string[] = Array.isArray(row.events) ? row.events : [];
    for (const ev of events) {
      if (!statMap.has(ev)) statMap.set(ev, { count: 0, teamCount: 0 });
      const s = statMap.get(ev)!;
      s.count += 1;
      if (row.participation_type === "team") s.teamCount += 1;
    }
  }

  return Array.from(statMap.entries())
    .map(([event, { count, teamCount }]) => ({
      event,
      group: getEventGroup(event),
      count,
      teamCount,
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── Recent Activity ───────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  person: { name: string; initials: string };
  action: string;
  time: string;
}

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function buildRecentActivity(
  rows: Registration[],
  limit = 8,
): ActivityEntry[] {
  return rows.slice(0, limit).map((row) => {
    const events: string[] = Array.isArray(row.events) ? row.events : [];
    return {
      id: row.id,
      person: { name: row.full_name, initials: initials(row.full_name) },
      action: `registered for ${events.join(", ") || "—"}`,
      time: relativeTime(row.created_at),
    };
  });
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total: number;
  todayCount: number;
  udaanCount: number;
  ignitionCount: number;
  teamCount: number;
  teamPct: number;
}

export function buildStats(rows: Registration[]): DashboardStats {
  const today = todayIST();
  let todayCount = 0;
  let udaanCount = 0;
  let ignitionCount = 0;
  let teamCount = 0;

  for (const row of rows) {
    if (toISTDay(row.created_at) === today) todayCount += 1;
    if (row.participation_type === "team") teamCount += 1;
    const events: string[] = Array.isArray(row.events) ? row.events : [];
    if (events.some((e) => getEventGroup(e) === "UDAAN")) udaanCount += 1;
    if (events.some((e) => getEventGroup(e) === "IGNITION")) ignitionCount += 1;
  }

  return {
    total: rows.length,
    todayCount,
    udaanCount,
    ignitionCount,
    teamCount,
    teamPct:
      rows.length > 0 ? Math.round((teamCount / rows.length) * 100) : 0,
  };
}
