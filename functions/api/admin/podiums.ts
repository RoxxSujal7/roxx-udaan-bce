// Cloudflare Pages Function: POST / DELETE /api/admin/podiums

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
} from "../../../lib/server/supabase-rest";

interface PagesContext {
  request: Request;
  env: AdminEnv & NtfyEnv;
  waitUntil?: (promise: Promise<unknown>) => void;
}

const VALID_EVENTS = new Set<string>(ALL_ALLOWED_EVENTS);
const VALID_DEPARTMENTS = new Set<string>([
  "CSE",
  "ECE",
  "EE",
  "ME",
  "CE",
  "Other",
]);
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const method = request.method;

  if (method !== "POST" && method !== "DELETE") {
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

    const event = typeof obj.event === "string" ? obj.event.trim() : "";
    if (!VALID_EVENTS.has(event)) {
      return adminJsonResponse({ ok: false, error: `Invalid event: "${event}".` }, 400);
    }

    const place = Number(obj.place);
    if (!Number.isInteger(place) || place < 1 || place > 3) {
      return adminJsonResponse({ ok: false, error: "place must be 1, 2, or 3." }, 400);
    }

    const department =
      typeof obj.department === "string" ? obj.department.trim() : "";
    if (!VALID_DEPARTMENTS.has(department)) {
      return adminJsonResponse({ ok: false, error: "Invalid department." }, 400);
    }

    let teamId: string | null = null;
    if (obj.team_id !== undefined && obj.team_id !== null && obj.team_id !== "") {
      if (typeof obj.team_id !== "string" || !UUID_REGEX.test(obj.team_id.trim())) {
        return adminJsonResponse({ ok: false, error: "Invalid team_id." }, 400);
      }
      teamId = obj.team_id.trim();
    }

    let label: string | null = null;
    if (obj.label !== undefined && obj.label !== null) {
      if (typeof obj.label !== "string" || obj.label.trim().length > 80) {
        return adminJsonResponse({ ok: false, error: "label max length is 80 chars." }, 400);
      }
      label = obj.label.trim() || null;
    }

    try {
      const sbRes = await supabaseFetch(cfg, "podiums", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          event,
          place,
          department,
          team_id: teamId,
          label,
        }),
      });
      if (sbRes.status === 409) {
        await logSupabaseError("POST /api/admin/podiums", sbRes);
        return adminJsonResponse(
          { ok: false, error: "Duplicate podium award for this event, place, and department." },
          409,
        );
      }
      if (!sbRes.ok) {
        await logSupabaseError("POST /api/admin/podiums", sbRes);
        return adminJsonResponse({ ok: false, error: "Failed to save podium award." }, 502);
      }
      const created = (await sbRes.json()) as unknown[];

      let push: PushOutcome = "skipped";
      if (place === 1) {
        const pushPromise = publishPush(env, {
          title: `🥇 ${department} wins ${event}`,
          message: label
            ? `${label} (${department}) takes 1st place in ${event}`
            : `${department} takes 1st place in ${event}`,
          priority: 3,
          tags: ["trophy"],
          click: buildLiveClickUrl(request.url),
        });
        context.waitUntil?.(pushPromise);
        push = await pushPromise;
      }

      return adminJsonResponse({ ok: true, podium: created[0], push }, 201);
    } catch {
      return adminJsonResponse({ ok: false, error: "Database request failed." }, 502);
    }
  }

  // DELETE ?id=<uuid>
  const id = (url.searchParams.get("id") || "").trim();
  if (!UUID_REGEX.test(id)) {
    return adminJsonResponse({ ok: false, error: "Missing or invalid podium id." }, 400);
  }

  try {
    const sbRes = await supabaseFetch(
      cfg,
      `podiums?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!sbRes.ok) {
      await logSupabaseError("DELETE /api/admin/podiums", sbRes);
      return adminJsonResponse({ ok: false, error: "Failed to delete podium award." }, 502);
    }
    return adminJsonResponse({ ok: true, deletedId: id }, 200);
  } catch {
    return adminJsonResponse({ ok: false, error: "Database request failed." }, 502);
  }
}
