// Shared server-side admin authentication helper for Cloudflare Pages Functions.
// Uses stateless HMAC-SHA256 signed HttpOnly cookies (ADMIN_SESSION_SECRET)
// verified against ADMIN_PASSWORD at POST /api/admin/login.
// Sessions expire after 8 hours; rotating ADMIN_SESSION_SECRET revokes all active sessions.

export interface AdminEnv {
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
}

export const SESSION_COOKIE_NAME = "udaan_admin_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function adminJsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(JSON.stringify(body), { status, headers });
}

/** Constant-time compare via SHA-256 to avoid timing attacks. */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
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

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(b64u: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(b64u)) return null;
  const pad = b64u.length % 4 === 0 ? "" : "=".repeat(4 - (b64u.length % 4));
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/") + pad;
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function signPayload(payloadB64: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  return toBase64Url(new Uint8Array(sig));
}

export async function createSessionToken(
  secret: string,
  nowMs = Date.now(),
): Promise<{ token: string; expiresAt: string }> {
  const payload = {
    iat: nowMs,
    exp: nowMs + SESSION_TTL_MS,
    nonce: crypto.randomUUID(),
  };
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sigB64 = await signPayload(payloadB64, secret);
  return {
    token: `${payloadB64}.${sigB64}`,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export async function verifySessionToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const [payloadB64, sigB64] = parts;
  const expectedSig = await signPayload(payloadB64, secret);
  const sigOk = await constantTimeEqual(sigB64, expectedSig);
  if (!sigOk) return false;

  const decoded = fromBase64Url(payloadB64);
  if (!decoded) return false;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decoded)) as {
      iat?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) {
      return false;
    }
    return nowMs < parsed.exp;
  } catch {
    return false;
  }
}

export function buildSessionCookie(
  token: string,
  requestUrl: string,
  maxAgeSeconds = SESSION_TTL_SECONDS,
): string {
  const isHttps = new URL(requestUrl).protocol === "https:";
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/api/admin",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
    ...(isHttps ? ["Secure"] : []),
  ].join("; ");
}

export function clearSessionCookie(requestUrl: string): string {
  return buildSessionCookie("", requestUrl, 0);
}

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return part.slice(idx + 1).trim();
    }
  }
  return null;
}

/**
 * Strict same-origin check for state-changing admin requests (CSRF defense).
 * Requires Origin (or Referer fallback) to match the request URL's origin.
 */
export function verifySameOrigin(request: Request): boolean {
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }

  const origin = request.headers.get("Origin");
  if (origin !== null) {
    return origin === expectedOrigin;
  }

  const referer = request.headers.get("Referer");
  if (referer !== null) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Verifies server config, same-origin CSRF on mutations, and the HttpOnly signed session cookie.
 * Returns null if authorized, or an error Response (503 / 403 / 401) if not.
 */
export async function requireAdminAuth(
  request: Request,
  env: AdminEnv,
): Promise<Response | null> {
  const adminPassword = env.ADMIN_PASSWORD?.trim();
  const sessionSecret = env.ADMIN_SESSION_SECRET?.trim();
  if (!adminPassword || !sessionSecret) {
    return adminJsonResponse(
      { ok: false, error: "Admin access is not configured." },
      503,
    );
  }

  if (STATE_CHANGING_METHODS.has(request.method.toUpperCase())) {
    if (!verifySameOrigin(request)) {
      return adminJsonResponse(
        { ok: false, error: "Cross-origin state-changing request rejected." },
        403,
      );
    }
  }

  const sessionToken = readCookie(request, SESSION_COOKIE_NAME);
  if (sessionToken && (await verifySessionToken(sessionToken, sessionSecret))) {
    return null;
  }

  return adminJsonResponse({ ok: false, error: "Unauthorized." }, 401);
}
