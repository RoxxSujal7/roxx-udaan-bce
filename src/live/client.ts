import * as React from "react";
import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/public-config";
import type {
  Announcement,
  LiveConnectionState,
  Match,
  Team,
  TeamHistoryEntry,
  TeamStanding,
} from "@/src/live/types";
import type { ChangelogEntry } from "@/components/ui/changelog-timeline";

// ─── IST Date / Time Helpers ───────────────────────────────────────────────

export function toISTDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "2026-11-27";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "11";
  const day = parts.find((p) => p.type === "day")?.value ?? "27";
  return `${y}-${m}-${day}`;
}

export function formatISTClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatISTShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function isAnnouncementActive(
  a: Announcement,
  nowMs = Date.now(),
): boolean {
  if (!a.active) return false;
  if (!a.expires_at) return true;
  const exp = Date.parse(a.expires_at);
  return Number.isNaN(exp) ? true : exp > nowMs;
}

// ─── Feed Builder (Part 4B) ────────────────────────────────────────────────

export function buildFeed(
  matches: Match[],
  _announcements?: Announcement[],
): ChangelogEntry[] {
  const items: ChangelogEntry[] = [];

  for (const m of matches) {
    if (m.hidden) continue;
    const vs =
      m.team_a && m.team_b
        ? `${m.team_a} vs ${m.team_b}`
        : m.team_a || m.title || m.stage || "";
    const label = vs ? `${m.event} · ${vs}` : m.event;

    if (m.status === "live") {
      const scoreStr =
        m.score_a || m.score_b
          ? `${m.score_a ?? "0"} – ${m.score_b ?? "0"}`
          : null;
      const summaryParts = [m.venue, scoreStr, m.stage].filter(Boolean);
      items.push({
        id: `match-live-${m.id}`,
        date: toISTDateKey(m.updated_at),
        at: m.updated_at,
        category: "live",
        title: `${label} is LIVE`,
        summary: summaryParts.join(" · "),
      });
    } else if (m.status === "finished") {
      const scoreStr =
        m.score_a || m.score_b
          ? `(${m.score_a ?? "0"} – ${m.score_b ?? "0"})`
          : null;
      const summaryParts = [m.result, scoreStr, m.venue].filter(Boolean);
      items.push({
        id: `match-res-${m.id}`,
        date: toISTDateKey(m.updated_at),
        at: m.updated_at,
        category: "result",
        title: label,
        summary: summaryParts.join(" · ") || "Match finished",
      });
    } else if (m.status === "postponed" || m.status === "cancelled") {
      items.push({
        id: `match-stat-${m.id}`,
        date: toISTDateKey(m.updated_at),
        at: m.updated_at,
        category: "notice",
        title: `${label} ${m.status}`,
        summary: m.venue,
      });
    }
  }

  items.sort((a, b) => {
    const ka = a.at ?? a.date;
    const kb = b.at ?? b.date;
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });

  return items.slice(0, 40);
}

// ─── Singleton Store on window.__udaanLive ─────────────────────────────────

interface LiveState {
  matches: Match[];
  announcements: Announcement[];
  teams: Team[];
  standings: TeamStanding[];
  connection: LiveConnectionState;
  lastUpdated: string | null;
  loaded: boolean;
}

type Listener = () => void;

class LiveStore {
  private state: LiveState = {
    matches: [],
    announcements: [],
    teams: [],
    standings: [],
    connection: "connecting",
    lastUpdated: null,
    loaded: false,
  };
  private listeners = new Set<Listener>();
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private pollTimer: number | null = null;
  private retryTimer: number | null = null;
  private standingsTimer: number | null = null;
  private retryDelayMs = 5_000;
  private started = false;

