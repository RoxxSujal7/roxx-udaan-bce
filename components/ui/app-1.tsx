"use client";

import React, { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Gamepad2,
  RefreshCw,
  Search,
  Trophy,
  Users,
  UsersRound,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/app-1-utils/sidebar";
import { App1Sidebar } from "@/components/ui/app-1-utils/app-1-sidebar";
import { LiveControl } from "@/components/ui/app-1-utils/live-control";
import {
  app1ChartConfig,
  buildDailyChart,
  buildEventStats,
  buildRecentActivity,
  buildStats,
  type Registration,
} from "@/components/ui/app-1-utils/app-1-data";
import { getEventGroup } from "@/lib/events";

// ─── Props ─────────────────────────────────────────────────────────────────

interface App1Props {
  registrations: Registration[];
  fetchedAt: string;
  onRefresh: () => void;
  onLogout: () => void;
  refreshing: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 50;

/** Format a UTC ISO string as an IST time, e.g. "26 Nov, 2:15 PM". */
function formatIST(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatISTTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Block spreadsheet formula injection
  const unsafe = /^[=+\-@\t\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return `"${unsafe ? "'" + escaped : escaped}"`;
}

// ─── Main Component ────────────────────────────────────────────────────────

export function App1({
  registrations,
  fetchedAt,
  onRefresh,
  onLogout,
  refreshing,
}: App1Props) {
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "individual" | "team">(
    "all",
  );
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<Registration | null>(null);

  const stats = useMemo(() => buildStats(registrations), [registrations]);
  const dailyChart = useMemo(
    () => buildDailyChart(registrations),
    [registrations],
  );
  const eventStats = useMemo(
    () => buildEventStats(registrations),
    [registrations],
  );
  const recentActivity = useMemo(
    () => buildRecentActivity(registrations, 8),
    [registrations],
  );

  const maxEventCount = eventStats[0]?.count ?? 1;

  // ─── Filtering ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return registrations.filter((r) => {
      if (typeFilter !== "all" && r.participation_type !== typeFilter)
        return false;
      if (
        eventFilter !== "all" &&
        !(Array.isArray(r.events) && r.events.includes(eventFilter))
      )
        return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        (r.college?.toLowerCase() ?? "").includes(q) ||
        (r.team_name?.toLowerCase() ?? "").includes(q) ||
        (r.roll_number?.toLowerCase() ?? "").includes(q)
      );
    });
  }, [registrations, search, eventFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const pageRows = filtered.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE,
  );

  // Reset page when filters change
  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const handleEventFilter = (v: string) => {
    setEventFilter(v);
    setPage(1);
  };
  const handleTypeFilter = (v: "all" | "individual" | "team") => {
    setTypeFilter(v);
    setPage(1);
  };

  // ─── CSV Export ──────────────────────────────────────────────────────────

  function handleDownloadCSV() {
    const BOM = "\uFEFF";
    const headers = [
      "created_at (IST)",
      "full_name",
      "email",
      "phone",
      "college",
      "roll_number",
      "department",
      "academic_year",
      "events",
      "participation_type",
      "team_name",
      "team_members",
      "notes",
      "submission_id",
    ];
    const rows = filtered.map((r) => [
      formatIST(r.created_at),
      r.full_name,
      r.email,
      r.phone,
      r.college,
      r.roll_number ?? "",
      r.department ?? "",
      r.academic_year ?? "",
      Array.isArray(r.events) ? r.events.join("; ") : "",
      r.participation_type,
      r.team_name ?? "",
      r.team_members ?? "",
      r.notes ?? "",
      r.submission_id,
    ]);
    const csv =
      BOM +
      [headers.map(csvEscape).join(",")]
        .concat(rows.map((row) => row.map(csvEscape).join(",")))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `udaan-registrations-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── All events list (for filter dropdown) ───────────────────────────────
  const allEventOptions = useMemo(() => {
    const seen = new Set<string>();
    registrations.forEach((r) =>
      (Array.isArray(r.events) ? r.events : []).forEach((e) => seen.add(e)),
    );
    return Array.from(seen).sort();
  }, [registrations]);

  // ─── Updated time ─────────────────────────────────────────────────────────
  const updatedLabel = fetchedAt
    ? formatISTTime(fetchedAt)
    : "";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SidebarProvider>
      <App1Sidebar onDownloadCSV={handleDownloadCSV} onLogout={onLogout} />

      <SidebarInset className="min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-background px-4 sm:px-6">
          <SidebarTrigger aria-label="Toggle navigation" />
          <h1 className="truncate text-lg font-semibold">
            UDAAN 2026 · Registrations
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden sm:flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-8 w-48 pl-8 text-xs"
              />
            </div>
            {updatedLabel && (
              <span className="hidden sm:block text-xs text-muted-foreground whitespace-nowrap">
                Updated {updatedLabel}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </Button>
            <Avatar className="ml-1 size-8">
              <AvatarImage src="../Assets/Logo.png" alt="UDAAN 2026" />
              <AvatarFallback className="text-xs font-bold">UD</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
          {/* Mobile search */}
          <div className="flex sm:hidden items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search name, email, phone…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>

          {/* ── Stats ── */}
          <div id="overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total registrations
                </CardTitle>
                <Users aria-hidden className="size-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {stats.total}
                </p>
                <p className="text-xs text-muted-foreground">
                  +{stats.todayCount} today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  UDAAN entries
                </CardTitle>
                <Trophy aria-hidden className="size-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {stats.udaanCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sports &amp; cultural
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  IGNITION entries
                </CardTitle>
                <Gamepad2 aria-hidden className="size-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {stats.ignitionCount}
                </p>
                <p className="text-xs text-muted-foreground">Esports</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Team entries
                </CardTitle>
                <UsersRound
                  aria-hidden
                  className="size-5 text-muted-foreground"
                />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {stats.teamCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.teamPct}% of all
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Daily chart ── */}
          <Card>
            <CardHeader>
              <CardTitle>Registrations per day</CardTitle>
              <CardDescription>
                UDAAN vs IGNITION, last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={app1ChartConfig}
                className="h-64 w-full"
              >
                <AreaChart
                  data={dailyChart}
                  margin={{ left: 4, right: 4, top: 8 }}
                  accessibilityLayer
                >
                  <defs>
                    <linearGradient
                      id="app1Udaan"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--color-udaan)"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-udaan)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    dataKey="ignition"
                    type="monotone"
                    stroke="var(--color-ignition)"
                    strokeDasharray="4 4"
                    fill="none"
                    strokeWidth={2}
                  />
                  <Area
                    dataKey="udaan"
                    type="monotone"
                    stroke="var(--color-udaan)"
                    fill="url(#app1Udaan)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* ── Event stats + Recent activity ── */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Events */}
            <Card id="events">
              <CardHeader>
                <CardTitle>Registrations by event</CardTitle>
                <CardDescription>
                  Click an event to filter the table
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {eventStats.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No registrations yet.
                  </p>
                )}
                {eventStats.map((ev) => (
                  <button
                    key={ev.event}
                    onClick={() =>
                      handleEventFilter(
                        eventFilter === ev.event ? "all" : ev.event,
                      )
                    }
                    className={`flex flex-col gap-2 text-left w-full rounded-md p-1.5 transition-colors ${
                      eventFilter === ev.event
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-medium">
                        {ev.event}
                      </h3>
                      <Badge
                        variant={
                          ev.group === "Legacy"
                            ? "outline"
                            : ev.group === "IGNITION"
                              ? "secondary"
                              : "default"
                        }
                      >
                        {ev.group}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ev.teamCount} team{ev.teamCount !== 1 ? "s" : ""}
                    </p>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={(ev.count / maxEventCount) * 100}
                        aria-label={`${ev.event} progress`}
                      />
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums w-6 text-right">
                        {ev.count}
                      </span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Recent activity */}
            <Card>
              <CardHeader>
                <CardTitle>Latest registrations</CardTitle>
                <CardDescription>
                  Most recent 8 entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No registrations yet.
                  </p>
                )}
                <ol className="flex flex-col gap-4">
                  {recentActivity.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">
                          {entry.person.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug">
                          <span className="font-medium">
                            {entry.person.name}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {entry.action}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.time}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>

          {/* ── All Registrations table ── */}
          <Card id="registrations">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="shrink-0">All registrations</CardTitle>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {/* Event filter */}
                  <select
                    value={eventFilter}
                    onChange={(e) => handleEventFilter(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Filter by event"
                  >
                    <option value="all">All events</option>
                    {allEventOptions.map((ev) => (
                      <option key={ev} value={ev}>
                        {ev}
                      </option>
                    ))}
                  </select>

                  {/* Type filter */}
                  <select
                    value={typeFilter}
                    onChange={(e) =>
                      handleTypeFilter(
                        e.target.value as "all" | "individual" | "team",
                      )
                    }
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Filter by participation type"
                  >
                    <option value="all">All types</option>
                    <option value="individual">Individual</option>
                    <option value="team">Team</option>
                  </select>

                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Showing {filtered.length} of {registrations.length}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleDownloadCSV}
                  >
                    Download CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Scroll wrapper prevents horizontal page overflow */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium whitespace-nowrap">
                        Time (IST)
                      </th>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Phone</th>
                      <th className="px-4 py-2 font-medium hidden md:table-cell">
                        College
                      </th>
                      <th className="px-4 py-2 font-medium hidden lg:table-cell">
                        Dept / Year
                      </th>
                      <th className="px-4 py-2 font-medium">Events</th>
                      <th className="px-4 py-2 font-medium hidden sm:table-cell">
                        Type
                      </th>
                      <th className="px-4 py-2 font-medium hidden xl:table-cell">
                        Team
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          No results.
                        </td>
                      </tr>
                    )}
                    {pageRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setSelectedRow(row)}
                      >
                        <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {formatIST(row.created_at)}
                        </td>
                        <td className="px-4 py-2 font-medium max-w-[140px] truncate">
                          {row.full_name}
                        </td>
                        <td className="px-4 py-2">
                          <a
                            href={`tel:${row.phone}`}
                            className="text-primary hover:underline text-xs whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.phone}
                          </a>
                        </td>
                        <td className="px-4 py-2 hidden md:table-cell text-xs max-w-[180px] truncate">
                          {row.college}
                        </td>
                        <td className="px-4 py-2 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                          {[row.department, row.academic_year]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(Array.isArray(row.events) ? row.events : []).map(
                              (ev) => (
                                <Badge
                                  key={ev}
                                  variant={
                                    getEventGroup(ev) === "Legacy"
                                      ? "outline"
                                      : getEventGroup(ev) === "IGNITION"
                                        ? "secondary"
                                        : "default"
                                  }
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {ev}
                                </Badge>
                              ),
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 hidden sm:table-cell">
                          <Badge
                            variant={
                              row.participation_type === "team"
                                ? "outline"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {row.participation_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 hidden xl:table-cell text-xs text-muted-foreground max-w-[120px] truncate">
                          {row.team_name ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Live Control (Matches + Announcements) ── */}
          <LiveControl />
        </main>
      </SidebarInset>

      {/* Detail Sheet */}
      <Sheet
        open={selectedRow !== null}
        onOpenChange={(open) => !open && setSelectedRow(null)}
      >
        <SheetContent side="right" className="overflow-y-auto w-full sm:max-w-md">
          {selectedRow && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{selectedRow.full_name}</SheetTitle>
                <SheetDescription>
                  Registration details
                </SheetDescription>
              </SheetHeader>

              <dl className="flex flex-col gap-3 text-sm">
                {[
                  ["Email", <a href={`mailto:${selectedRow.email}`} className="text-primary hover:underline break-all">{selectedRow.email}</a>],
                  ["Phone", <a href={`tel:${selectedRow.phone}`} className="text-primary hover:underline">{selectedRow.phone}</a>],
                  ["College", selectedRow.college],
                  ["Roll No.", selectedRow.roll_number ?? "—"],
                  ["Department", selectedRow.department ?? "—"],
                  ["Year", selectedRow.academic_year ?? "—"],
                  ["Events", (Array.isArray(selectedRow.events) ? selectedRow.events : []).join(", ") || "—"],
                  ["Type", selectedRow.participation_type],
                  ["Team name", selectedRow.team_name ?? "—"],
                  ["Team members", selectedRow.team_members ?? "—"],
                  ["Notes", selectedRow.notes ?? "—"],
                  ["Status", selectedRow.status],
                  ["Submitted at", formatIST(selectedRow.created_at)],
                  ["Submission ID", <span className="font-mono text-xs break-all">{selectedRow.submission_id}</span>],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex flex-col gap-0.5">
                    <dt className="text-xs font-medium text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="text-sm">{value as React.ReactNode}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}

export default App1;
