"use client";

import * as React from "react";
import { BracketsManager } from "brackets-manager";
import { InMemoryDatabase } from "brackets-memory-db";
import { Award, GitBranch, Trash2 } from "lucide-react";
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
import { ALL_ALLOWED_EVENTS } from "@/lib/events";
import type {
  BracketData,
  BracketRecord,
  Department,
  Podium,
  Team,
} from "@/src/live/types";

const VALID_DEPTS: Department[] = ["CSE", "ECE", "EE", "ME", "CE", "Other"];

type ApiCallFn = <T>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
) => Promise<{ ok: true; data: T } | { ok: false; error: string }>;

export function ChampionshipControlCard({
  podiums,
  teams,
  apiCall,
  refetch,
}: {
  podiums: Podium[];
  teams: Team[];
  apiCall: ApiCallFn;
  refetch: () => Promise<void>;
}) {
  const [event, setEvent] = React.useState<string>("Cricket");
  const [place, setPlace] = React.useState<1 | 2 | 3>(1);
  const [department, setDepartment] = React.useState<Department>("CSE");
  const [teamId, setTeamId] = React.useState<string>("");
  const [label, setLabel] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);

  const eventTeams = React.useMemo(
    () => teams.filter((t) => t.event === event),
    [teams, event],
  );

  async function handleAward(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await apiCall<{ podium: Podium; push?: string }>(
      "/api/admin/podiums",
      "POST",
      {
        event,
        place,
        department,
        team_id: teamId || null,
        label: label.trim() || null,
      },
    );
    setSaving(false);
    if (res.ok) {
      setLabel("");
      setTeamId("");
      toast.success(
        res.data.push === "sent"
          ? "Podium awarded · phone push sent"
          : "Podium awarded.",
      );
      await refetch();
    } else {
      toast.error(res.error);
    }
  }

  async function handleUndo(p: Podium) {
    const res = await apiCall(
      `/api/admin/podiums?id=${encodeURIComponent(p.id)}`,
      "DELETE",
    );
    if (res.ok) {
      toast.success("Podium award removed.");
      await refetch();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="size-4 text-primary" />
          Award Podium
        </CardTitle>
        <CardDescription>
          Award 1st / 2nd / 3rd place per event. 1st place triggers a phone push.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleAward} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-event">Event</Label>
            <select
              id="p-event"
              value={event}
              onChange={(e) => {
                setEvent(e.target.value);
                setTeamId("");
              }}
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            >
              {ALL_ALLOWED_EVENTS.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-place">Place</Label>
            <select
              id="p-place"
              value={place}
              onChange={(e) => setPlace(Number(e.target.value) as 1 | 2 | 3)}
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value={1}>🥇 1st Place</option>
              <option value={2}>🥈 2nd Place</option>
              <option value={3}>🥉 3rd Place</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-dept">Department</Label>
            <select
              id="p-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value as Department)}
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            >
              {VALID_DEPTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-team">Team (optional)</Label>
            <select
              id="p-team"
              value={teamId}
              onChange={(e) => {
                const id = e.target.value;
                setTeamId(id);
                const found = eventTeams.find((t) => t.id === id);
                if (found) {
                  setDepartment(found.department);
                  if (!label) setLabel(found.name);
                }
              }}
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">None / Individual</option>
              {eventTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.department})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-label">Label (optional)</Label>
            <Input
              id="p-label"
              className="h-11"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Team / Winner label"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <Button type="submit" className="min-h-11" disabled={saving}>
              {saving ? "Awarding…" : "Award podium"}
            </Button>
          </div>
        </form>

        {podiums.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              Recent awards ({podiums.length})
            </p>
            {podiums.slice(0, 15).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span>{p.place === 1 ? "🥇" : p.place === 2 ? "🥈" : "🥉"}</span>
                  <span className="font-semibold">{p.event}</span>
                  <Badge variant="secondary">{p.department}</Badge>
                  {p.label && (
                    <span className="text-xs text-muted-foreground">
                      {p.label}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => void handleUndo(p)}
                >
                  Undo
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface BracketMatchRow {
  id: number;
  number: number;
  round_id: number;
  opponent1: { id: number | null; score?: number; result?: string } | null;
  opponent2: { id: number | null; score?: number; result?: string } | null;
}

interface BracketParticipantRow {
  id: number;
  name: string;
}

export function BracketsControlCard({
  brackets,
  teams,
  apiCall,
  refetch,
}: {
  brackets: BracketRecord[];
  teams: Team[];
  apiCall: ApiCallFn;
  refetch: () => Promise<void>;
}) {
  const [event, setEvent] = React.useState<string>("Football");
  const [seedingText, setSeedingText] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);

  const existing = brackets.find((b) => b.event === event) ?? null;
  const eventTeams = React.useMemo(
    () => teams.filter((t) => t.event === event),
    [teams, event],
  );

  function fillFromTeams() {
    if (eventTeams.length === 0) {
      toast.error(`No teams registered for ${event} yet.`);
      return;
    }
    setSeedingText(eventTeams.map((t) => t.name).join("\n"));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const seeding = seedingText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (seeding.length < 2) {
      toast.error("Enter at least 2 seeded teams (one per line).");
      return;
    }

    setSaving(true);
    try {
      const storage = new InMemoryDatabase();
      const manager = new BracketsManager(storage);
      await manager.create.stage({
        tournamentId: 0,
        name: event,
        type: "single_elimination",
        seeding,
        settings: {
          seedOrdering: ["inner_outer"],
          grandFinal: "none",
          consolationFinal: true,
        },
      });
      const exported = (await manager.export()) as unknown as BracketData;
      const res = await apiCall<{ bracket: BracketRecord }>(
        `/api/admin/brackets?event=${encodeURIComponent(event)}`,
        "PUT",
        exported,
      );
      if (res.ok) {
        toast.success(`Bracket generated for ${event}.`);
        await refetch();
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate bracket.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdvance(
    matchId: number,
    winnerSide: 1 | 2,
  ) {
    if (!existing) return;
    setSaving(true);
    try {
      const storage = new InMemoryDatabase();
      const manager = new BracketsManager(storage);
      await manager.import(existing.data as unknown as Parameters<BracketsManager["import"]>[0]);
      await manager.update.match({
        id: matchId,
        opponent1:
          winnerSide === 1
            ? { score: 1, result: "win" }
            : { score: 0, result: "loss" },
        opponent2:
          winnerSide === 2
            ? { score: 1, result: "win" }
            : { score: 0, result: "loss" },
      });
      const exported = (await manager.export()) as unknown as BracketData;
      const res = await apiCall<{ bracket: BracketRecord }>(
        `/api/admin/brackets?event=${encodeURIComponent(event)}`,
        "PUT",
        exported,
      );
      if (res.ok) {
        toast.success("Bracket match updated.");
        await refetch();
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to advance match.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBracket() {
    const res = await apiCall(
      `/api/admin/brackets?event=${encodeURIComponent(event)}`,
      "DELETE",
    );
    if (res.ok) {
      toast.success(`Bracket deleted for ${event}.`);
      await refetch();
    } else {
      toast.error(res.error);
    }
  }

  const participants = (existing?.data.participant ?? []) as BracketParticipantRow[];
  const pName = (id: number | null | undefined) =>
    id === null || id === undefined
      ? "TBD"
      : participants.find((p) => p.id === id)?.name ?? `#${id}`;
  const bracketMatches = (existing?.data.match ?? []) as BracketMatchRow[];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="size-4 text-primary" />
          Knockout Brackets
        </CardTitle>
        <CardDescription>
          Seed single-elimination brackets (with 3rd place playoff) and advance winners.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5 sm:w-56">
            <Label htmlFor="br-event">Event</Label>
            <select
              id="br-event"
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            >
              {ALL_ALLOWED_EVENTS.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="outline" className="min-h-11" onClick={fillFromTeams}>
            Load {event} teams ({eventTeams.length})
          </Button>
          {existing && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 text-destructive"
              onClick={() => void handleDeleteBracket()}
            >
              <Trash2 className="mr-1.5 size-4" />
              Delete bracket
            </Button>
          )}
        </div>

        <form onSubmit={handleGenerate} className="flex flex-col gap-2">
          <Label htmlFor="br-seed">Seeded teams (one per line, power of 2 ideal e.g. 4 or 8)</Label>
          <textarea
            id="br-seed"
            rows={4}
            value={seedingText}
            onChange={(e) => setSeedingText(e.target.value)}
            placeholder={"CSE Lions\nECE Falcons\nEE Titans\nME Warriors"}
            className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
          />
          <Button type="submit" className="min-h-11 sm:self-start" disabled={saving}>
            {saving ? "Generating…" : existing ? "Regenerate bracket" : "Generate bracket"}
          </Button>
        </form>

        {existing && bracketMatches.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              Advance winners ({bracketMatches.length} matches)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {bracketMatches.map((m) => {
                const name1 = pName(m.opponent1?.id);
                const name2 = pName(m.opponent2?.id);
                const ready = m.opponent1?.id !== null && m.opponent1?.id !== undefined && m.opponent2?.id !== null && m.opponent2?.id !== undefined;
                const won1 = m.opponent1?.result === "win";
                const won2 = m.opponent2?.result === "win";
                return (
                  <div key={m.id} className="flex flex-col gap-2 rounded-md border p-3 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Match #{m.number}</span>
                      {(won1 || won2) && <Badge variant="secondary">Completed</Badge>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={won1 ? "font-bold text-primary" : ""}>{name1}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant={won1 ? "default" : "outline"}
                        disabled={!ready || saving}
                        onClick={() => void handleAdvance(m.id, 1)}
                      >
                        Win
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={won2 ? "font-bold text-primary" : ""}>{name2}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant={won2 ? "default" : "outline"}
                        disabled={!ready || saving}
                        onClick={() => void handleAdvance(m.id, 2)}
                      >
                        Win
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
