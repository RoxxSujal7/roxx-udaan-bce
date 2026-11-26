"use client";

import * as React from "react";
import { BellOff, Megaphone, Radio, X } from "lucide-react";

import { isAnnouncementActive, useLiveData } from "@/src/live/client";
import { useAfterLoader } from "@/src/live/use-after-loader";
import type { Announcement, MatchStatus } from "@/src/live/types";

const DISMISSED_KEY = "udaan_dismissed_announcements";
const MUTE_KEY = "udaan_mute_match_alerts";

function loadDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-50) : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-50)));
  } catch {
    /* ignore */
  }
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveMuted(val: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, val ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function resolveLink(link: string): string {
  const inTemplates =
    typeof window !== "undefined" &&
    window.location.pathname.includes("/Templates/");
  if (link.startsWith("/")) return link;
  if (link.startsWith("./") && inTemplates) return `.${link}`;
  return link;
}

export function LiveAlerts() {
  const afterLoader = useAfterLoader();
  const { matches, announcements, loaded } = useLiveData();

  const [dismissedIds, setDismissedIds] = React.useState<string[]>(() =>
    loadDismissed(),
  );
  const [muted, setMuted] = React.useState<boolean>(() => loadMuted());
  const [toastQueue, setToastQueue] = React.useState<
    Array<{ id: string; text: string; kind: "live" | "finished" }>
  >([]);
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  const prevStatusRef = React.useRef<Map<string, MatchStatus> | null>(null);
  const vibratedIdsRef = React.useRef<Set<string>>(new Set());

  // Tick every 30 s so expired announcements disappear automatically
  React.useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // Pick newest active, non-expired, non-dismissed announcement
  const activeBanner: Announcement | null = React.useMemo(() => {
    for (const a of announcements) {
      if (isAnnouncementActive(a, nowMs) && !dismissedIds.includes(a.id)) {
        return a;
      }
    }
    return null;
  }, [announcements, dismissedIds, nowMs]);

  const dismissBanner = React.useCallback((id: string) => {
    setDismissedIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id].slice(-50);
      saveDismissed(next);
      return next;
    });
  }, []);

  // Auto-hide info banners after 10 s; vibrate once for urgent
  React.useEffect(() => {
    if (!afterLoader || !activeBanner) return;
    if (
      activeBanner.level === "urgent" &&
      !vibratedIdsRef.current.has(activeBanner.id)
    ) {
      vibratedIdsRef.current.add(activeBanner.id);
      try {
        navigator.vibrate?.(200);
      } catch {
        /* ignore */
      }
    }
    if (activeBanner.level === "info") {
      const timer = window.setTimeout(
        () => dismissBanner(activeBanner.id),
        10_000,
      );
      return () => window.clearTimeout(timer);
    }
  }, [afterLoader, activeBanner, dismissBanner]);

  // Detect live/finished transitions for optional match toasts
  React.useEffect(() => {
    if (!loaded) return;
    if (prevStatusRef.current === null) {
      const initial = new Map<string, MatchStatus>();
      matches.forEach((m) => initial.set(m.id, m.status));
      prevStatusRef.current = initial;
      return;
    }

    const prevMap = prevStatusRef.current;
    const newToasts: Array<{
      id: string;
      text: string;
      kind: "live" | "finished";
    }> = [];

    for (const m of matches) {
      const prev = prevMap.get(m.id);
      if (!m.hidden && prev !== m.status) {
        const vs =
          m.team_a && m.team_b
            ? `${m.team_a} vs ${m.team_b}`
            : m.team_a || m.title || "";
        if (m.status === "live") {
          newToasts.push({
            id: `${m.id}-live-${m.updated_at}`,
            kind: "live",
            text: `🔴 ${m.event} is LIVE at ${m.venue}${vs ? ` — ${vs}` : ""}`,
          });
        } else if (m.status === "finished" && prev === "live") {
          newToasts.push({
            id: `${m.id}-fin-${m.updated_at}`,
            kind: "finished",
            text: `✓ ${m.event}${vs ? ` (${vs})` : ""} finished${m.result ? ` — ${m.result}` : ""}`,
          });
        }
      }
      prevMap.set(m.id, m.status);
    }

    if (!muted && newToasts.length > 0) {
      setToastQueue((q) => [...q, ...newToasts]);
    }
  }, [matches, loaded, muted]);

  // Auto-advance toast queue every 6 s
  const currentToast = toastQueue[0] ?? null;
  React.useEffect(() => {
    if (!currentToast) return;
    const timer = window.setTimeout(() => {
      setToastQueue((q) => q.slice(1));
    }, 6_000);
    return () => window.clearTimeout(timer);
  }, [currentToast]);

  function handleMute() {
    setMuted(true);
    saveMuted(true);
    setToastQueue([]);
  }

  if (!afterLoader) return null;
  if (!activeBanner && !currentToast) return null;

  const bannerClasses =
    activeBanner?.level === "urgent"
      ? "border-red-500/70 bg-red-950/95 text-red-50"
      : activeBanner?.level === "important"
        ? "border-[#ff6b2b]/70 bg-[#23140d]/95 text-orange-50"
        : "border-white/20 bg-[#141414]/95 text-zinc-100";

  return (
    <>
      {/* Announcement banner — positioned top-left/center away from top-right hamburger */}
      {activeBanner && (
        <div
          role={activeBanner.level === "urgent" ? "alert" : "status"}
          aria-live={activeBanner.level === "urgent" ? "assertive" : "polite"}
          className="fixed left-3 right-16 top-3 z-45 mx-auto max-w-2xl sm:left-1/2 sm:right-auto sm:w-[calc(100%-8rem)] sm:-translate-x-1/2"
        >
          <div
            className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md transition-opacity motion-reduce:transition-none ${bannerClasses}`}
          >
            <Megaphone className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 leading-relaxed">
              {activeBanner.link ? (
                <a
                  href={resolveLink(activeBanner.link)}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {activeBanner.message}
                </a>
              ) : (
                <span className="font-medium">{activeBanner.message}</span>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss announcement"
              onClick={() => dismissBanner(activeBanner.id)}
              className="shrink-0 cursor-pointer rounded p-1 opacity-80 hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Match status toast (at most 1 at a time) */}
      {currentToast && !muted && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 right-3 z-45 w-[calc(100%-24px)] max-w-sm sm:bottom-5 sm:right-5"
        >
          <div className="flex flex-col gap-2 rounded-xl border border-white/15 bg-[#141414]/95 p-3 text-xs text-zinc-100 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-2">
              <Radio className="mt-0.5 size-4 shrink-0 text-[#ff6b2b]" />
              <p className="min-w-0 flex-1 font-medium leading-snug">
                {currentToast.text}
              </p>
              <button
                type="button"
                aria-label="Close alert"
                onClick={() => setToastQueue((q) => q.slice(1))}
                className="shrink-0 cursor-pointer rounded p-0.5 text-zinc-400 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleMute}
                className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
              >
                <BellOff className="size-3" />
                Mute match alerts
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
