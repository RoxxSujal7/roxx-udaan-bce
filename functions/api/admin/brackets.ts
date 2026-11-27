// Cloudflare Pages Function: PUT / DELETE /api/admin/brackets

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
const MAX_BRACKET_BYTES = 200 * 1024;
const REQUIRED_KEYS = [
  "stage",
  "group",
  "round",
  "match",
  "match_game",
  "participant",
] as const;

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const method = request.method;

  if (method !== "PUT" && method !== "DELETE") {
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
  const event = (url.searchParams.get("event") || "").trim();
  if (!VALID_EVENTS.has(event)) {
    return adminJsonResponse(
      { ok: false, error: `Missing or invalid event: "${event}".` },
      400,
    );
  }

  if (method === "PUT") {
    let rawText: string;
    try {
      rawText = await request.text();
    } catch {
      return adminJsonResponse({ ok: false, error: "Failed to read body." }, 400);
    }
    if (new TextEncoder().encode(rawText).byteLength > MAX_BRACKET_BYTES) {
      return adminJsonResponse(
        { ok: false, error: "Bracket payload exceeds 200 KB limit." },
        400,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return adminJsonResponse({ ok: false, error: "Malformed JSON." }, 400);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return adminJsonResponse({ ok: false, error: "Invalid bracket object." }, 400);
    }

    const obj = parsed as Record<string, unknown>;
    for (const k of REQUIRED_KEYS) {
      if (!Array.isArray(obj[k])) {
        return adminJsonResponse(
          { ok: false, error: `Bracket data must include array "${k}".` },
          400,
        );
      }
    }

    try {
      const sbRes = await supabaseFetch(cfg, "brackets", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          event,
          data: obj,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!sbRes.ok) {
        return adminJsonResponse(
          { ok: false, error: "Failed to save bracket." },
          502,
        );
      }
      const saved = (await sbRes.json()) as unknown[];
      return adminJsonResponse({ ok: true, bracket: saved[0] }, 200);
    } catch {
      return adminJsonResponse(
        { ok: false, error: "Database request failed." },
        502,
      );
    }
  }

  // DELETE ?event=<event>
  try {
    const sbRes = await supabaseFetch(
      cfg,
      `brackets?event=eq.${encodeURIComponent(event)}`,
      { method: "DELETE" },
    );
    if (!sbRes.ok) {
      return adminJsonResponse(
        { ok: false, error: "Failed to delete bracket." },
        502,
      );
    }
    return adminJsonResponse({ ok: true, deletedEvent: event }, 200);
  } catch {
    return adminJsonResponse(
      { ok: false, error: "Database request failed." },
      502,
    );
  }
}
