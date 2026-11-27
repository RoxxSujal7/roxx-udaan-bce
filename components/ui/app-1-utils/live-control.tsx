"use client";

import * as React from "react";
import {
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  ListPlus,
  Megaphone,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  Radio,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ALL_ALLOWED_EVENTS } from "@/lib/events";
import {
  formatISTShortTime,
  isAnnouncementActive,
  toISTDateKey,
  useLiveData,
} from "@/src/live/client";
import type {
  Announcement,
  AnnouncementLevel,
  Match,
  MatchStatus,
} from "@/src/live/types";

interface LiveControlProps {
  adminPassword: string;
}

const EVENT_OPTIONS = [...ALL_ALLOWED_EVENTS, "Other"] as const;
const VALID_EVENT_SET = new Set<string>(EVENT_OPTIONS);

const FEST_DAYS = [
  { key: "2026-11-27", label: "Day 1 · 27 Nov" },
  { key: "2026-11-28", label: "Day 2 · 28 Nov" },
  { key: "2026-11-29", label: "Day 3 · 29 Nov" },
  { key: "2026-11-30", label: "Day 4 · 30 Nov" },
] as const;

const STATUS_BADGE: Record<
  MatchStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  live: "destructive",
  upcoming: "secondary",
  finished: "default",
  postponed: "outline",
  cancelled: "outline",
};

function toISTDateInput(iso: string): string {
  return toISTDateKey(iso);
}

function toISTTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "10:00";
  return d.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function istToUtcIso(dateStr: string, timeStr: string): string {
  const safeTime = /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : "10:00";
  return new Date(`${dateStr}T${safeTime}:00+05:30`).toISOString();
}

