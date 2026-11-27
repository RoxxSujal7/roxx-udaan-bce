"use client";

import * as React from "react";
import { Award, Medal, Trophy } from "lucide-react";

import { LeaderboardPodium } from "@/components/ui/leaderboard-podium";
import { LeaderboardTable } from "@/components/ui/leaderboard-table";
import { adaptChampionshipToLeaderboard } from "@/src/live/leaderboard-adapter";
import type {
  BracketRecord,
  ChampionshipStanding,
  Podium,
} from "@/src/live/types";

declare global {
  interface Window {
    bracketsViewer?: {
      render: (
        data: {
          stages: unknown[];
          matches: unknown[];
          matchGames: unknown[];
          participants: unknown[];
        },
        config: {
          selector: string;
          clear?: boolean;
          customRoundName?: (info: {
            roundNumber: number;
            roundCount: number;
            fractionOfFinal?: number;
            groupType?: string;
          }) => string;
        },
      ) => Promise<void> | void;
    };
  }
}

export function sortChampionshipRows(
  rows: ChampionshipStanding[],
): ChampionshipStanding[] {
  return rows.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gold !== a.gold) return b.gold - a.gold;
    if (b.silver !== a.silver) return b.silver - a.silver;
    if (b.bronze !== a.bronze) return b.bronze - a.bronze;
    return a.department.localeCompare(b.department);
  });
}

export function ChampionshipSection({
  standings,
  podiums,
}: {
  standings: ChampionshipStanding[];
  podiums: Podium[];
}) {
  const [scope, setScope] = React.useState<"udaan" | "ignition">("udaan");

  const rows = React.useMemo(
    () => sortChampionshipRows(standings.filter((s) => s.counts_for === scope)),
    [standings, scope],
  );

  const dataset = React.useMemo(
    () => adaptChampionshipToLeaderboard(rows),
    [rows],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Scope toggle: UDAAN | IGNITION */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="tablist" aria-label="Championship track">
          <button
            type="button"
            role="tab"
            aria-selected={scope === "udaan"}
            onClick={() => setScope("udaan")}
            className={`min-h-9 cursor-pointer rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
              scope === "udaan"
                ? "border-[#ff6b2b] bg-[#ff6b2b] text-black"
                : "border-white/15 bg-[#141414] text-zinc-300 hover:border-white/30"
            }`}
          >
            UDAAN Overall
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "ignition"}
            onClick={() => setScope("ignition")}
            className={`min-h-9 cursor-pointer rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
              scope === "ignition"
                ? "border-[#ff6b2b] bg-[#ff6b2b] text-black"
                : "border-white/15 bg-[#141414] text-zinc-300 hover:border-white/30"
            }`}
          >
            IGNITION Esports
          </button>
        </div>
        <span className="text-xs text-zinc-400">
          Team: 10 / 6 / 3 · Individual: 5 / 3 / 1
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#141414] p-8 text-center">
          <Trophy className="mx-auto mb-3 size-8 text-[#ff6b2b]" />
          <h3 className="text-base font-semibold text-white">
            No medals awarded yet
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Department points and podiums appear here as finals finish.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/10 bg-[#141414] p-4 sm:p-6">
            <LeaderboardPodium
              rankings={dataset.podiumRankings}
              showAvatar={false}
              medalStyle="classic"
            />
          </div>

          <LeaderboardTable
            players={dataset.tablePlayers}
            title={
              scope === "udaan"
                ? "UDAAN Overall Standings"
                : "IGNITION Esports Standings"
            }
            caption="Department championship rankings by points and medals."
            entityHeader={dataset.entityHeader}
            scoreHeader={dataset.scoreHeader}
            className="w-full"
          />
        </>
      )}

      {/* Recent Medals */}
      <section aria-labelledby="sec-recent-medals">
        <div className="mb-3 flex items-center gap-2">
          <Medal className="size-4 text-[#ff6b2b]" />
          <h3
            id="sec-recent-medals"
            className="text-sm font-bold uppercase tracking-widest text-white"
          >
            Recent medals ({podiums.length})
          </h3>
        </div>
        {podiums.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-[#141414]/60 px-4 py-4 text-xs text-zinc-400">
            No podium results recorded yet.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {podiums.slice(0, 12).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#141414] px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span>
                      {p.place === 1 ? "🥇" : p.place === 2 ? "🥈" : "🥉"}
                    </span>
                    <span className="font-semibold text-white">
                      {p.department}
                    </span>
                    <span className="text-zinc-400">· {p.event}</span>
                  </div>
                  {p.label && (
                    <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                      {p.label}
                    </p>
                  )}
                </div>
                <Award className="size-4 shrink-0 text-[#ff6b2b]/70" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function BracketsSection({ brackets }: { brackets: BracketRecord[] }) {
  const [selectedEvent, setSelectedEvent] = React.useState<string>("");

  const activeEvent = React.useMemo(() => {
    if (selectedEvent && brackets.some((b) => b.event === selectedEvent)) {
      return selectedEvent;
    }
    return brackets[0]?.event ?? "";
  }, [brackets, selectedEvent]);

  const activeBracket = brackets.find((b) => b.event === activeEvent) ?? null;

  React.useEffect(() => {
    if (!activeBracket || typeof window === "undefined") return;
    const renderBracket = () => {
      if (!window.bracketsViewer) return false;
      const d = activeBracket.data;
      try {
        void window.bracketsViewer.render(
          {
            stages: d.stage,
            matches: d.match,
            matchGames: d.match_game,
            participants: d.participant,
          },
          {
            selector: "#bracket-viewer-canvas",
            clear: true,
            customRoundName: (info) => {
              if (info.groupType === "consolation_final") return "3rd place";
              if (info.fractionOfFinal === 1) return "Final";
              if (info.fractionOfFinal === 0.5) return "Semi-final";
              if (info.fractionOfFinal === 0.25) return "Quarter-final";
              return `Round ${info.roundNumber}`;
            },
          },
        );
        return true;
      } catch {
        return false;
      }
    };

    if (!renderBracket()) {
      const t = window.setTimeout(renderBracket, 350);
      return () => window.clearTimeout(t);
    }
  }, [activeBracket]);

  if (brackets.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#141414] p-8 text-center">
        <Trophy className="mx-auto mb-3 size-8 text-[#ff6b2b]" />
        <h3 className="text-base font-semibold text-white">
          No knockout brackets published yet
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          Quarter-finals, semi-finals, and finals brackets appear here once seeded.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bracket event">
        {brackets.map((b) => (
          <button
            key={b.event}
            type="button"
            role="tab"
            aria-selected={b.event === activeEvent}
            onClick={() => setSelectedEvent(b.event)}
            className={`min-h-9 cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              b.event === activeEvent
                ? "border-[#ff6b2b] bg-[#ff6b2b] text-black font-semibold"
                : "border-white/15 bg-[#141414] text-zinc-300 hover:border-white/30"
            }`}
          >
            {b.event}
          </button>
        ))}
      </div>

      {/* Horizontal scroll contained inside card so page never overflows at 360px */}
      <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#141414] p-3 sm:p-4">
        <div
          id="bracket-viewer-canvas"
          className="brackets-viewer min-w-[600px]"
        />
      </div>
    </div>
  );
}