  constructor() {
    if (
      typeof window !== "undefined" &&
      SUPABASE_URL &&
      SUPABASE_PUBLISHABLE_KEY
    ) {
      this.client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }

  getSnapshot = (): LiveState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    if (!this.started) {
      this.start();
    }
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit() {
    for (const l of this.listeners) l();
  }

  private setState(partial: Partial<LiveState>) {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  private start() {
    this.started = true;
    if (typeof window === "undefined") return;

    if (!this.client) {
      this.setState({ connection: "offline", loaded: true });
      return;
    }

    document.addEventListener("visibilitychange", this.handleVisibility);
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);

    if (document.visibilityState === "visible") {
      void this.refetch();
      this.connectRealtime();
    }
  }

  private handleVisibility = () => {
    if (document.visibilityState === "visible") {
      void this.refetch();
      this.connectRealtime();
    } else {
      this.teardownRealtime();
      this.stopPolling();
    }
  };

  private handleOnline = () => {
    if (document.visibilityState === "visible") {
      void this.refetch();
      this.connectRealtime();
    }
  };

  private handleOffline = () => {
    this.teardownRealtime();
    this.stopPolling();
    this.setState({ connection: "offline" });
  };

  refetch = async (): Promise<void> => {
    if (!this.client) return;
    try {
      const [mRes, aRes, tRes, sRes] = await Promise.all([
        this.client
          .from("matches")
          .select("*")
          .order("starts_at", { ascending: true }),
        this.client
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        this.client.from("teams").select("*").order("name", { ascending: true }),
        this.client.from("team_standings").select("*"),
      ]);
      if (!mRes.error && !aRes.error) {
        this.setState({
          matches: (mRes.data as Match[]) ?? [],
          announcements: (aRes.data as Announcement[]) ?? [],
          teams: !tRes.error && tRes.data ? (tRes.data as Team[]) : this.state.teams,
          standings:
            !sRes.error && sRes.data
              ? (sRes.data as TeamStanding[])
              : this.state.standings,
          lastUpdated: new Date().toISOString(),
          loaded: true,
        });
      }
    } catch {
      if (!navigator.onLine) {
        this.setState({ connection: "offline" });
      }
    }
  };

  private scheduleStandingsRefetch() {
    if (typeof window === "undefined" || !this.client) return;
    if (this.standingsTimer !== null) {
      window.clearTimeout(this.standingsTimer);
    }
    this.standingsTimer = window.setTimeout(async () => {
      this.standingsTimer = null;
      if (!this.client) return;
      try {
        const sRes = await this.client.from("team_standings").select("*");
        if (!sRes.error && sRes.data) {
          this.setState({ standings: sRes.data as TeamStanding[] });
        }
      } catch {
        /* ignore */
      }
    }, 1_000);
  }

  private connectRealtime() {
    if (!this.client || this.channel || document.visibilityState !== "visible") {
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.setState({ connection: "offline" });
      return;
    }

    this.setState({ connection: "connecting" });

    const ch = this.client
      .channel("udaan-live-public")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        (payload) => {
          this.applyMatchChange(
            payload.eventType,
            payload.new as Match | undefined,
            payload.old as Partial<Match> | undefined,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        (payload) => {
          this.applyAnnouncementChange(
            payload.eventType,
            payload.new as Announcement | undefined,
            payload.old as Partial<Announcement> | undefined,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          this.applyTeamChange(
            payload.eventType,
            payload.new as Team | undefined,
            payload.old as Partial<Team> | undefined,
          );
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.retryDelayMs = 5_000;
          this.stopPolling();
          this.setState({
            connection: "realtime",
            lastUpdated: new Date().toISOString(),
          });
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          this.teardownRealtime();
          this.enterFallback();
        }
      });

    this.channel = ch;
  }

  private teardownRealtime() {
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.channel && this.client) {
      const ch = this.channel;
      this.channel = null;
      void this.client.removeChannel(ch);
    }
  }

  private enterFallback() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.setState({ connection: "offline" });
      return;
    }
    this.setState({ connection: "fallback" });
    this.startPolling();

