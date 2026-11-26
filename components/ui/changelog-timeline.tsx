"use client";

import * as React from "react";
import { ChevronDown, GitBranch, GitCommitVertical, Pin, X } from "lucide-react";

export type ChangelogCategory = "live" | "result" | "notice";

export interface ChangelogEntry {
  id: string;
  /** ISO date in IST, e.g. "2026-11-27". */
  date: string;
  /** Optional full ISO timestamp for live feed sorting and HH:MM IST display. */
  at?: string;
  category: ChangelogCategory;
  title: string;
  summary?: string;
  href?: string;
}

export interface ChangelogStatus {
  commit?: string;
  ref?: string;
  deployedAt?: string | Date;
  note?: React.ReactNode;
}

type DivProps = React.ComponentPropsWithRef<"div">;
type ContainerProps = {
  [Key in keyof DivProps as Key extends "title" ? never : Key]: DivProps[Key];
};

export type ChangelogTimelineProps = ContainerProps & {
  entries: ChangelogEntry[];
  title?: React.ReactNode;
  status?: ChangelogStatus;
  /** Rows before the list scrolls; half of the next headline remains visible. */
  visibleEntries?: number;
  historyHref?: string;
  historyLabel?: string;
  onClose?: () => void;
  expandOnHover?: boolean;
  expanded?: string | null;
  defaultExpanded?: string | null;
  onExpandedChange?: (id: string | null) => void;
  /** A pinned row holds the single expansion until unpinned. */
  pinned?: string | null;
  defaultPinned?: string | null;
  onPinnedChange?: (id: string | null) => void;
};

