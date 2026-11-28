// Cloudflare Pages Function: POST / PATCH / DELETE /api/admin/matches

import { ALL_ALLOWED_EVENTS } from "../../../lib/events";
import {
  adminJsonResponse,
  requireAdminAuth,
  type AdminEnv,
} from "../../../lib/server/admin-auth";
import {
  buildLiveClickUrl,
  publishPush,
  type NtfyEnv,
  type PushOutcome,
} from "../../../lib/server/ntfy";
import {
  getSupabaseConfig,
  logSupabaseError,
  supabaseFetch,
  type SupabaseConfig,
} from "../../../lib/server/supabase-rest";

interface PagesContext {
  request: Request;
  env: AdminEnv & NtfyEnv;
  waitUntil?: (promise: Promise<unknown>) => void;
}

const VALID_EVENTS = new Set<string>([...ALL_ALLOWED_EVENTS, "Other"]);
const VALID_STATUSES = new Set<string>([
  "upcoming",
  "live",
  "finished",
  "postponed",
  "cancelled",
]);
const VALID_ROUNDS = new Set<string>(["league", "QF", "SF", "3P", "F"]);
const PUSH_ROUNDS = new Set<string>(["SF", "3P", "F"]);
const FINISHED_LOCKED_FIELDS = [
  "status",
  "points_a",
  "points_b",
  "score_a",
  "score_b",
  "result",
  "team_a_id",
  "team_b_id",
  "team_a",
  "team_b",
  "event",
  "round",
] as const;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// 20 Nov 2026 00:00 IST .. 5 Dec 2026 23:59:59 IST (in UTC ms)
const MIN_STARTS_MS = Date.parse("2026-11-19T18:30:00Z");
const MAX_STARTS_MS = Date.parse("2026-12-05T18:30:00Z");

const ROUND_LABELS: Record<string, string> = {
  QF: "Quarter-final",
  SF: "Semi-final",
  "3P": "3rd Place",
  F: "Final",
};

function cleanOptStr(val: unknown, maxLen: number): string | null | undefined {
  if (val === undefined) return undefined;
  if (val === null) return null;
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return undefined;
  return trimmed;
}

function cleanOptUuid(val: unknown): string | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === "") return null;
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (!UUID_REGEX.test(trimmed)) return undefined;
  return trimmed;
}

function cleanOptPoints(val: unknown): number | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === "") return null;
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isInteger(n) || n < 0 || n > 9999) return undefined;
  return n;
}

function validateStartsAt(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const ms = Date.parse(val);
  if (Number.isNaN(ms) || ms < MIN_STARTS_MS || ms > MAX_STARTS_MS) {
    return null;
  }
  return new Date(ms).toISOString();
}

async function resolveTeamNames(
  cfg: SupabaseConfig,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x) => UUID_REGEX.test(x))));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const inClause = unique.map((id) => encodeURIComponent(id)).join(",");
  const res = await supabaseFetch(
    cfg,
    `teams?id=in.(${inClause})&select=id,name`,
  );
  if (!res.ok) {
    await logSupabaseError("GET /api/admin/matches (resolveTeamNames)", res);
    return map;
  }
  const rows = (await res.json()) as Array<{ id: string; name: string }>;
  for (const r of rows) map.set(r.id, r.name);
  return map;
}