export function LiveControl({ adminPassword }: LiveControlProps) {
  const {
    matches,
    announcements,
    connection,
    refetch,
    setMatchesOptimistic,
    setAnnouncementsOptimistic,
  } = useLiveData();

  // ── Announcement state ───────────────────────────────────────────────────
  const [annMsg, setAnnMsg] = React.useState("");
  const [annLevel, setAnnLevel] = React.useState<AnnouncementLevel>("info");
  const [annLink, setAnnLink] = React.useState("");
  const [annExpiry, setAnnExpiry] = React.useState<string>("60");
  const [postingAnn, setPostingAnn] = React.useState(false);

  // ── Match Sheets state ───────────────────────────────────────────────────
  const [editMatch, setEditMatch] = React.useState<Match | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [scoreSheetMatch, setScoreSheetMatch] = React.useState<Match | null>(
    null,
  );
  const [finishSheetMatch, setFinishSheetMatch] = React.useState<Match | null>(
    null,
  );

  // Form fields for Add/Edit
  const [fEvent, setFEvent] = React.useState<string>("Cricket");
  const [fTitle, setFTitle] = React.useState("");
  const [fStage, setFStage] = React.useState("");
  const [fTeamA, setFTeamA] = React.useState("");
  const [fTeamB, setFTeamB] = React.useState("");
  const [fVenue, setFVenue] = React.useState("");
  const [fDate, setFDate] = React.useState("2026-11-27");
  const [fTime, setFTime] = React.useState("10:00");
  const [savingMatch, setSavingMatch] = React.useState(false);

  // Score Sheet fields
  const [sScoreA, setSScoreA] = React.useState("");
  const [sScoreB, setSScoreB] = React.useState("");

  // Finish Sheet fields
  const [fResult, setFResult] = React.useState("");

  // Bulk add fields
  const [bulkDate, setBulkDate] = React.useState("2026-11-27");
  const [bulkText, setBulkText] = React.useState("");
  const [savingBulk, setSavingBulk] = React.useState(false);

  const usedVenues = React.useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => m.venue && set.add(m.venue));
    return Array.from(set).sort();
  }, [matches]);

  const activeAnnouncements = React.useMemo(
    () => announcements.filter((a) => isAnnouncementActive(a)),
    [announcements],
  );

  // ── API helper ───────────────────────────────────────────────────────────
  async function apiCall<T>(
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${adminPassword}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json()) as { ok?: boolean; error?: string } & T;
      if (!res.ok || !json.ok) {
        return { ok: false, error: json.error || `Error ${res.status}` };
      }
      return { ok: true, data: json };
    } catch {
      return { ok: false, error: "Network error. Check connection." };
    }
  }

  // ── Announcement handlers ────────────────────────────────────────────────
  async function handlePostAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    const msg = annMsg.trim();
    if (msg.length < 3 || msg.length > 280) {
      toast.error("Announcement must be 3–280 characters.");
      return;
    }
    setPostingAnn(true);
    const expiryVal = annExpiry === "none" ? null : Number(annExpiry);
    const res = await apiCall<{
      announcement: Announcement;
      push?: "sent" | "skipped" | "failed";
    }>(
      "/api/admin/announcements",
      "POST",
      {
        message: msg,
        level: annLevel,
        link: annLink.trim() || null,
        expiresInMinutes: expiryVal,
      },
    );
    setPostingAnn(false);
    if (res.ok) {
      setAnnouncementsOptimistic((prev) => [res.data.announcement, ...prev]);
      setAnnMsg("");
      setAnnLink("");
      if (annLevel === "urgent" || annLevel === "important") {
        toast.success(
          res.data.push === "sent"
            ? "Posted · phone push sent"
            : "Posted · push skipped",
        );
      } else {
        toast.success("Announcement posted.");
      }
    } else {
      toast.error(res.error);
    }
  }

  async function handleRemoveAnnouncement(ann: Announcement) {
    const snapshot = announcements;
    setAnnouncementsOptimistic((prev) =>
      prev.map((a) => (a.id === ann.id ? { ...a, active: false } : a)),
    );
    const res = await apiCall(
      `/api/admin/announcements?id=${encodeURIComponent(ann.id)}`,
      "PATCH",
      { active: false },
    );
    if (res.ok) {
      toast.success("Announcement removed.");
    } else {
      setAnnouncementsOptimistic(() => snapshot);
      toast.error(res.error);
    }
  }

  // ── Match handlers ───────────────────────────────────────────────────────
  function openAddSheet() {
    setEditMatch(null);
    setFEvent("Cricket");
    setFTitle("");
    setFStage("");
    setFTeamA("");
    setFTeamB("");
    setFVenue("");
    setFDate("2026-11-27");
    setFTime("10:00");
    setAddOpen(true);
  }

  function openEditSheet(m: Match) {
    setEditMatch(m);
    setFEvent(m.event);
    setFTitle(m.title ?? "");
    setFStage(m.stage ?? "");
    setFTeamA(m.team_a ?? "");
    setFTeamB(m.team_b ?? "");
    setFVenue(m.venue);
    setFDate(toISTDateInput(m.starts_at));
    setFTime(toISTTimeInput(m.starts_at));
    setAddOpen(true);
  }

  async function handleSaveMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!fVenue.trim()) {
      toast.error("Venue is required.");
      return;
    }
    setSavingMatch(true);
    const payload = {
      event: fEvent,
      title: fTitle.trim() || null,
      stage: fStage.trim() || null,
      team_a: fTeamA.trim() || null,
      team_b: fTeamB.trim() || null,
      venue: fVenue.trim(),
      starts_at: istToUtcIso(fDate, fTime),
    };

    if (editMatch) {
      const snapshot = matches;
      setMatchesOptimistic((prev) =>
        prev.map((m) => (m.id === editMatch.id ? { ...m, ...payload } : m)),
      );
      const res = await apiCall<{ match: Match }>(
        `/api/admin/matches?id=${encodeURIComponent(editMatch.id)}`,
        "PATCH",
        payload,
      );
      setSavingMatch(false);
      if (res.ok) {
        setMatchesOptimistic((prev) =>
          prev.map((m) => (m.id === editMatch.id ? res.data.match : m)),
        );
        setAddOpen(false);
        toast.success("Match updated.");
      } else {
        setMatchesOptimistic(() => snapshot);
        toast.error(res.error);
      }
    } else {
      const res = await apiCall<{ matches: Match[] }>(
        "/api/admin/matches",
        "POST",
        payload,
      );
      setSavingMatch(false);
      if (res.ok) {
        setMatchesOptimistic((prev) => [...prev, ...res.data.matches]);
        setAddOpen(false);
        toast.success("Match added.");
      } else {
        toast.error(res.error);
      }
    }
  }

  async function patchMatchQuick(
    m: Match,
    patch: Partial<Match>,
    successMsg: string,
  ) {
    const snapshot = matches;
    setMatchesOptimistic((prev) =>
      prev.map((row) => (row.id === m.id ? { ...row, ...patch } : row)),
    );
    const res = await apiCall<{ match: Match }>(
      `/api/admin/matches?id=${encodeURIComponent(m.id)}`,
      "PATCH",
      patch,
    );
    if (res.ok) {
      setMatchesOptimistic((prev) =>
        prev.map((row) => (row.id === m.id ? res.data.match : row)),
      );
      toast.success(successMsg);
    } else {
      setMatchesOptimistic(() => snapshot);
      toast.error(res.error);
    }
  }

  async function handleSaveScore(e: React.FormEvent) {
    e.preventDefault();
    if (!scoreSheetMatch) return;
    const m = scoreSheetMatch;
    setScoreSheetMatch(null);
    await patchMatchQuick(
      m,
      { score_a: sScoreA.trim() || null, score_b: sScoreB.trim() || null },
      "Score updated.",
    );
  }

  async function handleFinishMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!finishSheetMatch) return;
    const m = finishSheetMatch;
    setFinishSheetMatch(null);
    await patchMatchQuick(
      m,
      { status: "finished", result: fResult.trim() || null },
      "Match marked finished.",
    );
  }

  async function handleDeleteMatch(m: Match) {
    const snapshot = matches;
    setMatchesOptimistic((prev) => prev.filter((row) => row.id !== m.id));
    const res = await apiCall(
      `/api/admin/matches?id=${encodeURIComponent(m.id)}`,
      "DELETE",
    );
    if (res.ok) {
      toast.success("Match deleted.");
    } else {
      setMatchesOptimistic(() => snapshot);
      toast.error(res.error);
    }
  }

  // ── Bulk parser ──────────────────────────────────────────────────────────
  const parsedBulk = React.useMemo(() => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map((line, idx) => {
      const parts = line.split("|").map((p) => p.trim());
      const [event = "", teamA = "", teamB = "", venue = "", time = "", stage = ""] =
        parts;
      const errors: string[] = [];
      if (!VALID_EVENT_SET.has(event)) errors.push(`Unknown event "${event}"`);
      if (!venue) errors.push("Missing venue");
      if (!/^\d{2}:\d{2}$/.test(time)) errors.push("Time must be HH:MM");
      return {
        lineNo: idx + 1,
        valid: errors.length === 0,
        error: errors.join(", "),
        payload: {
          event,
          team_a: teamA || null,
          team_b: teamB || null,
          venue,
          starts_at: /^\d{2}:\d{2}$/.test(time)
            ? istToUtcIso(bulkDate, time)
            : "",
          stage: stage || null,
        },
      };
    });
  }, [bulkText, bulkDate]);

  async function handleSaveBulk() {
    const validRows = parsedBulk.filter((r) => r.valid).map((r) => r.payload);
    if (validRows.length === 0) {
      toast.error("No valid rows to save.");
      return;
    }
    setSavingBulk(true);
    const res = await apiCall<{ matches: Match[] }>(
      "/api/admin/matches",
      "POST",
      validRows,
    );
    setSavingBulk(false);
    if (res.ok) {
      setMatchesOptimistic((prev) => [...prev, ...res.data.matches]);
      setBulkText("");
      setBulkOpen(false);
      toast.success(`Added ${res.data.matches.length} match(es).`);
    } else {
      toast.error(res.error);
    }
  }

  // ── Group matches by day ─────────────────────────────────────────────────
  const groupedMatches = React.useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const d of FEST_DAYS) groups.set(d.key, []);
    const other: Match[] = [];
    for (const m of matches) {
      const key = toISTDateKey(m.starts_at);
      if (groups.has(key)) groups.get(key)!.push(m);
      else other.push(m);
    }
    return { groups, other };
  }, [matches]);

  return (
    <section id="live" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Live control</h2>
          <Badge variant={connection === "realtime" ? "default" : "secondary"}>
            {connection === "realtime"
              ? "Realtime"
              : connection === "fallback"
                ? "60s fallback"
                : connection}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => void refetch()}
          >
            Sync live data
          </Button>
          <Button
            variant="outline"
            className="min-h-11 gap-1.5"
            onClick={() => setBulkOpen(true)}
          >
            <ListPlus className="size-4" />
            Bulk add
          </Button>
          <Button className="min-h-11 gap-1.5" onClick={openAddSheet}>
            <Plus className="size-4" />
            Add match
          </Button>
        </div>
      </div>

      {/* ── Post Announcement Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="size-4" />
            Post announcement
          </CardTitle>
          <CardDescription>
            Appears instantly as a banner on every open page of the site
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handlePostAnnouncement} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ann-msg">Message</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {annMsg.length}/280
                </span>
              </div>
              <textarea
                id="ann-msg"
                rows={2}
                maxLength={280}
                value={annMsg}
                onChange={(e) => setAnnMsg(e.target.value)}
                placeholder="e.g. Cricket final moved to Ground 2"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ann-level">Level</Label>
                <select
                  id="ann-level"
                  value={annLevel}
                  onChange={(e) =>
                    setAnnLevel(e.target.value as AnnouncementLevel)
                  }
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="info">Info (auto-hides 10s)</option>
                  <option value="important">Important (orange)</option>
                  <option value="urgent">Urgent (red + vibrate)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ann-expiry">Expires</Label>
                <select
                  id="ann-expiry"
                  value={annExpiry}
                  onChange={(e) => setAnnExpiry(e.target.value)}
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="60">1 hr</option>
                  <option value="120">2 hr</option>
                  <option value="none">Until removed</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ann-link">Link (optional, relative)</Label>
                <Input
                  id="ann-link"
                  className="h-11"
                  value={annLink}
                  onChange={(e) => setAnnLink(e.target.value)}
                  placeholder="/Templates/live.html"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="min-h-11 w-full sm:w-auto sm:self-start px-6"
              disabled={postingAnn || annMsg.trim().length < 3}
            >
              {postingAnn ? "Posting…" : "Post now"}
            </Button>
          </form>

          {activeAnnouncements.length > 0 && (
            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground">
                Active announcements ({activeAnnouncements.length})
              </p>
              {activeAnnouncements.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          a.level === "urgent"
                            ? "destructive"
                            : a.level === "important"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {a.level}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatISTShortTime(a.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 break-words">{a.message}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="min-h-11 shrink-0"
                    onClick={() => void handleRemoveAnnouncement(a)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Matches grouped by day ── */}
      {FEST_DAYS.map((day) => {
        const list = groupedMatches.groups.get(day.key) ?? [];
        return (
          <Card key={day.key}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="size-4 text-muted-foreground" />
                {day.label}
                <Badge variant="secondary" className="ml-auto">
                  {list.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {list.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No matches scheduled for this day.
                </p>
              )}
              {list.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col gap-3 rounded-lg border p-3 ${
                    m.hidden ? "opacity-55" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-sm">{m.event}</span>
                        {m.stage && (
                          <Badge variant="outline" className="text-[10px]">
                            {m.stage}
                          </Badge>
                        )}
                        <Badge variant={STATUS_BADGE[m.status]}>
                          {m.status}
                        </Badge>
                        {m.hidden && <Badge variant="outline">Hidden</Badge>}
                      </div>
                      <p className="mt-1 text-sm">
                        {m.team_a && m.team_b
                          ? `${m.team_a} vs ${m.team_b}`
                          : m.team_a || m.title || "Open event"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatISTShortTime(m.starts_at)} · {m.venue}
                        {m.title && m.team_a ? ` · ${m.title}` : ""}
                      </p>
                      {(m.score_a || m.score_b) && (
                        <p className="mt-1 font-mono text-sm font-semibold text-primary">
                          Score: {m.score_a ?? "0"} – {m.score_b ?? "0"}
                        </p>
                      )}
                      {m.result && (
                        <p className="mt-1 text-xs font-medium text-foreground">
                          Result: {m.result}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Phone-friendly >= 44px action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {m.status !== "live" && (
                      <Button
                        size="sm"
                        className="min-h-11 gap-1"
                        onClick={() =>
                          void patchMatchQuick(
                            m,
                            { status: "live" },
                            `${m.event} is now LIVE`,
                          )
                        }
                      >
                        <Play className="size-3.5" />
                        Start
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => {
                        setScoreSheetMatch(m);
                        setSScoreA(m.score_a ?? "");
                        setSScoreB(m.score_b ?? "");
                      }}
                    >
                      Update score
                    </Button>
                    {m.status !== "finished" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="min-h-11 gap-1"
                        onClick={() => {
                          setFinishSheetMatch(m);
                          setFResult(m.result ?? "");
                        }}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Finish
                      </Button>
                    )}
                    {m.status !== "postponed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11 gap-1"
                        onClick={() =>
                          void patchMatchQuick(
                            m,
                            { status: "postponed" },
                            "Match postponed.",
                          )
                        }
                      >
                        <PauseCircle className="size-3.5" />
                        Postpone
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11 gap-1"
                      onClick={() => openEditSheet(m)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-11 gap-1"
                      onClick={() =>
                        void patchMatchQuick(
                          m,
                          { hidden: !m.hidden },
                          m.hidden ? "Match visible." : "Match hidden.",
                        )
                      }
                    >
                      {m.hidden ? (
                        <>
                          <Eye className="size-3.5" />
                          Show
                        </>
                      ) : (
                        <>
                          <EyeOff className="size-3.5" />
                          Hide
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-11 text-destructive"
                      aria-label="Delete match"
                      onClick={() => void handleDeleteMatch(m)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Other dates (e.g. practice/warmup) */}
      {groupedMatches.other.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Other dates</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {groupedMatches.other.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div>
                  <span className="font-semibold">{m.event}</span> ·{" "}
                  {m.team_a && m.team_b
                    ? `${m.team_a} vs ${m.team_b}`
                    : m.title || m.venue}
                  <p className="text-xs text-muted-foreground">
                    {toISTDateKey(m.starts_at)} {formatISTShortTime(m.starts_at)} ·{" "}
                    {m.venue}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => openEditSheet(m)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-11 text-destructive"
                    onClick={() => void handleDeleteMatch(m)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Add / Edit Match Sheet ── */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="overflow-y-auto w-full sm:max-w-md">
          <SheetHeader className="mb-4">
            <SheetTitle>{editMatch ? "Edit match" : "Add match"}</SheetTitle>
            <SheetDescription>
              Times are in IST (Asia/Kolkata).
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSaveMatch} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="m-event">Event</Label>
              <select
                id="m-event"
                value={fEvent}
                onChange={(e) => setFEvent(e.target.value)}
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              >
                {EVENT_OPTIONS.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-stage">Stage</Label>
                <Input
                  id="m-stage"
                  className="h-11"
                  value={fStage}
                  onChange={(e) => setFStage(e.target.value)}
                  placeholder="Semi-final"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-title">Title (optional)</Label>
                <Input
                  id="m-title"
                  className="h-11"
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  placeholder="Girls Final"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-teama">Team A</Label>
                <Input
                  id="m-teama"
                  className="h-11"
                  value={fTeamA}
                  onChange={(e) => setFTeamA(e.target.value)}
                  placeholder="CSE"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-teamb">Team B</Label>
                <Input
                  id="m-teamb"
                  className="h-11"
                  value={fTeamB}
                  onChange={(e) => setFTeamB(e.target.value)}
                  placeholder="ECE"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="m-venue">Venue</Label>
              <Input
                id="m-venue"
                list="udaan-venues"
                className="h-11"
                value={fVenue}
                onChange={(e) => setFVenue(e.target.value)}
                placeholder="Main Ground"
                required
              />
              <datalist id="udaan-venues">
                {usedVenues.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-date">Date (IST)</Label>
                <Input
                  id="m-date"
                  type="date"
                  min="2026-11-20"
                  max="2026-12-05"
                  className="h-11"
                  value={fDate}
                  onChange={(e) => setFDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-time">Time (IST)</Label>
                <Input
                  id="m-time"
                  type="time"
                  className="h-11"
                  value={fTime}
                  onChange={(e) => setFTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="mt-2 min-h-11" disabled={savingMatch}>
              {savingMatch ? "Saving…" : editMatch ? "Save changes" : "Add match"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Update Score Sheet ── */}
      <Sheet
        open={scoreSheetMatch !== null}
        onOpenChange={(o) => !o && setScoreSheetMatch(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-sm">
          {scoreSheetMatch && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>Update score</SheetTitle>
                <SheetDescription>
                  {scoreSheetMatch.event} ·{" "}
                  {scoreSheetMatch.team_a ?? "Team A"} vs{" "}
                  {scoreSheetMatch.team_b ?? "Team B"}
                </SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSaveScore} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-a">
                    {scoreSheetMatch.team_a || "Team A"} score
                  </Label>
                  <Input
                    id="s-a"
                    className="h-11"
                    value={sScoreA}
                    onChange={(e) => setSScoreA(e.target.value)}
                    placeholder="145/6 (18.2)"
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-b">
                    {scoreSheetMatch.team_b || "Team B"} score
                  </Label>
                  <Input
                    id="s-b"
                    className="h-11"
                    value={sScoreB}
                    onChange={(e) => setSScoreB(e.target.value)}
                    placeholder="120/4 (15.0)"
                  />
                </div>
                <Button type="submit" className="min-h-11">
                  Save score
                </Button>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Finish Match Sheet ── */}
      <Sheet
        open={finishSheetMatch !== null}
        onOpenChange={(o) => !o && setFinishSheetMatch(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-sm">
          {finishSheetMatch && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>Finish match</SheetTitle>
                <SheetDescription>
                  {finishSheetMatch.event} ·{" "}
                  {finishSheetMatch.team_a ?? "Team A"} vs{" "}
                  {finishSheetMatch.team_b ?? "Team B"}
                </SheetDescription>
              </SheetHeader>
              <form
                onSubmit={handleFinishMatch}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="f-res">Result (optional)</Label>
                  <Input
                    id="f-res"
                    className="h-11"
                    value={fResult}
                    onChange={(e) => setFResult(e.target.value)}
                    placeholder="CSE won by 4 wickets"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="min-h-11">
                  Mark finished
                </Button>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Bulk Add Sheet ── */}
      <Sheet open={bulkOpen} onOpenChange={setBulkOpen}>
        <SheetContent side="right" className="overflow-y-auto w-full sm:max-w-lg">
          <SheetHeader className="mb-4">
            <SheetTitle>Bulk add matches</SheetTitle>
            <SheetDescription>
              One per line: Event | Team A | Team B | Venue | HH:MM | Stage
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-date">Date (IST)</Label>
              <Input
                id="b-date"
                type="date"
                min="2026-11-20"
                max="2026-12-05"
                className="h-11"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-text">Matches</Label>
              <textarea
                id="b-text"
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Cricket | CSE | ECE | Main Ground | 09:30 | League"
                className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {parsedBulk.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-md border p-2.5 text-xs">
                <p className="font-medium">
                  Preview ({parsedBulk.filter((r) => r.valid).length} valid /{" "}
                  {parsedBulk.length} total)
                </p>
                {parsedBulk.map((r) => (
                  <div
                    key={r.lineNo}
                    className={r.valid ? "text-foreground" : "text-destructive"}
                  >
                    L{r.lineNo}:{" "}
                    {r.valid
                      ? `${r.payload.event} · ${r.payload.team_a ?? "—"} vs ${r.payload.team_b ?? "—"} @ ${r.payload.venue}`
                      : r.error}
                  </div>
                ))}
              </div>
            )}

            <Button
              className="min-h-11"
              disabled={
                savingBulk || parsedBulk.filter((r) => r.valid).length === 0
              }
              onClick={() => void handleSaveBulk()}
            >
              {savingBulk ? "Saving…" : "Save valid matches"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
