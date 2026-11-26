"use client";

import * as React from "react";
import { CalendarClock, MapPin, Radio, Trophy, WifiOff } from "lucide-react";

import { ChangelogTimeline } from "@/components/ui/changelog-timeline";
import { getEventGroup } from "@/lib/events";
import {
  buildFeed,
  formatISTShortTime,
  toISTDateKey,
  useLiveData,
} from "@/src/live/client";
import type { LiveConnectionState, Match } from "@/src/live/types";

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

function MatchCard({
  match,
  nowMs,
  variant,
}: {
  match: Match;
  nowMs: number;
  variant: "live" | "upcoming" | "finished";
}) {
  const isLive = variant === "live";
  const isMuted =
    match.status === "postponed" || match.status === "cancelled";

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
          {(match.stage || match.title) && (
            <span className="text-xs text-zinc-400">
              {[match.stage, match.title].filter(Boolean).join(" · ")}
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
                <span className="truncate text-base font-semibold text-white">
                  {match.team_a || "TBA"}
                </span>
                {(match.score_a || isLive || variant === "finished") && (
                  <span
                    className={`shrink-0 font-mono font-bold tabular-nums ${
                      isLive ? "text-xl text-[#ff6b2b]" : "text-base text-zinc-200"
                    }`}
                  >
                    {match.score_a ?? (isLive ? "0" : "")}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-base font-semibold text-white">
                  {match.team_b || "TBA"}
                </span>
                {(match.score_b || isLive || variant === "finished") && (
                  <span
                    className={`shrink-0 font-mono font-bold tabular-nums ${
                      isLive ? "text-xl text-[#ff6b2b]" : "text-base text-zinc-200"
                    }`}
                  >
                    {match.score_b ?? (isLive ? "0" : "")}
                  </span>
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
  const { matches, announcements, connection, lastUpdated, loaded } =
    useLiveData();
  const [filter, setFilter] = React.useState<string>(() => loadSavedFilter());
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [isMobile, setIsMobile] = React.useState(false);

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          27–30 Nov 2026 · Instant scores &amp; schedule
        </p>
        <ConnectionPill state={connection} />
      </div>

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
                  <MatchCard key={m.id} match={m} nowMs={nowMs} variant="live" />
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
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column on desktop / directly below Live now on mobile */}
        <aside className="order-2 lg:order-none lg:sticky lg:top-20 lg:self-start">
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
        </aside>
      </div>
    </div>
  );
}
