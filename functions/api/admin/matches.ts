// Cloudflare Pages Function: POST / PATCH / DELETE /api/admin/matches

import { ALL_ALLOWED_EVENTS } from "../../../lib/events";
import {
  adminJsonResponse,
  requireAdminAuth,
  type AdminEnv,
} from "../../../lib/server/admin-auth";
import {
  getSupabaseConfig,
  supabaseFetch,
} from "../../../lib/server/supabase-rest";

interface PagesContext {
  request: Request;
  env: AdminEnv;
}

const VALID_EVENTS = new Set<string>([...ALL_ALLOWED_EVENTS, "Other"]);
const VALID_STATUSES = new Set<string>([
  "upcoming",
  "live",
  "finished",
  "postponed",
  "cancelled",
]);
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// 20 Nov 2026 00:00 IST .. 5 Dec 2026 23:59:59 IST (in UTC ms)
const MIN_STARTS_MS = Date.parse("2026-11-19T18:30:00Z");
const MAX_STARTS_MS = Date.parse("2026-12-05T18:30:00Z");

function cleanOptStr(val: unknown, maxLen: number): string | null | undefined {
  if (val === undefined) return undefined;
  if (val === null) return null;
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return undefined;
  return trimmed;
}

function validateStartsAt(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const ms = Date.parse(val);
  if (Number.isNaN(ms) || ms < MIN_STARTS_MS || ms > MAX_STARTS_MS) {
    return null;
  }
  return new Date(ms).toISOString();
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

  const title = cleanOptStr(obj.title, 80);
  if (obj.title !== undefined && obj.title !== null && title === undefined) {
    return { ok: false, error: "Title must be a string (max 80 chars)." };
  }
  const stage = cleanOptStr(obj.stage, 40);
  if (obj.stage !== undefined && obj.stage !== null && stage === undefined) {
    return { ok: false, error: "Stage must be a string (max 40 chars)." };
  }
  const teamA = cleanOptStr(obj.team_a, 80);
  if (obj.team_a !== undefined && obj.team_a !== null && teamA === undefined) {
    return { ok: false, error: "team_a must be a string (max 80 chars)." };
  }
  const teamB = cleanOptStr(obj.team_b, 80);
  if (obj.team_b !== undefined && obj.team_b !== null && teamB === undefined) {
    return { ok: false, error: "team_b must be a string (max 80 chars)." };
  }
  const scoreA = cleanOptStr(obj.score_a, 60);
  if (
    obj.score_a !== undefined &&
    obj.score_a !== null &&
    scoreA === undefined
  ) {
    return { ok: false, error: "score_a must be a string (max 60 chars)." };
  }
  const scoreB = cleanOptStr(obj.score_b, 60);
  if (
    obj.score_b !== undefined &&
    obj.score_b !== null &&
    scoreB === undefined
  ) {
    return { ok: false, error: "score_b must be a string (max 60 chars)." };
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
      team_a: teamA ?? null,
      team_b: teamB ?? null,
      venue,
      starts_at: startsAt,
      status,
      score_a: scoreA ?? null,
      score_b: scoreB ?? null,
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
  if ("hidden" in obj) {
    if (typeof obj.hidden !== "boolean") {
      return { ok: false, error: "hidden must be boolean." };
    }
    patch.hidden = obj.hidden;
  }

  const strFields: Array<[string, number]> = [
    ["title", 80],
    ["stage", 40],
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
    for (let i = 0; i < items.length; i++) {
      const res = validateCreateRow(items[i]);
      if (!res.ok) {
        return adminJsonResponse(
          { ok: false, error: `Row ${i + 1}: ${res.error}` },
          400,
        );
      }
      rows.push(res.data);
    }

    try {
      const sbRes = await supabaseFetch(cfg, "matches", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(rows),
      });
      if (!sbRes.ok) {
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
  const id = (url.searchParams.get("id") || "").trim();
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
      const sbRes = await supabaseFetch(
        cfg,
        `matches?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(res.data),
        },
      );
      if (!sbRes.ok) {
        return adminJsonResponse(
          { ok: false, error: "Failed to update match in database." },
          502,
        );
      }
      const updated = (await sbRes.json()) as unknown[];
      if (!updated.length) {
        return adminJsonResponse(
          { ok: false, error: "Match not found." },
          404,
        );
      }
      return adminJsonResponse({ ok: true, match: updated[0] }, 200);
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
