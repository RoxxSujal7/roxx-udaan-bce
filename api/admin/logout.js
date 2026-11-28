var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// vercel-entry.ts
var vercel_entry_exports = {};
__export(vercel_entry_exports, {
  default: () => vercel_entry_default
});
module.exports = __toCommonJS(vercel_entry_exports);

// lib/server/admin-auth.ts
var SESSION_COOKIE_NAME = "udaan_admin_session";
var SESSION_TTL_SECONDS = 8 * 60 * 60;
var SESSION_TTL_MS = SESSION_TTL_SECONDS * 1e3;
function adminJsonResponse(body, status, extraHeaders) {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(JSON.stringify(body), { status, headers });
}
function buildSessionCookie(token, requestUrl, maxAgeSeconds = SESSION_TTL_SECONDS) {
  const isHttps = new URL(requestUrl).protocol === "https:";
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/api/admin",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
    ...isHttps ? ["Secure"] : []
  ].join("; ");
}
function clearSessionCookie(requestUrl) {
  return buildSessionCookie("", requestUrl, 0);
}
function verifySameOrigin(request) {
  let expectedOrigin;
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

// functions/api/admin/logout.ts
async function onRequest(context) {
  const { request } = context;
  if (request.method !== "POST") {
    return adminJsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }
  if (!verifySameOrigin(request)) {
    return adminJsonResponse(
      { ok: false, error: "Cross-origin logout request rejected." },
      403
    );
  }
  return adminJsonResponse(
    { ok: true },
    200,
    { "Set-Cookie": clearSessionCookie(request.url) }
  );
}

// lib/server/vercel-adapter.ts
function getVercelEnv() {
  const proc = globalThis.process;
  const e = proc?.env ?? {};
  return {
    ADMIN_PASSWORD: e.ADMIN_PASSWORD,
    ADMIN_SESSION_SECRET: e.ADMIN_SESSION_SECRET,
    SUPABASE_URL: e.SUPABASE_URL,
    SUPABASE_SECRET_KEY: e.SUPABASE_SECRET_KEY,
    NTFY_ENABLED: e.NTFY_ENABLED,
    NTFY_TOPIC: e.NTFY_TOPIC,
    NTFY_TOKEN: e.NTFY_TOKEN,
    NTFY_SERVER: e.NTFY_SERVER
  };
}
async function nodeReqToWebRequest(req) {
  const host = (Array.isArray(req.headers["x-forwarded-host"]) ? req.headers["x-forwarded-host"][0] : req.headers["x-forwarded-host"]) || (Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host) || "localhost";
  const proto = (Array.isArray(req.headers["x-forwarded-proto"]) ? req.headers["x-forwarded-proto"][0] : req.headers["x-forwarded-proto"]) || "https";
  const reqPath = req.url || "/";
  const fullUrl = reqPath.startsWith("http") ? reqPath : `${proto}://${host}${reqPath}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === void 0) continue;
    if (Array.isArray(v)) {
      for (const item of v) headers.append(k, item);
    } else {
      headers.set(k, v);
    }
  }
  const method = (req.method || "GET").toUpperCase();
  let body;
  if (method !== "GET" && method !== "HEAD") {
    if (req.rawBody !== void 0) {
      body = typeof req.rawBody === "string" ? req.rawBody : Uint8Array.from(req.rawBody);
    } else if (req.readableEnded && req.body !== void 0) {
      body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    } else {
      const chunks = [];
      let total = 0;
      for await (const chunk of req) {
        const buf = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
        chunks.push(buf);
        total += buf.byteLength;
      }
      if (total > 0) {
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }
        body = merged;
      }
    }
  }
  return new Request(fullUrl, { method, headers, body });
}
async function sendWebResponse(webRes, res) {
  res.statusCode = webRes.status;
  const setCookies = typeof webRes.headers.getSetCookie === "function" ? webRes.headers.getSetCookie() : [];
  webRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie" && setCookies.length > 0) return;
    res.setHeader(key, value);
  });
  if (setCookies.length > 0) {
    res.setHeader("set-cookie", setCookies);
  }
  const buf = new Uint8Array(await webRes.arrayBuffer());
  res.end(buf);
}
function toVercelHandler(fn) {
  return async (req, res) => {
    const request = await nodeReqToWebRequest(req);
    const webRes = await fn({ request, env: getVercelEnv() });
    await sendWebResponse(webRes, res);
  };
}

// vercel-entry.ts
var vercel_entry_default = toVercelHandler(onRequest);