    if (this.retryTimer === null && document.visibilityState === "visible") {
      const delay = this.retryDelayMs;
      this.retryDelayMs = Math.min(60_000, this.retryDelayMs * 2);
      this.retryTimer = window.setTimeout(() => {
        this.retryTimer = null;
        this.connectRealtime();
      }, delay);
    }
  }

  private startPolling() {
    if (this.pollTimer !== null) return;
    this.pollTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void this.refetch();
      }
    }, 60_000);
  }

  private stopPolling() {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private applyMatchChange(
    eventType: string,
    next?: Match,
    old?: Partial<Match>,
  ) {
    let list = this.state.matches.slice();
    if (eventType === "INSERT" && next) {
      if (!list.some((m) => m.id === next.id)) list.push(next);
    } else if (eventType === "UPDATE" && next) {
      const idx = list.findIndex((m) => m.id === next.id);
      if (idx >= 0) list[idx] = next;
      else list.push(next);
    } else if (eventType === "DELETE" && old?.id) {
      list = list.filter((m) => m.id !== old.id);
    }
    list.sort((a, b) =>
      a.starts_at < b.starts_at ? -1 : a.starts_at > b.starts_at ? 1 : 0,
    );
    this.setState({
      matches: list,
      lastUpdated: new Date().toISOString(),
    });
    this.scheduleStandingsRefetch();
  }

  private applyTeamChange(
    eventType: string,
    next?: Team,
    old?: Partial<Team>,
  ) {
    let list = this.state.teams.slice();
    if (eventType === "INSERT" && next) {
      if (!list.some((t) => t.id === next.id)) list.push(next);
    } else if (eventType === "UPDATE" && next) {
      const idx = list.findIndex((t) => t.id === next.id);
      if (idx >= 0) list[idx] = next;
      else list.push(next);
    } else if (eventType === "DELETE" && old?.id) {
      list = list.filter((t) => t.id !== old.id);
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    this.setState({
      teams: list,
      lastUpdated: new Date().toISOString(),
    });
    this.scheduleStandingsRefetch();
  }

  private applyAnnouncementChange(
    eventType: string,
    next?: Announcement,
    old?: Partial<Announcement>,
  ) {
    let list = this.state.announcements.slice();
    if (eventType === "INSERT" && next) {
      list = [next, ...list.filter((a) => a.id !== next.id)];
    } else if (eventType === "UPDATE" && next) {
      const idx = list.findIndex((a) => a.id === next.id);
      if (idx >= 0) list[idx] = next;
      else list.unshift(next);
    } else if (eventType === "DELETE" && old?.id) {
      list = list.filter((a) => a.id !== old.id);
    }
    this.setState({
      announcements: list,
      lastUpdated: new Date().toISOString(),
    });
  }

  setMatchesOptimistic = (updater: (prev: Match[]) => Match[]) => {
    this.setState({ matches: updater(this.state.matches) });
  };

  setAnnouncementsOptimistic = (
    updater: (prev: Announcement[]) => Announcement[],
  ) => {
    this.setState({ announcements: updater(this.state.announcements) });
  };
}

declare global {
  interface Window {
    __udaanLive?: LiveStore;
  }
}

function getLiveStore(): LiveStore {
  if (typeof window === "undefined") return new LiveStore();
  if (!window.__udaanLive) {
    window.__udaanLive = new LiveStore();
  }
  return window.__udaanLive;
}

export async function fetchTeamHistory(
  teamId: string,
): Promise<TeamHistoryEntry[]> {
  const store = getLiveStore();
  // @ts-expect-error access private client for view query
  const client = store.client as SupabaseClient | null;
  if (!client) return [];
  try {
    const res = await client
      .from("team_history")
      .select("*")
      .eq("team_id", teamId)
      .order("starts_at", { ascending: false });
    if (res.error || !res.data) return [];
    return res.data as TeamHistoryEntry[];
  } catch {
    return [];
  }
}

export function useLiveData() {
  const store = React.useMemo(() => getLiveStore(), []);
  const state = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return {
    ...state,
    refetch: store.refetch,
    setMatchesOptimistic: store.setMatchesOptimistic,
    setAnnouncementsOptimistic: store.setAnnouncementsOptimistic,
  };
}
