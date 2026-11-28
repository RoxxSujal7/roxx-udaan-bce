// Cloudflare Pages Function: POST / PATCH / DELETE /api/admin/announcements

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
import {
  buildLiveClickUrl,
  publishPush,
  type NtfyEnv,
  type PushOutcome,
} from "../../../lib/server/ntfy";

interface PagesContext {
  request: Request;
  env: AdminEnv & NtfyEnv;
  waitUntil?: (promise: Promise<unknown>) => void;
}

const VALID_LEVELS = new Set<string>(["info", "important", "urgent"]);
const VALID_EXPIRY_MINUTES = new Set<number>([15, 30, 60, 120]);
const RELATIVE_LINK_REGEX = /^(\/(?!\/)|\.\/|\.\.\/)[A-Za-z0-9_./#?=&-]*$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    let body: Record<string, unknown>;
    try {
      const parsed = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return adminJsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return adminJsonResponse({ ok: false, error: "Malformed JSON." }, 400);
    }

    const message =
      typeof body.message === "string" ? body.message.trim() : "";
    if (message.length < 3 || message.length > 280) {
      return adminJsonResponse(
        { ok: false, error: "Message must be between 3 and 280 characters." },
        400,
      );
    }

    const level =
      body.level === undefined
        ? "info"
        : typeof body.level === "string"
          ? body.level.trim()
          : "";
    if (!VALID_LEVELS.has(level)) {
      return adminJsonResponse(
        { ok: false, error: "Invalid announcement level." },
        400,
      );
    }

    let link: string | null = null;
    if (typeof body.link === "string" && body.link.trim() !== "") {
      const trimmed = body.link.trim();
      if (!RELATIVE_LINK_REGEX.test(trimmed)) {
        return adminJsonResponse(
          {
            ok: false,
            error: "Link must be a relative path starting with /, ./, or ../",
          },
          400,
        );
      }
      link = trimmed;
    }

    let expiresAt: string | null = null;
    if (body.expiresInMinutes !== undefined && body.expiresInMinutes !== null) {
      const mins = Number(body.expiresInMinutes);
      if (!VALID_EXPIRY_MINUTES.has(mins)) {
        return adminJsonResponse(
          { ok: false, error: "expiresInMinutes must be 15, 30, 60, 120, or null." },
          400,
        );
      }
      expiresAt = new Date(Date.now() + mins * 60_000).toISOString();
    }

    try {
      const sbRes = await supabaseFetch(cfg, "announcements", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          message,
          level,
          link,
          active: true,
          expires_at: expiresAt,
        }),
      });
      if (!sbRes.ok) {
        await logSupabaseError("POST /api/admin/announcements", sbRes);
        return adminJsonResponse(
          { ok: false, error: "Failed to create announcement." },
          502,
        );
      }
      const created = (await sbRes.json()) as unknown[];

      let push: PushOutcome = "skipped";
      if (level === "urgent" || level === "important") {
        const pushPromise = publishPush(env, {
          title:
            level === "urgent" ? "UDAAN 2026 · Urgent" : "UDAAN 2026 · Update",
          message,
          priority: level === "urgent" ? 5 : 4,
          tags: level === "urgent" ? ["rotating_light"] : ["loudspeaker"],
          click: buildLiveClickUrl(request.url),
        });
        context.waitUntil?.(pushPromise);
        push = await pushPromise;
      }

      return adminJsonResponse({ ok: true, announcement: created[0], push }, 201);
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
      { ok: false, error: "Missing or invalid announcement id." },
      400,
    );
  }

  if (method === "PATCH") {
    let body: Record<string, unknown>;
    try {
      const parsed = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return adminJsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return adminJsonResponse({ ok: false, error: "Malformed JSON." }, 400);
    }

    const patch: Record<string, unknown> = {};
    if ("active" in body) {
      if (typeof body.active !== "boolean") {
        return adminJsonResponse({ ok: false, error: "active must be boolean." }, 400);
      }
      patch.active = body.active;
    }
    if ("level" in body) {
      const lvl = typeof body.level === "string" ? body.level.trim() : "";
      if (!VALID_LEVELS.has(lvl)) {
        return adminJsonResponse({ ok: false, error: "Invalid level." }, 400);
      }
      patch.level = lvl;
    }
    if ("message" in body) {
      const msg = typeof body.message === "string" ? body.message.trim() : "";
      if (msg.length < 3 || msg.length > 280) {
        return adminJsonResponse(
          { ok: false, error: "Message must be 3..280 characters." },
          400,
        );
      }
      patch.message = msg;
    }
    if ("link" in body) {
      if (body.link === null || body.link === "") {
        patch.link = null;
      } else if (
        typeof body.link === "string" &&
        RELATIVE_LINK_REGEX.test(body.link.trim())
      ) {
        patch.link = body.link.trim();
      } else {
        return adminJsonResponse({ ok: false, error: "Invalid relative link." }, 400);
      }
    }

    if (Object.keys(patch).length === 0) {
      return adminJsonResponse(
        { ok: false, error: "No valid fields provided." },
        400,
      );
    }

    try {
      const sbRes = await supabaseFetch(
        cfg,
        `announcements?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(patch),
        },
      );
      if (!sbRes.ok) {
        await logSupabaseError("PATCH /api/admin/announcements", sbRes);
        return adminJsonResponse(
          { ok: false, error: "Failed to update announcement." },
          502,
        );
      }
      const updated = (await sbRes.json()) as unknown[];
      if (!updated.length) {
        return adminJsonResponse(
          { ok: false, error: "Announcement not found." },
          404,
        );
      }
      return adminJsonResponse({ ok: true, announcement: updated[0] }, 200);
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
      `announcements?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!sbRes.ok) {
      await logSupabaseError("DELETE /api/admin/announcements", sbRes);
      return adminJsonResponse(
        { ok: false, error: "Failed to delete announcement." },
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
