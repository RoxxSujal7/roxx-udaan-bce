// Cloudflare Pages Function: GET /api/admin/registrations
// Password-protected read-only endpoint for the UDAAN 2026 admin dashboard.

export interface AdminEnv {
  ADMIN_PASSWORD?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
}

interface PagesContext {
  request: Request;
  env: AdminEnv;
}

const MAX_ROWS = 20_000;
const PAGE_SIZE = 1_000;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

/** Constant-time compare via SHA-256 to avoid timing attacks. */
async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const aBytes = new Uint8Array(hashA);
  const bBytes = new Uint8Array(hashB);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  // 1. Check ADMIN_PASSWORD is configured.
  const adminPassword = env.ADMIN_PASSWORD?.trim();
  if (!adminPassword) {
    return jsonResponse(
      { ok: false, error: "Admin access is not configured." },
      503,
    );
  }

  // 2. Verify Authorization header in constant time.
  const authHeader = request.headers.get("Authorization") || "";
  const supplied = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  const valid = await constantTimeEqual(supplied, adminPassword);
  if (!valid) {
    // Delay ~600 ms to slow brute-force attempts.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return jsonResponse({ ok: false, error: "Invalid password." }, 401);
  }

  // 3. Check Supabase credentials.
  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !supabaseSecretKey) {
    return jsonResponse(
      { ok: false, error: "Database is not configured on the server." },
      503,
    );
  }

  // 4. Paginate through Supabase until all rows fetched (capped at MAX_ROWS).
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
      const url = `${supabaseUrl}/rest/v1/event_registrations?select=${columns}&order=created_at.desc&limit=${PAGE_SIZE}&offset=${offset}`;
      const sbResponse = await fetch(url, {
        headers: {
          apikey: supabaseSecretKey,
          Authorization: `Bearer ${supabaseSecretKey}`,
        },
      });

      if (!sbResponse.ok) {
        // Do not echo upstream error body — it may contain internal detail.
        return jsonResponse(
          { ok: false, error: "Failed to fetch registrations from database." },
          502,
        );
      }

      const page = (await sbResponse.json()) as unknown[];
      allRows.push(...page);

      if (page.length < PAGE_SIZE) break; // Last page reached.
      offset += PAGE_SIZE;
    }
  } catch {
    return jsonResponse(
      { ok: false, error: "Database request failed. Please try again." },
      502,
    );
  }

  return jsonResponse(
    {
      ok: true,
      registrations: allRows,
      fetchedAt: new Date().toISOString(),
      count: allRows.length,
    },
    200,
  );
}

// Strictly read-only: reject all other methods.
export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") {
    return onRequestGet(context);
  }
  return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
}
