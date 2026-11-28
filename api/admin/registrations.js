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
var STATE_CHANGING_METHODS = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH", "DELETE"]);
function adminJsonResponse(body, status, extraHeaders) {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(JSON.stringify(body), { status, headers });
}
async function constantTimeEqual(a, b) {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b))
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
function toBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(b64u) {
  if (!/^[A-Za-z0-9_-]+$/.test(b64u)) return null;
  const pad = b64u.length % 4 === 0 ? "" : "=".repeat(4 - b64u.length % 4);
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
async function signPayload(payloadB64, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  return toBase64Url(new Uint8Array(sig));
}
async function verifySessionToken(token, secret, nowMs = Date.now()) {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const [payloadB64, sigB64] = parts;
  const expectedSig = await signPayload(payloadB64, secret);
  const sigOk = await constantTimeEqual(sigB64, expectedSig);
  if (!sigOk) return false;
  const decoded = fromBase64Url(payloadB64);
  if (!decoded) return false;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decoded));
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) {
      return false;
    }
    return nowMs < parsed.exp;
  } catch {
    return false;
  }
}
function readCookie(request, name) {
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
function normalizeSecretEnv(raw) {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length >= 2 && (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}
function getAdminConfig(env) {
  const adminPassword = normalizeSecretEnv(env.ADMIN_PASSWORD);
  const sessionSecret = normalizeSecretEnv(env.ADMIN_SESSION_SECRET);
  const missing = [];
  if (!adminPassword) missing.push("ADMIN_PASSWORD");
  if (!sessionSecret) missing.push("ADMIN_SESSION_SECRET");
  if (missing.length > 0) {
    console.error(
      `[admin-auth] 503 Admin access not configured; missing env: ${missing.join(", ")}`
    );
    return null;
  }
  return { adminPassword, sessionSecret };
}
async function requireAdminAuth(request, env) {
  const cfg = getAdminConfig(env);
  if (!cfg) {
    return adminJsonResponse(
      { ok: false, error: "Admin access is not configured." },
      503
    );
  }
  const { sessionSecret } = cfg;
  if (STATE_CHANGING_METHODS.has(request.method.toUpperCase())) {
    if (!verifySameOrigin(request)) {
      return adminJsonResponse(
        { ok: false, error: "Cross-origin state-changing request rejected." },
        403
      );
    }
  }
  const sessionToken = readCookie(request, SESSION_COOKIE_NAME);
  if (sessionToken && await verifySessionToken(sessionToken, sessionSecret)) {
    return null;
  }
  return adminJsonResponse({ ok: false, error: "Unauthorized." }, 401);
}

// lib/server/supabase-rest.ts
function getSupabaseConfig(env) {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) return null;
  return { url, secretKey };
}
function buildSupabaseAuthHeaders(secretKey, extra) {
  const headers = new Headers(extra);
  headers.set("apikey", secretKey);
  if (secretKey.startsWith("sb_secret_")) {
    headers.delete("Authorization");
  } else {
    headers.set("Authorization", `Bearer ${secretKey}`);
  }
  return headers;
}
async function supabaseFetch(cfg, pathAndQuery, init = {}) {
  const headers = buildSupabaseAuthHeaders(cfg.secretKey, init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${cfg.url}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers
  });
}

// functions/api/admin/registrations.ts
var MAX_ROWS = 2e4;
var PAGE_SIZE = 1e3;
async function onRequestGet(context) {
  const { request, env } = context;
  const authError = await requireAdminAuth(request, env);
  if (authError) return authError;
  const cfg = getSupabaseConfig(env);
  if (!cfg) {
    return adminJsonResponse(
      { ok: false, error: "Database is not configured on the server." },
      503
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
    "created_at"
  ].join(",");
  const allRows = [];
  let offset = 0;
  try {
    while (allRows.length < MAX_ROWS) {
      const sbResponse = await supabaseFetch(
        cfg,
        `event_registrations?select=${columns}&order=created_at.desc&limit=${PAGE_SIZE}&offset=${offset}`
      );
      if (!sbResponse.ok) {
        return adminJsonResponse(
          { ok: false, error: "Failed to fetch registrations from database." },
          502
        );
      }
      const page = await sbResponse.json();
      allRows.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  } catch {
    return adminJsonResponse(
      { ok: false, error: "Database request failed. Please try again." },
      502
    );
  }
  return adminJsonResponse(
    {
      ok: true,
      registrations: allRows,
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      count: allRows.length
    },
    200
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
var vercel_entry_default = toVercelHandler(onRequestGet);
