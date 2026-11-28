// Cloudflare Pages Function: POST /api/admin/login
// Verifies ADMIN_PASSWORD in constant time and issues an HttpOnly, SameSite=Strict signed session cookie.

import {
  adminJsonResponse,
  buildSessionCookie,
  constantTimeEqual,
  createSessionToken,
  getAdminConfig,
  verifySameOrigin,
  type AdminEnv,
} from "../../../lib/server/admin-auth";
import {
  checkLoginLockout,
  clearLoginAttempts,
  extractClientIp,
  hashClientIp,
  recordLoginFailure,
} from "../../../lib/server/login-rate-limit";
import { getSupabaseConfig } from "../../../lib/server/supabase-rest";

interface PagesContext {
  request: Request;
  env: AdminEnv;
}

const MAX_LOGIN_BYTES = 4096;

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  if (request.method !== "POST") {
    return adminJsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  if (!verifySameOrigin(request)) {
    return adminJsonResponse(
      { ok: false, error: "Cross-origin login request rejected." },
      403,
    );
  }

  const cfg = getAdminConfig(env);
  if (!cfg) {
    return adminJsonResponse(
      { ok: false, error: "Admin access is not configured." },
      503,
    );
  }
  const { adminPassword, sessionSecret } = cfg;
  const sbCfg = getSupabaseConfig(env);
  const ipHash = await hashClientIp(extractClientIp(request), sessionSecret);

  const lock = await checkLoginLockout(sbCfg, ipHash);
  if (lock.locked) {
    return adminJsonResponse(
      { ok: false, error: "Too many attempts. Try again later." },
      429,
      { "Retry-After": String(lock.retryAfterSeconds) },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return adminJsonResponse({ ok: false, error: "Malformed request." }, 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_LOGIN_BYTES) {
    return adminJsonResponse({ ok: false, error: "Payload too large." }, 413);
  }

  let password = "";
  try {
    const parsed = JSON.parse(rawBody) as { password?: unknown };
    if (parsed && typeof parsed.password === "string") {
      password = parsed.password.trim();
    }
  } catch {
    return adminJsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const valid = password.length > 0 && (await constantTimeEqual(password, adminPassword));
  if (!valid) {
    await recordLoginFailure(sbCfg, ipHash);
    await new Promise((resolve) => setTimeout(resolve, 600));
    return adminJsonResponse({ ok: false, error: "Unauthorized." }, 401);
  }

  await clearLoginAttempts(sbCfg, ipHash);
  const { token, expiresAt } = await createSessionToken(sessionSecret);
  return adminJsonResponse(
    { ok: true, expiresAt },
    200,
    { "Set-Cookie": buildSessionCookie(token, request.url) },
  );
}
