// Cloudflare Pages Function: POST / PATCH / DELETE /api/admin/teams

import { ALL_ALLOWED_EVENTS } from "../../../lib/events";
import {
  adminJsonResponse,
  requireAdminAuth,
  type AdminEnv,
} from "../../../lib/server/admin-auth";
import {
  getSupabaseConfig,
  logSupabaseError,
  supabaseFetch,
} from "../../../lib/server/supabase-rest";

interface PagesContext {
  request: Request;
  env: AdminEnv;
}

const VALID_EVENTS = new Set<string>([...ALL_ALLOWED_EVENTS, "Other"]);
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

function validateTeamRow(
  raw: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Invalid team object." };
  }
  const obj = raw as Record<string, unknown>;

  const event = typeof obj.event === "string" ? obj.event.trim() : "";
  if (!VALID_EVENTS.has(event)) {
    return { ok: false, error: `Invalid event: "${event}".` };
  }

  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (name.length < 1 || name.length > 80) {
    return { ok: false, error: "Team name must be 1..80 characters." };
  }

  const department =
    typeof obj.department === "string" ? obj.department.trim() : "";
  if (!VALID_DEPARTMENTS.has(department)) {
    return {
      ok: false,
      error: `Invalid department: "${department}". Must be CSE, ECE, EE, ME, CE, or Other.`,
    };
  }

  let groupLabel: string | null = null;
  if (obj.group_label !== undefined && obj.group_label !== null) {
    if (typeof obj.group_label !== "string") {
      return { ok: false, error: "group_label must be a string." };
    }
    const trimmed = obj.group_label.trim();
    if (trimmed.length > 20) {
      return { ok: false, error: "group_label max length is 20 chars." };
    }
    groupLabel = trimmed || null;
  }

  return {
    ok: true,
    data: {
      event,
      name,
      department,
      group_label: groupLabel,
    },
  };
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
    if (items.length === 0 || items.length > 200) {
      return adminJsonResponse(
        { ok: false, error: "Provide between 1 and 200 teams." },
        400,
      );
    }

    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < items.length; i++) {
      const res = validateTeamRow(items[i]);
      if (!res.ok) {
        return adminJsonResponse(
          { ok: false, error: `Row ${i + 1}: ${res.error}` },
          400,
        );
      }
      rows.push(res.data);
    }

    try {
      const sbRes = await supabaseFetch(cfg, "teams", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(rows),
      });
      if (!sbRes.ok) {
        await logSupabaseError("POST /api/admin/teams", sbRes);
        return adminJsonResponse(
          { ok: false, error: "Failed to save team(s) (check for duplicate names)." },
          502,
        );
      }
      const created = (await sbRes.json()) as unknown[];
      return adminJsonResponse({ ok: true, teams: created }, 201);
    } catch {
      return adminJsonResponse(
        { ok: false, error: "Database request failed." },
        502,
      );
    }
  }

  const id = (url.searchParams.get("id") || "").trim();
  if (!UUID_REGEX.test(id)) {
    return adminJsonResponse(
      { ok: false, error: "Missing or invalid team id." },
      400,
    );
  }

  if (method === "PATCH") {
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
    const patch: Record<string, unknown> = {};

    if ("event" in obj) {
      const ev = typeof obj.event === "string" ? obj.event.trim() : "";
      if (!VALID_EVENTS.has(ev)) return adminJsonResponse({ ok: false, error: "Invalid event." }, 400);
      patch.event = ev;
    }
    if ("name" in obj) {
      const nm = typeof obj.name === "string" ? obj.name.trim() : "";
      if (nm.length < 1 || nm.length > 80) {
        return adminJsonResponse({ ok: false, error: "Team name must be 1..80 chars." }, 400);
      }
      patch.name = nm;
    }
    if ("department" in obj) {
      const dept = typeof obj.department === "string" ? obj.department.trim() : "";
      if (!VALID_DEPARTMENTS.has(dept)) {
        return adminJsonResponse({ ok: false, error: "Invalid department." }, 400);
      }
      patch.department = dept;
    }
    if ("group_label" in obj) {
      if (obj.group_label === null || obj.group_label === "") {
        patch.group_label = null;
      } else if (typeof obj.group_label === "string" && obj.group_label.trim().length <= 20) {
        patch.group_label = obj.group_label.trim() || null;
      } else {
        return adminJsonResponse({ ok: false, error: "group_label max length is 20 chars." }, 400);
      }
    }

    if (Object.keys(patch).length === 0) {
      return adminJsonResponse({ ok: false, error: "No valid fields provided." }, 400);
    }

    try {
      const sbRes = await supabaseFetch(cfg, "rpc/update_team_and_sync", {
        method: "POST",
        body: JSON.stringify({
          p_team_id: id,
          p_event: "event" in patch ? patch.event : null,
          p_name: "name" in patch ? patch.name : null,
          p_department: "department" in patch ? patch.department : null,
          p_group_label:
            "group_label" in patch && patch.group_label !== null
              ? patch.group_label
              : null,
          p_clear_group: "group_label" in patch && patch.group_label === null,
        }),
      });
      if (!sbRes.ok) {
        await logSupabaseError("PATCH /api/admin/teams", sbRes);
        const errText = await sbRes.text().catch(() => "");
        if (errText.includes("TEAM_HAS_MATCHES")) {
          return adminJsonResponse(
            {
              ok: false,
              error: "Cannot change event for a team that has linked matches.",
            },
            409,
          );
        }
        if (errText.includes("TEAM_NOT_FOUND")) {
          return adminJsonResponse({ ok: false, error: "Team not found." }, 404);
        }
        return adminJsonResponse({ ok: false, error: "Failed to update team." }, 502);
      }
      const updated = (await sbRes.json()) as unknown[];
      if (!updated.length) {
        return adminJsonResponse({ ok: false, error: "Team not found." }, 404);
      }
      return adminJsonResponse({ ok: true, team: updated[0] }, 200);
    } catch {
      return adminJsonResponse({ ok: false, error: "Database request failed." }, 502);
    }
  }

  // DELETE
  try {
    const sbRes = await supabaseFetch(
      cfg,
      `teams?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!sbRes.ok) {
      await logSupabaseError("DELETE /api/admin/teams", sbRes);
      return adminJsonResponse({ ok: false, error: "Failed to delete team." }, 502);
    }
    return adminJsonResponse({ ok: true, deletedId: id }, 200);
  } catch {
    return adminJsonResponse({ ok: false, error: "Database request failed." }, 502);
  }
}
