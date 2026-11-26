// Cloudflare Pages Function: GET /api/admin/registrations
// Password-protected read-only endpoint for the UDAAN 2026 admin dashboard.

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

const MAX_ROWS = 20_000;
const PAGE_SIZE = 1_000;

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const authError = await requireAdminAuth(request, env);
  if (authError) return authError;

  const cfg = getSupabaseConfig(env);
  if (!cfg) {
    return adminJsonResponse(
      { ok: false, error: "Database is not configured on the server." },
      503,
    );
  }

  const columns = [
    "id",
    "submission_id",
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
    "confirmed_details",
    "status",
    "created_at",
  ].join(",");

  const allRows: unknown[] = [];
  let offset = 0;

  try {
    while (allRows.length < MAX_ROWS) {
      const sbResponse = await supabaseFetch(
        cfg,
        `event_registrations?select=${columns}&order=created_at.desc&limit=${PAGE_SIZE}&offset=${offset}`,
      );

      if (!sbResponse.ok) {
        return adminJsonResponse(
          { ok: false, error: "Failed to fetch registrations from database." },
          502,
        );
      }

      const page = (await sbResponse.json()) as unknown[];
      allRows.push(...page);

      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  } catch {
    return adminJsonResponse(
      { ok: false, error: "Database request failed. Please try again." },
      502,
    );
  }

  return adminJsonResponse(
    {
      ok: true,
      registrations: allRows,
      fetchedAt: new Date().toISOString(),
      count: allRows.length,
    },
    200,
  );
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") {
    return onRequestGet(context);
  }
  return adminJsonResponse({ ok: false, error: "Method not allowed." }, 405);
}