async function maybePushMatchEvent(
  context: PagesContext,
  prevStatus: string | null,
  match: Record<string, unknown>,
): Promise<PushOutcome> {
  const status = typeof match.status === "string" ? match.status : "";
  const round = typeof match.round === "string" ? match.round : "league";
  if (!PUSH_ROUNDS.has(round) || status === prevStatus) {
    return "skipped";
  }

  const event = typeof match.event === "string" ? match.event : "UDAAN";
  const roundLabel = ROUND_LABELS[round] || round;
  const teamA = typeof match.team_a === "string" ? match.team_a : "Team A";
  const teamB = typeof match.team_b === "string" ? match.team_b : "Team B";
  const venue = typeof match.venue === "string" ? match.venue : "";
  const result = typeof match.result === "string" ? match.result : "";
  const click = buildLiveClickUrl(context.request.url);

  if (status === "live") {
    const p = publishPush(context.env, {
      title: `${event} ${roundLabel} is LIVE`,
      message: [ `${teamA} vs ${teamB}`, venue ].filter(Boolean).join(" · "),
      priority: 3,
      tags: ["red_circle"],
      click,
    });
    context.waitUntil?.(p);
    return await p;
  }

  if (status === "finished") {
    const p = publishPush(context.env, {
      title: `${event} ${roundLabel} Result`,
      message: result || `${teamA} vs ${teamB} finished`,
      priority: 3,
      tags: ["trophy"],
      click,
    });
    context.waitUntil?.(p);
    return await p;
  }

  return "skipped";
}

function validateCreateRow(
  raw: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Invalid match object." };
  }
  const obj = raw as Record<string, unknown>;

  const event = typeof obj.event === "string" ? obj.event.trim() : "";
  if (!VALID_EVENTS.has(event)) {
    return { ok: false, error: `Invalid event: "${event}".` };
  }

  const venue = typeof obj.venue === "string" ? obj.venue.trim() : "";
  if (!venue || venue.length > 80) {
    return { ok: false, error: "Venue is required (max 80 chars)." };
  }

  const startsAt = validateStartsAt(obj.starts_at);
  if (!startsAt) {
    return {
      ok: false,
      error: "starts_at must be a valid ISO date between 20 Nov and 5 Dec 2026.",
    };
  }

  const status =
    obj.status === undefined
      ? "upcoming"
      : typeof obj.status === "string"
        ? obj.status.trim()
        : "";
  if (!VALID_STATUSES.has(status)) {
    return { ok: false, error: "Invalid match status." };
  }

  const round =
    obj.round === undefined
      ? "league"
      : typeof obj.round === "string"
        ? obj.round.trim()
        : "";
  if (!VALID_ROUNDS.has(round)) {
    return { ok: false, error: "Invalid round (league, QF, SF, 3P, F)." };
  }

  const title = cleanOptStr(obj.title, 80);
  if (obj.title !== undefined && obj.title !== null && title === undefined) {
    return { ok: false, error: "Title must be a string (max 80 chars)." };
  }
  const stage = cleanOptStr(obj.stage, 40);
  if (obj.stage !== undefined && obj.stage !== null && stage === undefined) {
    return { ok: false, error: "Stage must be a string (max 40 chars)." };
  }
  const groupLabel = cleanOptStr(obj.group_label, 20);
  if (
    obj.group_label !== undefined &&
    obj.group_label !== null &&
    groupLabel === undefined
  ) {
    return { ok: false, error: "group_label max length is 20 chars." };
  }
  const teamA = cleanOptStr(obj.team_a, 80);
  if (obj.team_a !== undefined && obj.team_a !== null && teamA === undefined) {
    return { ok: false, error: "team_a must be a string (max 80 chars)." };
  }
  const teamB = cleanOptStr(obj.team_b, 80);
  if (obj.team_b !== undefined && obj.team_b !== null && teamB === undefined) {
    return { ok: false, error: "team_b must be a string (max 80 chars)." };
  }
  const teamAId = cleanOptUuid(obj.team_a_id);
  if (obj.team_a_id !== undefined && obj.team_a_id !== null && teamAId === undefined) {
    return { ok: false, error: "Invalid team_a_id." };
  }
  const teamBId = cleanOptUuid(obj.team_b_id);
  if (obj.team_b_id !== undefined && obj.team_b_id !== null && teamBId === undefined) {
    return { ok: false, error: "Invalid team_b_id." };
  }
  const scoreA = cleanOptStr(obj.score_a, 60);
  if (obj.score_a !== undefined && obj.score_a !== null && scoreA === undefined) {
    return { ok: false, error: "score_a must be a string (max 60 chars)." };
  }
  const scoreB = cleanOptStr(obj.score_b, 60);
  if (obj.score_b !== undefined && obj.score_b !== null && scoreB === undefined) {
    return { ok: false, error: "score_b must be a string (max 60 chars)." };
  }
  const pointsA = cleanOptPoints(obj.points_a);
  if (obj.points_a !== undefined && obj.points_a !== null && pointsA === undefined) {
    return { ok: false, error: "points_a must be a non-negative integer." };
  }
  const pointsB = cleanOptPoints(obj.points_b);
  if (obj.points_b !== undefined && obj.points_b !== null && pointsB === undefined) {
    return { ok: false, error: "points_b must be a non-negative integer." };
  }
  const result = cleanOptStr(obj.result, 160);
  if (obj.result !== undefined && obj.result !== null && result === undefined) {
    return { ok: false, error: "result must be a string (max 160 chars)." };
  }

  const hidden = typeof obj.hidden === "boolean" ? obj.hidden : false;

  return {
    ok: true,
    data: {
      event,
      title: title ?? null,
      stage: stage ?? null,
      group_label: groupLabel ?? null,
      round,
      team_a: teamA ?? null,
      team_b: teamB ?? null,
      team_a_id: teamAId ?? null,
      team_b_id: teamBId ?? null,
      venue,
      starts_at: startsAt,
      status,
      score_a: scoreA ?? null,
      score_b: scoreB ?? null,
      points_a: pointsA ?? null,
      points_b: pointsB ?? null,
      result: result ?? null,
      hidden,
    },
  };
}

