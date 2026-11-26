"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { formatISTShortTime, useLiveData } from "@/src/live/client";
import { useAfterLoader } from "@/src/live/use-after-loader";

export function LiveStrip() {
  const afterLoader = useAfterLoader();
  const { matches } = useLiveData();
  const [idx, setIdx] = React.useState(0);

  const visible = React.useMemo(
    () => matches.filter((m) => !m.hidden),
    [matches],
  );
  const liveMatches = React.useMemo(
    () => visible.filter((m) => m.status === "live"),
    [visible],
  );
  const nextUpcoming = React.useMemo(
    () =>
      visible
        .filter((m) => m.status === "upcoming")
        .sort((a, b) =>
          a.starts_at < b.starts_at ? -1 : a.starts_at > b.starts_at ? 1 : 0,
        )[0] ?? null,
    [visible],
  );

  React.useEffect(() => {
    if (liveMatches.length <= 1) {
      setIdx(0);
      return;
    }
    const timer = window.setInterval(() => {
      setIdx((prev) => (prev + 1) % liveMatches.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [liveMatches.length]);

  if (!afterLoader) return null;

  const activeLive =
    liveMatches.length > 0 ? liveMatches[idx % liveMatches.length] : null;

  if (!activeLive && !nextUpcoming) return null;

  const target = activeLive ?? nextUpcoming!;
  const teams =
    target.team_a && target.team_b
      ? `${target.team_a} vs ${target.team_b}`
      : target.team_a || target.title || "";

  const scorePart =
    activeLive && (target.score_a || target.score_b)
      ? `${target.score_a ?? "0"} – ${target.score_b ?? "0"}`
      : null;

  const textParts = activeLive
    ? [target.event, teams, scorePart, target.venue].filter(Boolean)
    : [
        `Next: ${target.event}`,
        teams,
        formatISTShortTime(target.starts_at),
        target.venue,
      ].filter(Boolean);

  return (
    <div
      className="fixed left-1/2 z-40 w-[calc(100%-24px)] max-w-xl -translate-x-1/2"
      style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <a
        href="./Templates/live.html"
        className="flex items-center justify-between gap-2 rounded-full border border-white/15 bg-[#121212]/95 px-4 py-2.5 text-xs text-white shadow-xl backdrop-blur-md transition-colors hover:border-[#ff6b2b]/60 no-underline"
      >
        <div className="flex min-w-0 items-center gap-2">
          {activeLive ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full bg-[#ff6b2b]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#ff6b2b]">
              UP NEXT
            </span>
          )}
          <span className="truncate font-medium text-zinc-100">
            {textParts.join(" · ")}
          </span>
        </div>
        <ChevronRight className="size-4 shrink-0 text-[#ff6b2b]" />
      </a>
    </div>
  );
}
