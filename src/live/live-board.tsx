"use client";

import * as React from "react";
import { BellRing, CalendarClock, ExternalLink, MapPin, Radio, Smartphone, Trophy, WifiOff } from "lucide-react";

import { ChangelogTimeline } from "@/components/ui/changelog-timeline";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getEventGroup } from "@/lib/events";
import { FEATURES, NTFY_PUBLIC_TOPIC } from "@/lib/public-config";
import {
  BracketsSection,
  ChampionshipSection,
} from "@/src/live/championship-view";
import { QrCodeSvg } from "@/src/live/qr-code";
import {
  buildFeed,
  fetchTeamHistory,
  formatISTShortTime,
  toISTDateKey,
  useLiveData,
} from "@/src/live/client";
import type {
  LiveConnectionState,
  Match,
  TeamHistoryEntry,
  TeamStanding,
} from "@/src/live/types";

const FILTER_STORAGE_KEY = "udaan_live_filter";

function loadSavedFilter(): string {
  try {
    return localStorage.getItem(FILTER_STORAGE_KEY) || "All";
  } catch {
    return "All";
  }
}

function saveFilter(val: string) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, val);
  } catch {
    /* ignore */
  }
}

function formatDayShort(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function relativeUpdated(iso: string, nowMs: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.round((nowMs - then) / 60_000));
  if (mins < 1) return "updated just now";
  if (mins < 60) return `updated ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `updated ${hrs}h ago`;
}

function ConnectionPill({ state }: { state: LiveConnectionState }) {
  if (state === "realtime") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        Live
      </span>
    );
  }
  if (state === "fallback") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
        <span className="size-2 rounded-full bg-amber-400" />
        Updating every minute
      </span>
    );
  }
  if (state === "offline") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
        <WifiOff className="size-3.5" />
        Offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
      <Radio className="size-3.5 animate-pulse" />
      Connecting…
    </span>
  );
}

function AnimatedScore({
  value,
  isLive,
  isNumeric,
}: {
  value: string;
  isLive: boolean;
  isNumeric: boolean;
}) {
  const [flash, setFlash] = React.useState(false);
  const prevRef = React.useRef(value);

  React.useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) {
        setFlash(true);
        const t = window.setTimeout(() => setFlash(false), 380);
        return () => window.clearTimeout(t);
      }
    }
  }, [value]);

  return (
    <span
      className={`shrink-0 font-mono font-bold tabular-nums transition-transform duration-300 ${
        isLive
          ? isNumeric
            ? "text-2xl text-[#ff6b2b]"
            : "text-xl text-[#ff6b2b]"
          : isNumeric
            ? "text-lg text-zinc-100"
            : "text-base text-zinc-200"
      } ${flash ? "scale-110 text-white" : ""}`}
    >
      {value}
    </span>
  );
}

function TeamNameLabel({
  name,
  teamId,
  onSelectTeam,
}: {
  name: string | null;
  teamId?: string | null;
  onSelectTeam: (teamId: string | null | undefined, name: string) => void;
}) {
  const display = name || "TBA";
  if (!teamId && !name) {
    return (
      <span className="truncate text-base font-semibold text-white">
        {display}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSelectTeam(teamId, display)}
      className="truncate text-left text-base font-semibold text-white hover:text-[#ff6b2b] focus-visible:outline-none focus-visible:underline cursor-pointer"
    >
      {display}
    </button>
  );
}

function MatchCard({
  match,
  nowMs,
  variant,
  onSelectTeam,
}: {
  match: Match;
  nowMs: number;
  variant: "live" | "upcoming" | "finished";
  onSelectTeam: (teamId: string | null | undefined, name: string) => void;
}) {
  const isLive = variant === "live";
  const isMuted =
    match.status === "postponed" || match.status === "cancelled";
  const hasNumericA = match.points_a !== null && match.points_a !== undefined;
  const hasNumericB = match.points_b !== null && match.points_b !== undefined;
  const displayA = hasNumericA
    ? String(match.points_a)
    : match.score_a ?? (isLive ? "0" : "");
  const displayB = hasNumericB
    ? String(match.points_b)
    : match.score_b ?? (isLive ? "0" : "");

  return (
    <article
      className={`rounded-2xl border p-4 transition-colors ${
        isLive
          ? "border-[#ff6b2b]/50 bg-gradient-to-br from-[#1b1412] to-[#121212] shadow-lg"
          : "border-white/10 bg-[#141414]"
      } ${isMuted ? "opacity-65" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[#ff6b2b]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#ff6b2b]">
            {match.event}
          </span>
          {(match.stage || match.title || (match.round && match.round !== "league")) && (
            <span className="text-xs text-zinc-400">
              {[
                match.round && match.round !== "league" ? match.round : null,
                match.stage,
                match.title,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>

        {isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-400">
            <span className="size-2 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
        ) : isMuted ? (
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-zinc-400">
            {match.status}
          </span>
        ) : (
          <span className="text-xs text-zinc-400 tabular-nums">
            {formatDayShort(toISTDateKey(match.starts_at))} ·{" "}
            {formatISTShortTime(match.starts_at)}
          </span>
        )}
      </div>

      {/* Teams & Scores */}
      <div className="mt-3 flex flex-col gap-1.5">
        {match.team_a || match.team_b ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <TeamNameLabel
                  name={match.team_a}
                  teamId={match.team_a_id}
                  onSelectTeam={onSelectTeam}
                />
                {(displayA !== "" || isLive || variant === "finished") && (
                  <AnimatedScore
                    value={displayA}
                    isLive={isLive}
                    isNumeric={hasNumericA}
                  />
                )}
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <TeamNameLabel
                  name={match.team_b}
                  teamId={match.team_b_id}
                  onSelectTeam={onSelectTeam}
                />
                {(displayB !== "" || isLive || variant === "finished") && (
                  <AnimatedScore
                    value={displayB}
                    isLive={isLive}
                    isNumeric={hasNumericB}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-base font-semibold text-white">
            {match.title || match.event}
          </p>
        )}
      </div>

      {match.result && (
        <p className="mt-2.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-amber-200">
          {match.result}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5 text-[#ff6b2b]" />
          {match.venue}
        </span>
        {isLive && (
          <span className="text-[11px] text-zinc-500">
            {relativeUpdated(match.updated_at, nowMs)}
          </span>
        )}
      </div>
    </article>
  );
}

export function LiveBoard() {
  const {
    matches,
    announcements,
    teams,
    standings,
    podiums,
    championshipStandings,
    brackets,
    connection,
    lastUpdated,
    loaded,
  } = useLiveData();
  const [activeTab, setActiveTab] = React.useState<
    "scores" | "standings" | "championship" | "brackets"
  >(() => {
    if (typeof window === "undefined") return "scores";
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "standings" && FEATURES.standings) return "standings";
    if (t === "championship" && FEATURES.championship) return "championship";
    if (t === "brackets" && FEATURES.brackets) return "brackets";
    return "scores";
  });
  const [filter, setFilter] = React.useState<string>(() => loadSavedFilter());
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [isMobile, setIsMobile] = React.useState(false);

  // Team sheet state
  const [sheetTeam, setSheetTeam] = React.useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const [teamHistory, setTeamHistory] = React.useState<TeamHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  const handleSelectTeam = React.useCallback(
    (teamId: string | null | undefined, name: string) => {
      const matched =
        (teamId ? teams.find((t) => t.id === teamId) : null) ??
        teams.find((t) => t.name === name) ??
        null;
      const resolvedId = matched?.id ?? teamId ?? null;
      setSheetTeam({ id: resolvedId, name: matched?.name ?? name });
      setTeamHistory([]);
      if (resolvedId) {
        setLoadingHistory(true);
        void fetchTeamHistory(resolvedId).then((rows) => {
          setTeamHistory(rows);
          setLoadingHistory(false);
        });
      }
    },
    [teams],
  );

  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobile(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  const visibleMatches = React.useMemo(
    () => matches.filter((m) => !m.hidden),
    [matches],
  );

  const eventChips = React.useMemo(() => {
    const seen = new Set<string>();
    visibleMatches.forEach((m) => seen.add(m.event));
    return ["All", "UDAAN", "IGNITION", ...Array.from(seen).sort()];
  }, [visibleMatches]);

  // If saved filter is an event that no longer has matches, keep it or reset
  const activeFilter = eventChips.includes(filter) ? filter : "All";

  function handleSelectFilter(chip: string) {
    setFilter(chip);
    saveFilter(chip);
  }

  const filteredMatches = React.useMemo(() => {
    if (activeFilter === "All") return visibleMatches;
    if (activeFilter === "UDAAN") {
      return visibleMatches.filter((m) => getEventGroup(m.event) === "UDAAN");
    }
    if (activeFilter === "IGNITION") {
      return visibleMatches.filter(
        (m) => getEventGroup(m.event) === "IGNITION",
      );
    }
    return visibleMatches.filter((m) => m.event === activeFilter);
  }, [visibleMatches, activeFilter]);

  const liveMatches = React.useMemo(
    () => filteredMatches.filter((m) => m.status === "live"),
    [filteredMatches],
  );

  const upcomingMatches = React.useMemo(
    () =>
      filteredMatches
        .filter(
          (m) =>
            m.status === "upcoming" ||
            m.status === "postponed" ||
            m.status === "cancelled",
        )
        .sort((a, b) =>
          a.starts_at < b.starts_at ? -1 : a.starts_at > b.starts_at ? 1 : 0,
        ),
    [filteredMatches],
  );

  const finishedMatches = React.useMemo(
    () =>
      filteredMatches
        .filter((m) => m.status === "finished")
        .sort((a, b) =>
          a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0,
        ),
    [filteredMatches],
  );

  const feedEntries = React.useMemo(
    () => buildFeed(matches, announcements),
    [matches, announcements],
  );

  const statusNote =
    connection === "realtime"
      ? "Realtime connected"
      : connection === "fallback"
        ? "Updating every minute"
        : connection === "offline"
          ? "Offline"
          : "Connecting…";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-2 sm:px-6">
      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          27–30 Nov 2026 · Instant scores &amp; schedule
        </p>
        <ConnectionPill state={connection} />
      </div>

      {/* View tabs (Live & Schedule | Standings | Championship | Brackets) */}
      {(FEATURES.standings || FEATURES.championship || FEATURES.brackets) && (
        <div
          className="mb-5 flex flex-wrap gap-2 border-b border-white/10 pb-3"
          role="tablist"
          aria-label="Live board sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "scores"}
            onClick={() => setActiveTab("scores")}
            className={`min-h-10 cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "scores"
                ? "bg-[#ff6b2b] text-black"
                : "bg-[#141414] text-zinc-300 hover:bg-white/10"
            }`}
          >
            Live &amp; Schedule
          </button>
          {FEATURES.standings && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "standings"}
              onClick={() => setActiveTab("standings")}
              className={`min-h-10 cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === "standings"
                  ? "bg-[#ff6b2b] text-black"
                  : "bg-[#141414] text-zinc-300 hover:bg-white/10"
              }`}
            >
              Standings
            </button>
          )}
          {FEATURES.championship && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "championship"}
              onClick={() => setActiveTab("championship")}
              className={`min-h-10 cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === "championship"
                  ? "bg-[#ff6b2b] text-black"
                  : "bg-[#141414] text-zinc-300 hover:bg-white/10"
              }`}
            >
              Championship
            </button>
          )}
          {FEATURES.brackets && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "brackets"}
              onClick={() => setActiveTab("brackets")}
              className={`min-h-10 cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === "brackets"
                  ? "bg-[#ff6b2b] text-black"
                  : "bg-[#141414] text-zinc-300 hover:bg-white/10"
              }`}
            >
              Brackets
            </button>
          )}
        </div>
      )}

      {/* Filter chips */}
      <div
        className="mb-6 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter matches by event"
      >
        {eventChips.map((chip) => {
          const selected = activeFilter === chip;
          return (
            <button
              key={chip}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => handleSelectFilter(chip)}
              className={`min-h-9 cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                selected
                  ? "border-[#ff6b2b] bg-[#ff6b2b] text-black font-semibold"
                  : "border-white/15 bg-[#141414] text-zinc-300 hover:border-white/30"
              }`}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* Standings / Championship / Brackets Views */}
      {FEATURES.standings && activeTab === "standings" ? (
        <StandingsSection
          standings={standings}
          activeFilter={activeFilter}
          onSelectTeam={handleSelectTeam}
        />
      ) : FEATURES.championship && activeTab === "championship" ? (
        <ChampionshipSection
          standings={championshipStandings}
          podiums={podiums}
        />
      ) : FEATURES.brackets && activeTab === "brackets" ? (
        <BracketsSection brackets={brackets} />
      ) : (
        <>
      {/* Empty state */}
      {loaded && visibleMatches.length === 0 && (
        <div className="mb-8 rounded-2xl border border-white/10 bg-[#141414] p-8 text-center">
          <Trophy className="mx-auto mb-3 size-8 text-[#ff6b2b]" />
          <h3 className="text-lg font-semibold text-white">
            No matches posted yet
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Schedules and live scores appear here once the fest kicks off.
          </p>
          <a
            href="./registration.html"
            className="mt-4 inline-flex items-center rounded-full bg-[#ff6b2b] px-5 py-2.5 text-xs font-semibold text-black no-underline hover:opacity-90"
          >
            Register for UDAAN 2026
          </a>
        </div>
      )}

      {/* Main responsive grid: Desktop = left (Live+Schedule+Results) + right (Live feed); Mobile = Live -> Live feed -> Schedule -> Results */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* Left column sections on desktop; ordered on mobile */}
        <div className="contents lg:flex lg:flex-col lg:gap-8">
          {/* LIVE NOW */}
          <section aria-labelledby="sec-live-now" className="order-1">
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-red-500 animate-pulse" />
              <h3
                id="sec-live-now"
                className="text-sm font-bold uppercase tracking-widest text-white"
              >
                Live now ({liveMatches.length})
              </h3>
            </div>
            {liveMatches.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-[#141414]/60 px-4 py-5 text-sm text-zinc-400">
                No matches are live right at this moment.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {liveMatches.map((m) => (
                  <MatchCard key={m.id} match={m} nowMs={nowMs} variant="live" onSelectTeam={handleSelectTeam} />
                ))}
              </div>
            )}
          </section>

          {/* UP NEXT */}
          <section
            id="schedule"
            aria-labelledby="sec-up-next"
            className="order-3"
          >
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock className="size-4 text-[#ff6b2b]" />
              <h3
                id="sec-up-next"
                className="text-sm font-bold uppercase tracking-widest text-white"
              >
                Up next ({upcomingMatches.length})
              </h3>
            </div>
            {upcomingMatches.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-[#141414]/60 px-4 py-5 text-sm text-zinc-400">
                No upcoming matches in this filter.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {upcomingMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    nowMs={nowMs}
                    variant="upcoming"
                    onSelectTeam={handleSelectTeam}
                  />
                ))}
              </div>
            )}
          </section>

          {/* RESULTS */}
          <section aria-labelledby="sec-results" className="order-4">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="size-4 text-[#ff6b2b]" />
              <h3
                id="sec-results"
                className="text-sm font-bold uppercase tracking-widest text-white"
              >
                Results ({finishedMatches.length})
              </h3>
            </div>
            {finishedMatches.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-[#141414]/60 px-4 py-5 text-sm text-zinc-400">
                No finished matches yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {finishedMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    nowMs={nowMs}
                    variant="finished"
                    onSelectTeam={handleSelectTeam}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column on desktop / directly below Live now on mobile */}
        <aside className="order-2 flex flex-col gap-6 lg:order-none lg:sticky lg:top-20 lg:self-start">
          <ChangelogTimeline
            entries={feedEntries}
            title="Live feed"
            visibleEntries={isMobile ? 6 : 9}
            historyHref="#schedule"
            historyLabel="Full schedule"
            status={{
              note: statusNote,
              deployedAt: lastUpdated ?? undefined,
            }}
          />

          {FEATURES.phonePush && NTFY_PUBLIC_TOPIC.trim() !== "" && (
            <PhoneAlertsCard topic={NTFY_PUBLIC_TOPIC.trim()} />
          )}
        </aside>
      </div>
        </>
      )}

      {/* Team Sheet */}
      <TeamDetailSheet
        sheetTeam={sheetTeam}
        onClose={() => setSheetTeam(null)}
        standings={standings}
        history={teamHistory}
        loadingHistory={loadingHistory}
      />
    </div>
  );
}

function StandingsSection({
  standings,
  activeFilter,
  onSelectTeam,
}: {
  standings: TeamStanding[];
  activeFilter: string;
  onSelectTeam: (teamId: string | null | undefined, name: string) => void;
}) {
  const filtered = React.useMemo(() => {
    if (activeFilter === "All") return standings;
    if (activeFilter === "UDAAN") {
      return standings.filter((s) => getEventGroup(s.event) === "UDAAN");
    }
    if (activeFilter === "IGNITION") {
      return standings.filter((s) => getEventGroup(s.event) === "IGNITION");
    }
    return standings.filter((s) => s.event === activeFilter);
  }, [standings, activeFilter]);

  const tables = React.useMemo(() => {
    const map = new Map<string, { event: string; group: string | null; rows: TeamStanding[] }>();
    for (const row of filtered) {
      const key = `${row.event}::${row.group_label ?? ""}`;
      if (!map.has(key)) {
        map.set(key, { event: row.event, group: row.group_label, rows: [] });
      }
      map.get(key)!.rows.push(row);
    }
    for (const entry of map.values()) {
      entry.rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.difference !== a.difference) return b.difference - a.difference;
        if (b.scored !== a.scored) return b.scored - a.scored;
        return a.team_name.localeCompare(b.team_name);
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      `${a.event}${a.group ?? ""}`.localeCompare(`${b.event}${b.group ?? ""}`),
    );
  }, [filtered]);

  if (tables.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#141414] p-8 text-center">
        <Trophy className="mx-auto mb-3 size-8 text-[#ff6b2b]" />
        <h3 className="text-base font-semibold text-white">No standings yet</h3>
        <p className="mt-1 text-sm text-zinc-400">
          League standings appear here once teams and finished matches are posted.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {tables.map((t) => (
        <div
          key={`${t.event}-${t.group ?? "all"}`}
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#141414]"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              {t.event}
              {t.group ? ` · ${t.group}` : ""}
            </h3>
            <span className="text-[11px] text-zinc-400">Top 2 advance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400">
                  <th className="px-3 py-2.5 font-medium">Team</th>
                  <th className="px-2 py-2.5 text-center font-medium">P</th>
                  <th className="px-2 py-2.5 text-center font-medium">W</th>
                  <th className="px-2 py-2.5 text-center font-medium">L</th>
                  <th className="px-2 py-2.5 text-center font-medium">+/-</th>
                  <th className="px-3 py-2.5 text-right font-bold text-white">Pts</th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r, idx) => {
                  const topTwo = idx < 2;
                  return (
                    <tr
                      key={r.team_id}
                      className={`border-b border-white/5 last:border-none ${
                        topTwo ? "bg-[#ff6b2b]/10" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5 font-medium text-white">
                        <button
                          type="button"
                          onClick={() => onSelectTeam(r.team_id, r.team_name)}
                          className="text-left hover:text-[#ff6b2b] cursor-pointer"
                        >
                          <span className="mr-1.5 text-[10px] text-zinc-400">
                            {idx + 1}.
                          </span>
                          {r.team_name}
                        </button>
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums text-zinc-300">
                        {r.played}
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums text-emerald-300">
                        {r.wins}
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums text-zinc-400">
                        {r.losses}
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums text-zinc-300">
                        {r.difference > 0 ? `+${r.difference}` : r.difference}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-[#ff6b2b]">
                        {r.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamDetailSheet({
  sheetTeam,
  onClose,
  standings,
  history,
  loadingHistory,
}: {
  sheetTeam: { id: string | null; name: string } | null;
  onClose: () => void;
  standings: TeamStanding[];
  history: TeamHistoryEntry[];
  loadingHistory: boolean;
}) {
  const standing = sheetTeam?.id
    ? standings.find((s) => s.team_id === sheetTeam.id)
    : undefined;

  return (
    <Sheet open={sheetTeam !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-[#121214] text-white border-white/15 overflow-y-auto"
      >
        {sheetTeam && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="text-white">{sheetTeam.name}</SheetTitle>
              <SheetDescription className="text-zinc-400">
                {standing
                  ? `${standing.event} · ${standing.department}${standing.group_label ? ` · ${standing.group_label}` : ""}`
                  : "Team record & match history"}
              </SheetDescription>
            </SheetHeader>

            {standing && (
              <div className="mb-5 grid grid-cols-4 gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <div>
                  <div className="text-[11px] text-zinc-400">W-L</div>
                  <div className="font-mono text-sm font-bold text-white">
                    {standing.wins}-{standing.losses}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Pts</div>
                  <div className="font-mono text-sm font-bold text-[#ff6b2b]">
                    {standing.points}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Scored</div>
                  <div className="font-mono text-sm font-bold text-white">
                    {standing.scored}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">+/-</div>
                  <div className="font-mono text-sm font-bold text-white">
                    {standing.difference > 0
                      ? `+${standing.difference}`
                      : standing.difference}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Match history
              </h4>
              {loadingHistory ? (
                <p className="text-xs text-zinc-400">Loading match history…</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-zinc-400">
                  No finished matches recorded yet.
                </p>
              ) : (
                history.map((h) => (
                  <div
                    key={h.match_id}
                    className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white">
                        vs {h.opponent || "Opponent"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          h.outcome === "W"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {h.outcome}
                      </span>
                    </div>
                    {(h.own_score || h.opp_score) && (
                      <p className="mt-1 font-mono text-zinc-200">
                        {h.own_score ?? "—"} – {h.opp_score ?? "—"}
                      </p>
                    )}
                    {h.result && (
                      <p className="mt-1 text-amber-200">{h.result}</p>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {h.round} · {h.venue}
                    </p>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const NTFY_ANDROID_URL =
  "https://play.google.com/store/apps/details?id=io.heckel.ntfy";
const NTFY_IOS_URL = "https://apps.apple.com/us/app/ntfy/id1625396347";

function PhoneAlertsCard({ topic }: { topic: string }) {
  const subscribeUrl = `https://ntfy.sh/${encodeURIComponent(topic)}`;

  return (
    <section
      aria-labelledby="sec-phone-alerts"
      className="rounded-2xl border border-white/10 bg-[#141414] p-4 sm:p-5"
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BellRing className="size-4 shrink-0 text-[#ff6b2b]" />
            <h3
              id="sec-phone-alerts"
              className="text-sm font-bold uppercase tracking-wider text-white"
            >
              Get phone alerts
            </h3>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            Receive instant push notifications for urgent announcements and
            medal-round updates via <strong className="text-zinc-200">ntfy</strong> — free, no account needed.
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <a
              href={subscribeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6b2b] px-3.5 py-1.5 text-xs font-semibold text-black no-underline hover:opacity-90"
            >
              Subscribe
              <ExternalLink className="size-3.5" />
            </a>
            <a
              href={NTFY_ANDROID_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 no-underline hover:bg-white/10"
            >
              <Smartphone className="size-3.5" />
              Android
            </a>
            <a
              href={NTFY_IOS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 no-underline hover:bg-white/10"
            >
              <Smartphone className="size-3.5" />
              iOS
            </a>
          </div>
        </div>

        <a
          href={subscribeUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open ntfy subscription link"
          className="hidden sm:block shrink-0"
        >
          <QrCodeSvg
            value={subscribeUrl}
            size={96}
            label={`QR code for ${subscribeUrl}`}
          />
        </a>
      </div>
    </section>
  );
}