const CATEGORY = {
  live: {
    label: "live",
    mark: "●",
    chip: "border-chart-2/30 bg-chart-2/10",
    color: "var(--color-chart-2, var(--color-primary))",
  },
  result: {
    label: "result",
    mark: "✓",
    chip: "border-chart-1/30 bg-chart-1/10",
    color: "var(--color-chart-1, var(--color-primary))",
  },
  notice: {
    label: "notice",
    mark: "!",
    chip: "border-chart-3/30 bg-chart-3/10",
    color: "var(--color-chart-3, var(--color-primary))",
  },
} as const;

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const IST_CLOCK = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function relativeTime(value: string | Date, now: number) {
  const then = typeof value === "string" ? Date.parse(value) : value.getTime();
  if (Number.isNaN(then)) return null;
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function isAbsoluteExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function useNow(enabled: boolean) {
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return now;
}

export function ChangelogTimeline({
  entries,
  title = "Live feed",
  status,
  visibleEntries = 9,
  historyHref,
  historyLabel = "Full schedule",
  onClose,
  expandOnHover = true,
  expanded,
  defaultExpanded = null,
  onExpandedChange,
  pinned,
  defaultPinned = null,
  onPinnedChange,
  ref,
  className,
  ...rest
}: ChangelogTimelineProps) {
  const [localExpanded, setLocalExpanded] = React.useState(
    defaultExpanded ?? defaultPinned,
  );
  const [localPinned, setLocalPinned] = React.useState(defaultPinned);
  const [isTouch, setIsTouch] = React.useState(false);
  const [layout, setLayout] = React.useState({
    top: 0,
    height: 0,
    start: 0,
    length: 0,
    maxHeight: undefined as number | undefined,
  });
  const stageRef = React.useRef(null as HTMLDivElement | null);
  const listRef = React.useRef(null as HTMLOListElement | null);
  const hoverFrame = React.useRef(0);
  const leaveTimer = React.useRef(0);
  const highlightTimer = React.useRef(0);
  const pendingHover = React.useRef(null as string | null);
  const seenIdsRef = React.useRef<Set<string> | null>(null);
  const titleId = React.useId();
  const idPrefix = React.useId();
  const now = useNow(Boolean(status?.deployedAt));

  React.useEffect(() => {
    const mql = window.matchMedia("(hover: none)");
    const sync = () => setIsTouch(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  const sorted = React.useMemo(
    () =>
      entries.slice().sort((a, b) => {
        const ka = a.at ?? a.date;
        const kb = b.at ?? b.date;
        return ka < kb ? 1 : ka > kb ? -1 : 0;
      }),
    [entries],
  );

  const requestedExpanded = expanded === undefined ? localExpanded : expanded;
  const activeId = sorted.some((entry) => entry.id === requestedExpanded)
    ? requestedExpanded
    : null;
  const requestedPin = pinned === undefined ? localPinned : pinned;
  const pinnedId = requestedPin === activeId ? activeId : null;
  const activeEntry = sorted.find((entry) => entry.id === activeId);
  const deployed =
    status?.deployedAt && now ? relativeTime(status.deployedAt, now) : null;
  const count = Number.isFinite(visibleEntries)
    ? Math.max(1, Math.floor(visibleEntries))
    : 9;

  const updateExpanded = (id: string | null) => {
    if (id === activeId) return;
    if (expanded === undefined) setLocalExpanded(id);
    onExpandedChange?.(id);
  };
  const updatePinned = (id: string | null) => {
    if (pinned === undefined) setLocalPinned(id);
    onPinnedChange?.(id);
  };
  const actions = React.useRef({ updateExpanded, pinnedId, expandOnHover });
  React.useLayoutEffect(() => {
    actions.current = { updateExpanded, pinnedId, expandOnHover };
  });

  // Briefly highlight & expand a newly arrived Realtime entry for 4 s unless pinned.
  React.useEffect(() => {
    const currentIds = new Set(sorted.map((e) => e.id));
    if (seenIdsRef.current === null) {
      seenIdsRef.current = currentIds;
      return;
    }
    const newestNew = sorted.find((e) => !seenIdsRef.current!.has(e.id));
    seenIdsRef.current = currentIds;
    if (
      newestNew &&
      !actions.current.pinnedId &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      window.clearTimeout(highlightTimer.current);
      actions.current.updateExpanded(newestNew.id);
      highlightTimer.current = window.setTimeout(() => {
        if (!actions.current.pinnedId) {
          actions.current.updateExpanded(null);
        }
      }, 4000);
    }
  }, [sorted]);

  const cancelPending = () => {
    window.clearTimeout(leaveTimer.current);
    window.cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = 0;
  };
  const preview = (id: string) => {
    window.clearTimeout(leaveTimer.current);
    if (!expandOnHover || pinnedId) return;
    pendingHover.current = id;
    if (hoverFrame.current) return;
    hoverFrame.current = window.requestAnimationFrame(() => {
      hoverFrame.current = 0;
      if (actions.current.expandOnHover && !actions.current.pinnedId) {
        actions.current.updateExpanded(pendingHover.current);
      }
    });
  };
  const leave = () => {
    window.cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = 0;
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      const focused = listRef.current?.querySelector(":focus-visible");
      if (!actions.current.pinnedId && !focused) {
        actions.current.updateExpanded(null);
      }
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 120);
  };
  const togglePin = (id: string) => {
    cancelPending();
    window.clearTimeout(highlightTimer.current);
    const next = pinnedId === id ? null : id;
    updatePinned(next);
    updateExpanded(next);
  };

  React.useEffect(
    () => () => {
      window.clearTimeout(leaveTimer.current);
      window.clearTimeout(highlightTimer.current);
      window.cancelAnimationFrame(hoverFrame.current);
    },
    [],
  );

  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    const list = listRef.current;
    if (!stage || !list) return;
    let frame = 0;
    let live = true;
    const rows = Array.from(list.querySelectorAll("[data-entry]")) as HTMLLIElement[];
    const measure = () => {
      frame = 0;
      if (!live) return;
      const origin = stage.getBoundingClientRect().top;
      const firstNode = rows[0]
        ?.querySelector("[data-node]")
        ?.getBoundingClientRect();
      const lastNode = rows[rows.length - 1]
        ?.querySelector("[data-node]")
        ?.getBoundingClientRect();
      const activeIndex = rows.findIndex(
        (item) => item.dataset.entryId === activeId,
      );
      const activeRow = rows[activeIndex];
      const row = activeRow?.getBoundingClientRect();
      const bodyHeight =
        activeRow?.querySelector("[data-entry-body]")?.getBoundingClientRect()
          .height ?? 0;
      const fullHeight =
        activeRow?.querySelector("[data-entry-copy]")?.getBoundingClientRect()
          .height ?? 0;
      const precedingHeight = rows
        .slice(0, Math.max(0, activeIndex))
        .reduce(
          (height, item) =>
            height +
            (item.querySelector("[data-entry-body]")?.getBoundingClientRect()
              .height ?? 0),
          0,
        );
      const peek = rows[count];
      const peekBox = peek?.getBoundingClientRect();
      const peekHeader = peek
        ?.querySelector("[data-entry-trigger]")
        ?.getBoundingClientRect();
      const next = {
        top: row ? row.top - origin - precedingHeight : 0,
        height: row ? row.height - bodyHeight + fullHeight : 0,
        start: firstNode ? firstNode.top + firstNode.height / 2 - origin : 0,
        length:
          firstNode && lastNode
            ? lastNode.top +
              lastNode.height / 2 -
              firstNode.top -
              firstNode.height / 2
            : 0,
        maxHeight:
          peekBox && peekHeader
            ? peekBox.top - origin + peekHeader.height / 2
            : undefined,
      };
      setLayout((previous) =>
        Object.keys(next).every(
          (key) =>
            previous[key as keyof typeof next] === next[key as keyof typeof next],
        )
          ? previous
          : next,
      );
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    rows.forEach((row) => observer.observe(row));
    document.fonts?.ready.then(schedule).catch(() => undefined);
    return () => {
      live = false;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [activeId, entries, count]);

  let lastGroup = "";
  const historyExternal = historyHref ? isAbsoluteExternal(historyHref) : false;

  return (
    <div
      {...rest}
      ref={ref}
      role="region"
      aria-labelledby={titleId}
      data-slot="changelog-timeline"
      data-expanded={activeId ?? ""}
      data-pinned={pinnedId ?? ""}
      data-autoplay="false"
      className={cx(
        "flex w-full max-w-2xl flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      <style>{`
        @keyframes changelog-node-breathe { 0%,100% { transform:scale(1); opacity:.55 } 50% { transform:scale(1.35); opacity:1 } }
        @keyframes changelog-node-ripple { 0% { transform:scale(.8); opacity:.8 } 100% { transform:scale(3.2); opacity:0 } }
        [data-slot="changelog-timeline"] [data-idle-pulse="true"],
        [data-slot="changelog-timeline"] [data-live-pulse] { animation:changelog-node-breathe 2.4s ease-in-out infinite; }
        [data-slot="changelog-timeline"] [data-node-ripple] { animation:changelog-node-ripple 500ms ease-out both; }
        [data-slot="changelog-timeline"] [data-entry-body] { display:grid; grid-template-rows:0fr; transition:grid-template-rows 240ms ease-out; }
        [data-slot="changelog-timeline"] [data-entry-body][data-open="true"] { grid-template-rows:1fr; }
        [data-slot="changelog-timeline"] [data-rail-highlight] { transition:transform 300ms ease-out, background-color 300ms ease-out, opacity 160ms ease-out; }
        [data-slot="changelog-timeline"] [data-node-core] { transition:transform 240ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          [data-slot="changelog-timeline"] *, [data-slot="changelog-timeline"] *::before, [data-slot="changelog-timeline"] *::after { animation:none !important; transition:none !important; }
          [data-slot="changelog-timeline"] [data-node-ripple] { opacity:0; }
        }
      `}</style>

      <div className="flex shrink-0 items-start justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-xl border border-border bg-background"
          >
            <GitBranch className="size-4 text-muted-foreground" />
          </span>
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <p className="text-[10px] text-muted-foreground">
              {sorted.length} {sorted.length === 1 ? "update" : "updates"} today
            </p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        ) : (
          <span className="mt-1 text-[9px] text-muted-foreground">
            {isTouch ? "Tap to expand" : "Hover to read · click to pin"}
          </span>
        )}
      </div>

      {status && (
        <div className="shrink-0 px-4 pb-1.5">
          <div
            data-live-status
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-[10px] text-muted-foreground"
          >
            <span
              data-live-pulse
              aria-hidden="true"
              className="size-1.5 rounded-full bg-chart-2"
            />
            <span className="font-medium text-foreground">live</span>
            {status.commit && (
              <>
                <span aria-hidden="true">/</span>
                <span className="text-foreground/80">
                  {status.ref ? `${status.ref}@` : ""}
                  {status.commit}
                </span>
              </>
            )}
            {deployed && (
              <>
                <span aria-hidden="true">·</span>
                <span>updated {deployed}</span>
              </>
            )}
            {status.note && (
              <>
                <span aria-hidden="true">·</span>
                <span>{status.note}</span>
              </>
            )}
          </div>
        </div>
      )}

      <div
        data-list-viewport
        className="min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maxHeight: layout.maxHeight }}
      >
        <div ref={stageRef} data-rail-stage className="relative px-4 pb-2">
          <span
            data-rail-base
            aria-hidden="true"
            className="pointer-events-none absolute left-[25px] w-0.5 bg-border"
            style={{ top: layout.start, height: layout.length }}
          />
          <span
            data-rail-highlight
            aria-hidden="true"
            className="pointer-events-none absolute left-[24.5px] top-0 z-[1] h-px w-[3px] origin-top rounded-full"
            style={{
              transform: `translateY(${layout.top}px) scaleY(${layout.height})`,
              backgroundColor: activeEntry
                ? CATEGORY[activeEntry.category].color
                : "var(--color-primary)",
              opacity: activeId ? 1 : 0,
            }}
          />
          <ol
            ref={listRef}
            data-entry-list
            onPointerMove={(event) => {
              if (event.pointerType === "touch") return;
              const target = (event.target as Element).closest(
                "[data-entry]",
              ) as HTMLElement | null;
              if (target?.dataset.entryId) preview(target.dataset.entryId);
              else window.clearTimeout(leaveTimer.current);
            }}
            onPointerEnter={() => window.clearTimeout(leaveTimer.current)}
            onPointerLeave={leave}
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              ) {
                leave();
              }
            }}
          >
            {sorted.map((entry, index) => {
              const groupKey = entry.at ? entry.date : entry.date.slice(0, 7);
              const showGroup = groupKey !== lastGroup;
              lastGroup = groupKey;
              const dateObj = new Date(`${entry.date}T00:00:00Z`);
              const groupLabel = Number.isNaN(dateObj.getTime())
                ? groupKey
                : entry.at
                  ? DAY_LABEL.format(dateObj)
                  : MONTH_LABEL.format(dateObj);
              const timeText = entry.at
                ? IST_CLOCK.format(new Date(entry.at))
                : entry.date.slice(5).replace("-", ".");
              const category = CATEGORY[entry.category];
              const open = activeId === entry.id;
              const isPinned = pinnedId === entry.id;
              const bodyId = `${idPrefix}-body-${index}`;
              const triggerId = `${idPrefix}-trigger-${index}`;
              const entryExternal = entry.href
                ? isAbsoluteExternal(entry.href)
                : false;

              return (
                <React.Fragment key={entry.id}>
                  {showGroup && (
                    <li
                      data-month
                      className="flex h-5 items-center pl-9 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground"
                    >
                      {groupLabel}
                    </li>
                  )}
                  <li
                    data-entry
                    data-entry-id={entry.id}
                    data-category={entry.category}
                    data-open={open}
                    className={cx(
                      "relative rounded-lg transition-colors duration-200 motion-reduce:transition-none",
                      open && "bg-muted/65",
                    )}
                  >
                    <button
                      type="button"
                      id={triggerId}
                      data-entry-trigger={entry.id}
                      aria-expanded={open}
                      aria-pressed={isPinned}
                      aria-controls={bodyId}
                      title={entry.title}
                      onFocus={() => {
                        window.clearTimeout(leaveTimer.current);
                        if (!pinnedId) updateExpanded(entry.id);
                      }}
                      onClick={() => togglePin(entry.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelPending();
                          updatePinned(null);
                          updateExpanded(null);
                          return;
                        }
                        const direction =
                          event.key === "ArrowDown"
                            ? 1
                            : event.key === "ArrowUp"
                              ? -1
                              : 0;
                        if (
                          !direction &&
                          event.key !== "Home" &&
                          event.key !== "End"
                        ) {
                          return;
                        }
                        event.preventDefault();
                        const buttons = Array.from(
                          listRef.current?.querySelectorAll(
                            "[data-entry-trigger]",
                          ) ?? [],
                        ) as HTMLButtonElement[];
                        const next =
                          event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? buttons.length - 1
                              : (index + direction + buttons.length) %
                                buttons.length;
                        buttons[next]?.focus();
                      }}
                      className="grid min-h-8 w-full grid-cols-[20px_38px_66px_minmax(0,1fr)_14px] items-center gap-2 rounded-lg pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span
                        data-node
                        aria-hidden="true"
                        className="relative z-10 flex size-5 items-center justify-center"
                        style={{
                          color: open
                            ? category.color
                            : "var(--color-muted-foreground)",
                        }}
                      >
                        {open && (
                          <span
                            key={entry.id}
                            data-node-ripple
                            className="absolute size-3 rounded-full border border-current opacity-0"
                          />
                        )}
                        <span
                          data-node-core
                          data-idle-pulse={
                            index === 0 && !activeId ? "true" : undefined
                          }
                          className="relative size-2 rounded-full bg-current ring-[3px] ring-card"
                          style={{
                            transform: open ? "scale(1.4)" : "scale(1)",
                            opacity: open ? 1 : 0.45,
                          }}
                        />
                      </span>
                      <time
                        dateTime={entry.at ?? entry.date}
                        className="font-mono text-[10px] tabular-nums text-muted-foreground"
                      >
                        {timeText}
                      </time>
                      <span
                        className={cx(
                          "justify-self-start whitespace-nowrap rounded border px-1 py-px font-mono text-[9px] font-medium lowercase",
                          open
                            ? category.chip
                            : "border-border bg-muted/40 text-muted-foreground",
                        )}
                      >
                        {category.mark} {category.label}
                      </span>
                      <span
                        className={cx(
                          "truncate text-[12px] leading-5",
                          open
                            ? "font-semibold text-foreground"
                            : "font-medium text-foreground/85",
                        )}
                      >
                        {entry.title}
                      </span>
                      {isPinned ? (
                        <Pin
                          data-pin-mark
                          aria-label="Pinned"
                          className="size-3 text-foreground"
                        />
                      ) : (
                        <ChevronDown
                          aria-hidden="true"
                          className={cx(
                            "size-3 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                            open && "rotate-180",
                          )}
                        />
                      )}
                    </button>
                    <div
                      id={bodyId}
                      role="region"
                      aria-labelledby={triggerId}
                      aria-hidden={!open}
                      inert={!open}
                      data-entry-body
                      data-open={open}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div data-entry-copy className="pb-3 pl-9 pr-5 pt-0.5">
                          {entry.summary && (
                            <p className="text-xs leading-[18px] text-muted-foreground">
                              {entry.summary}
                            </p>
                          )}
                          {entry.href && (
                            <a
                              href={entry.href}
                              target={entryExternal ? "_blank" : undefined}
                              rel={entryExternal ? "noreferrer" : undefined}
                              className="mt-1 inline-block rounded-sm text-[11px] font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              Open
                              <span className="sr-only">: {entry.title}</span>
                            </a>
                          )}
                          {!entry.summary && !entry.href && (
                            <p className="text-xs leading-[18px] text-muted-foreground">
                              {entry.title}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
          {sorted.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing yet. Updates appear here live during UDAAN.
            </p>
          )}
        </div>
      </div>

      {historyHref && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-2">
          <a
            href={historyHref}
            target={historyExternal ? "_blank" : undefined}
            rel={historyExternal ? "noreferrer" : undefined}
            className="flex items-center gap-1.5 rounded text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GitCommitVertical aria-hidden="true" className="size-3.5" />
            {historyLabel}
          </a>
          <span className="text-[9px] text-muted-foreground">
            {pinnedId
              ? "Pinned · click again to release"
              : "Explore at your own pace"}
          </span>
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {pinnedId ? `Pinned: ${activeEntry?.title}` : "No update pinned."}
      </p>
    </div>
  );
}

export default ChangelogTimeline;