function validatePatchRow(
  raw: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Invalid JSON body." };
  }
  const obj = raw as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if ("event" in obj) {
    const ev = typeof obj.event === "string" ? obj.event.trim() : "";
    if (!VALID_EVENTS.has(ev)) return { ok: false, error: "Invalid event." };
    patch.event = ev;
  }
  if ("venue" in obj) {
    const v = typeof obj.venue === "string" ? obj.venue.trim() : "";
    if (!v || v.length > 80) {
      return { ok: false, error: "Venue must be 1..80 chars." };
    }
    patch.venue = v;
  }
  if ("starts_at" in obj) {
    const s = validateStartsAt(obj.starts_at);
    if (!s) {
      return {
        ok: false,
        error: "starts_at must be within 20 Nov – 5 Dec 2026.",
      };
    }
    patch.starts_at = s;
  }
  if ("status" in obj) {
    const st = typeof obj.status === "string" ? obj.status.trim() : "";
    if (!VALID_STATUSES.has(st)) {
      return { ok: false, error: "Invalid match status." };
    }
    patch.status = st;
  }
  if ("round" in obj) {
    const rd = typeof obj.round === "string" ? obj.round.trim() : "";
    if (!VALID_ROUNDS.has(rd)) {
      return { ok: false, error: "Invalid round." };
    }
    patch.round = rd;
  }
  if ("hidden" in obj) {
    if (typeof obj.hidden !== "boolean") {
      return { ok: false, error: "hidden must be boolean." };
    }
    patch.hidden = obj.hidden;
  }

  for (const key of ["team_a_id", "team_b_id"] as const) {
    if (key in obj) {
      const cleaned = cleanOptUuid(obj[key]);
      if (obj[key] !== null && obj[key] !== "" && cleaned === undefined) {
        return { ok: false, error: `Invalid ${key}.` };
      }
      patch[key] = cleaned ?? null;
    }
  }

  for (const key of ["points_a", "points_b"] as const) {
    if (key in obj) {
      const cleaned = cleanOptPoints(obj[key]);
      if (obj[key] !== null && obj[key] !== "" && cleaned === undefined) {
        return { ok: false, error: `${key} must be a non-negative integer.` };
      }
      patch[key] = cleaned ?? null;
    }
  }

  const strFields: Array<[string, number]> = [
    ["title", 80],
    ["stage", 40],
    ["group_label", 20],
    ["team_a", 80],
    ["team_b", 80],
    ["score_a", 60],
    ["score_b", 60],
    ["result", 160],
  ];
  for (const [key, max] of strFields) {
    if (key in obj) {
      const cleaned = cleanOptStr(obj[key], max);
      if (obj[key] !== null && cleaned === undefined) {
        return { ok: false, error: `${key} exceeds ${max} chars or invalid.` };
      }
      patch[key] = cleaned ?? null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No valid fields provided to update." };
  }
  return { ok: true, data: patch };
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const method = request.method;

  if (method !== "POST" && method !== "PATCH" && method !== "DELETE") {
    return adminJsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  const authError = await requireAdminAuth(request, env);
  if (authError) return authError;

  const cfg = getSupabaseConfig(env);
  if (!cfg) {
    return adminJsonResponse(
      { ok: false, error: "Database is not configured on the server." },
      503,
    );
  }

  const url = new URL(request.url);
  const id = (url.searchParams.get("id") || "").trim();
  const action = (url.searchParams.get("action") || "").trim();

  // POST ?id=<uuid>&action=finish -> record_match_result RPC (no draws)
  if (method === "POST" && action === "finish") {
    if (!UUID_REGEX.test(id)) {
      return adminJsonResponse(
        { ok: false, error: "Missing or invalid match id." },
        400,
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return adminJsonResponse({ ok: false, error: "Malformed JSON." }, 400);
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return adminJsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
    }
    const obj = raw as Record<string, unknown>;

    const pointsA = cleanOptPoints(obj.points_a);
    if (obj.points_a !== undefined && obj.points_a !== null && pointsA === undefined) {
      return adminJsonResponse({ ok: false, error: "Invalid points_a." }, 400);
    }
    const pointsB = cleanOptPoints(obj.points_b);
    if (obj.points_b !== undefined && obj.points_b !== null && pointsB === undefined) {
      return adminJsonResponse({ ok: false, error: "Invalid points_b." }, 400);
    }
    const winnerId = cleanOptUuid(obj.winner_id);
    if (obj.winner_id !== undefined && obj.winner_id !== null && winnerId === undefined) {
      return adminJsonResponse({ ok: false, error: "Invalid winner_id." }, 400);
    }
    const resultStr = cleanOptStr(obj.result, 160);
    if (obj.result !== undefined && obj.result !== null && resultStr === undefined) {
      return adminJsonResponse({ ok: false, error: "result max length is 160 chars." }, 400);
    }

    try {
      const existingRes = await supabaseFetch(
        cfg,
        `matches?id=eq.${encodeURIComponent(id)}&select=*`,
      );
      if (!existingRes.ok) {
        await logSupabaseError("POST /api/admin/matches (finish load)", existingRes);
        return adminJsonResponse({ ok: false, error: "Failed to load match." }, 502);
      }
      const existingRows = (await existingRes.json()) as Array<Record<string, unknown>>;
      if (!existingRows.length) {
        return adminJsonResponse({ ok: false, error: "Match not found." }, 404);
      }
      const prev = existingRows[0];
      const teamAId = typeof prev.team_a_id === "string" ? prev.team_a_id : null;
      const teamBId = typeof prev.team_b_id === "string" ? prev.team_b_id : null;

      const pA = pointsA ?? null;
      const pB = pointsB ?? null;
      let resolvedWinner = winnerId ?? null;

      if (pA !== null && pB !== null && pA !== pB) {
        resolvedWinner = pA > pB ? teamAId : teamBId;
      }

      if (
        !resolvedWinner ||
        (resolvedWinner !== teamAId && resolvedWinner !== teamBId)
      ) {
        return adminJsonResponse(
          {
            ok: false,
            error: "A valid winner_id (team_a_id or team_b_id) is required.",
          },
          400,
        );
      }

      const rpcRes = await supabaseFetch(cfg, "rpc/record_match_result", {
        method: "POST",
        body: JSON.stringify({
          p_match_id: id,
          p_points_a: pA,
          p_points_b: pB,
          p_result: resultStr ?? null,
          p_winner_id: resolvedWinner,
        }),
      });
      if (!rpcRes.ok) {
        await logSupabaseError("POST /api/admin/matches (finish rpc)", rpcRes);
        return adminJsonResponse(
          { ok: false, error: "Failed to record match result." },
          502,
        );
      }

      const refreshedRes = await supabaseFetch(
        cfg,
        `matches?id=eq.${encodeURIComponent(id)}&select=*`,
      );
      if (!refreshedRes.ok) {
        await logSupabaseError("POST /api/admin/matches (finish refresh)", refreshedRes);
      }
      const refreshedRows = refreshedRes.ok
        ? ((await refreshedRes.json()) as Array<Record<string, unknown>>)
        : [prev];
      const updated = refreshedRows[0] ?? prev;

      const push = await maybePushMatchEvent(
        context,
        typeof prev.status === "string" ? prev.status : null,
        updated,
      );

      return adminJsonResponse({ ok: true, match: updated, push }, 200);
    } catch {
      return adminJsonResponse(
        { ok: false, error: "Database request failed." },
        502,
      );
    }
  }

  if (method === "POST") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return adminJsonResponse({ ok: false, error: "Malformed JSON." }, 400);
    }

    const items = Array.isArray(body) ? body : [body];
    if (items.length === 0 || items.length > 100) {
      return adminJsonResponse(
        { ok: false, error: "Provide between 1 and 100 matches." },
        400,
      );
    }

    const rows: Record<string, unknown>[] = [];
    const teamIdsToResolve: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const res = validateCreateRow(items[i]);
      if (!res.ok) {
        return adminJsonResponse(
          { ok: false, error: `Row ${i + 1}: ${res.error}` },
          400,
        );
      }
      if (typeof res.data.team_a_id === "string") teamIdsToResolve.push(res.data.team_a_id);
      if (typeof res.data.team_b_id === "string") teamIdsToResolve.push(res.data.team_b_id);
      rows.push(res.data);
    }

    try {
      const nameMap = await resolveTeamNames(cfg, teamIdsToResolve);
      for (const r of rows) {
        if (typeof r.team_a_id === "string" && nameMap.has(r.team_a_id)) {
          r.team_a = nameMap.get(r.team_a_id);
        }
        if (typeof r.team_b_id === "string" && nameMap.has(r.team_b_id)) {
          r.team_b = nameMap.get(r.team_b_id);
        }
      }

      const sbRes = await supabaseFetch(cfg, "matches", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(rows),
      });
      if (!sbRes.ok) {
        await logSupabaseError("POST /api/admin/matches", sbRes);
        return adminJsonResponse(
          { ok: false, error: "Failed to save match(es) to database." },
          502,
        );
      }
      const created = (await sbRes.json()) as unknown[];
      return adminJsonResponse({ ok: true, matches: created }, 201);
    } catch {
      return adminJsonResponse(
        { ok: false, error: "Database request failed." },
        502,
      );
    }
  }

  // PATCH and DELETE require ?id=<uuid>
  if (!UUID_REGEX.test(id)) {
    return adminJsonResponse(
      { ok: false, error: "Missing or invalid match id." },
      400,
    );
  }

  if (method === "PATCH") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return adminJsonResponse({ ok: false, error: "Malformed JSON." }, 400);
    }
    const res = validatePatchRow(body);
    if (!res.ok) {
      return adminJsonResponse({ ok: false, error: res.error }, 400);
    }

    try {
      const prevRes = await supabaseFetch(
        cfg,
        `matches?id=eq.${encodeURIComponent(id)}&select=id,status,round,event,team_a,team_b,team_a_id,team_b_id,venue,result`,
      );
      if (!prevRes.ok) {
        await logSupabaseError("PATCH /api/admin/matches (load)", prevRes);
        return adminJsonResponse(
          { ok: false, error: "Failed to load match." },
          502,
        );
      }
      const prevRows = (await prevRes.json()) as Array<Record<string, unknown>>;
      if (!prevRows.length) {
        return adminJsonResponse(
          { ok: false, error: "Match not found." },
          404,
        );
      }
      const prevRow = prevRows[0];
      const prevStatus =
        typeof prevRow.status === "string" ? prevRow.status : null;

      const hasLockedField = FINISHED_LOCKED_FIELDS.some(
        (field) => field in res.data,
      );
      if (prevStatus === "finished" && hasLockedField) {
        return adminJsonResponse(
          {
            ok: false,
            error:
              "Finished matches cannot be modified via PATCH. Use POST ?id=...&action=finish to update the final result.",
          },
          409,
        );
      }

      const effectiveTeamAId =
        "team_a_id" in res.data
          ? res.data.team_a_id
          : (prevRow?.team_a_id ?? null);
      const effectiveTeamBId =
        "team_b_id" in res.data
          ? res.data.team_b_id
          : (prevRow?.team_b_id ?? null);
      if (
        res.data.status === "finished" &&
        (effectiveTeamAId || effectiveTeamBId)
      ) {
        return adminJsonResponse(
          {
            ok: false,
            error:
              "Matches with linked teams must be finished via POST ?id=...&action=finish so a winner is recorded.",
          },
          400,
        );
      }

      const idsToResolve: string[] = [];
      if (typeof res.data.team_a_id === "string") idsToResolve.push(res.data.team_a_id);
      if (typeof res.data.team_b_id === "string") idsToResolve.push(res.data.team_b_id);
      if (idsToResolve.length > 0) {
        const nameMap = await resolveTeamNames(cfg, idsToResolve);
        if (typeof res.data.team_a_id === "string" && nameMap.has(res.data.team_a_id)) {
          res.data.team_a = nameMap.get(res.data.team_a_id);
        }
        if (typeof res.data.team_b_id === "string" && nameMap.has(res.data.team_b_id)) {
          res.data.team_b = nameMap.get(res.data.team_b_id);
        }
      }

      const patchFilter = hasLockedField
        ? `matches?id=eq.${encodeURIComponent(id)}&status=neq.finished`
        : `matches?id=eq.${encodeURIComponent(id)}`;
      const sbRes = await supabaseFetch(cfg, patchFilter, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(res.data),
      });
      if (!sbRes.ok) {
        await logSupabaseError("PATCH /api/admin/matches", sbRes);
        return adminJsonResponse(
          { ok: false, error: "Failed to update match in database." },
          502,
        );
      }
      const updated = (await sbRes.json()) as Array<Record<string, unknown>>;
      if (!updated.length) {
        if (hasLockedField) {
          return adminJsonResponse(
            {
              ok: false,
              error:
                "Finished matches cannot be modified via PATCH. Use POST ?id=...&action=finish to update the final result.",
            },
            409,
          );
        }
        return adminJsonResponse(
          { ok: false, error: "Match not found." },
          404,
        );
      }

      const push = await maybePushMatchEvent(context, prevStatus, updated[0]);
      return adminJsonResponse({ ok: true, match: updated[0], push }, 200);
    } catch {
      return adminJsonResponse(
        { ok: false, error: "Database request failed." },
        502,
      );
    }
  }

  // DELETE
  try {
    const sbRes = await supabaseFetch(
      cfg,
      `matches?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!sbRes.ok) {
      await logSupabaseError("DELETE /api/admin/matches", sbRes);
      return adminJsonResponse(
        { ok: false, error: "Failed to delete match from database." },
        502,
      );
    }
    return adminJsonResponse({ ok: true, deletedId: id }, 200);
  } catch {
    return adminJsonResponse(
      { ok: false, error: "Database request failed." },
      502,
    );
  }
}
