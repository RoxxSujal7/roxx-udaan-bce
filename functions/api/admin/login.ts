// Cloudflare Pages Function: POST /api/admin/login
// Verifies ADMIN_PASSWORD in constant time and issues an HttpOnly, SameSite=Strict signed session cookie.

import {
  adminJsonResponse,
  buildSessionCookie,
  constantTimeEqual,
  createSessionToken,
  verifySameOrigin,
  type AdminEnv,
} from "../../../lib/server/admin-auth";

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

  const adminPassword = env.ADMIN_PASSWORD?.trim();
  const sessionSecret = env.ADMIN_SESSION_SECRET?.trim();
  if (!adminPassword || !sessionSecret) {
    return adminJsonResponse(
      { ok: false, error: "Admin access is not configured." },
      503,
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
    await new Promise((resolve) => setTimeout(resolve, 600));
    return adminJsonResponse({ ok: false, error: "Unauthorized." }, 401);
  }

  const { token, expiresAt } = await createSessionToken(sessionSecret);
  return adminJsonResponse(
    { ok: true, expiresAt },
    200,
    { "Set-Cookie": buildSessionCookie(token, request.url) },
  );
}
