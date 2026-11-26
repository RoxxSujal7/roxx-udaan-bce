// Shared server-side admin authentication helper for Cloudflare Pages Functions.

export interface AdminEnv {
  ADMIN_PASSWORD?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
}

export function adminJsonResponse(body: unknown, status: number): Response {
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

/**
 * Verifies the Bearer password in constant time.
 * Returns null if authorized, or an error Response (503 / 401) if not.
 */
export async function requireAdminAuth(
  request: Request,
  env: AdminEnv,
): Promise<Response | null> {
  const adminPassword = env.ADMIN_PASSWORD?.trim();
  if (!adminPassword) {
    return adminJsonResponse(
      { ok: false, error: "Admin access is not configured." },
      503,
    );
  }

  const authHeader = request.headers.get("Authorization") || "";
  const supplied = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  const valid = await constantTimeEqual(supplied, adminPassword);
  if (!valid) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return adminJsonResponse({ ok: false, error: "Invalid password." }, 401);
  }

  return null;
}
