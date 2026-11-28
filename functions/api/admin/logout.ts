// Cloudflare Pages Function: POST /api/admin/logout
// Clears the HttpOnly admin session cookie.

import {
  adminJsonResponse,
  clearSessionCookie,
  verifySameOrigin,
} from "../../../lib/server/admin-auth";

interface PagesContext {
  request: Request;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request } = context;

  if (request.method !== "POST") {
    return adminJsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  if (!verifySameOrigin(request)) {
    return adminJsonResponse(
      { ok: false, error: "Cross-origin logout request rejected." },
      403,
    );
  }

  return adminJsonResponse(
    { ok: true },
    200,
    { "Set-Cookie": clearSessionCookie(request.url) },
  );
}
