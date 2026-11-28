// Server-side rate limiting / lockout helper for POST /api/admin/login.
// Stores only salted SHA-256 hashes of client IPs in Supabase; fails open on DB outage.

import {
  logSupabaseError,
  supabaseFetch,
  type SupabaseConfig,
} from "./supabase-rest";

export function extractClientIp(request: Request): string {
  const cfIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (cfIp) return cfIp;

  const xff = request.headers.get("X-Forwarded-For");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("X-Real-IP")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export async function hashClientIp(
  ip: string,
  sessionSecret: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(`${ip}:${sessionSecret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function checkLoginLockout(
  cfg: SupabaseConfig | null,
  ipHash: string,
  nowMs = Date.now(),
): Promise<{ locked: false } | { locked: true; retryAfterSeconds: number }> {
  if (!cfg) return { locked: false };
  try {
    const res = await supabaseFetch(
      cfg,
      `admin_login_attempts?ip_hash=eq.${encodeURIComponent(ipHash)}&select=locked_until`,
    );
    if (!res.ok) {
      await logSupabaseError("POST /api/admin/login (rate-limit check)", res);
      return { locked: false };
    }
    const rows = (await res.json()) as Array<{ locked_until?: string | null }>;
    const lockedUntil = rows[0]?.locked_until;
    if (!lockedUntil) return { locked: false };

    const lockedMs = Date.parse(lockedUntil);
    if (Number.isFinite(lockedMs) && lockedMs > nowMs) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((lockedMs - nowMs) / 1000),
      );
      return { locked: true, retryAfterSeconds };
    }
    return { locked: false };
  } catch {
    console.error(
      "[supabase]",
      "POST /api/admin/login (rate-limit check)",
      "network-error",
    );
    return { locked: false };
  }
}

export async function recordLoginFailure(
  cfg: SupabaseConfig | null,
  ipHash: string,
): Promise<void> {
  if (!cfg) return;
  try {
    const res = await supabaseFetch(cfg, "rpc/record_admin_login_failure", {
      method: "POST",
      body: JSON.stringify({ p_ip_hash: ipHash }),
    });
    if (!res.ok) {
      await logSupabaseError("POST /api/admin/login (rate-limit record)", res);
    }
  } catch {
    console.error(
      "[supabase]",
      "POST /api/admin/login (rate-limit record)",
      "network-error",
    );
  }
}

export async function clearLoginAttempts(
  cfg: SupabaseConfig | null,
  ipHash: string,
): Promise<void> {
  if (!cfg) return;
  try {
    const res = await supabaseFetch(
      cfg,
      `admin_login_attempts?ip_hash=eq.${encodeURIComponent(ipHash)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      await logSupabaseError("POST /api/admin/login (rate-limit clear)", res);
    }
  } catch {
    console.error(
      "[supabase]",
      "POST /api/admin/login (rate-limit clear)",
      "network-error",
    );
  }
}
