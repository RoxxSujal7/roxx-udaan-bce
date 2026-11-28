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

// lib/events.ts
var UDAAN_SPORTS_AND_CULTURAL_EVENTS = [
  "Cricket",
  "Football",
  "Badminton",
  "Table Tennis",
  "Volleyball",
  "Athletics",
  "Board Games",
  "Javelin",
  "Kabaddi",
  "Tug of War",
  "Literary",
  "Cultural"
];
var IGNITION_ESPORTS_EVENTS = [
  "BGMI",
  "Free Fire",
  "Valorant"
];
var ALL_ALLOWED_EVENTS = [
  ...UDAAN_SPORTS_AND_CULTURAL_EVENTS,
  ...IGNITION_ESPORTS_EVENTS
];
var IGNITION_SET = new Set(IGNITION_ESPORTS_EVENTS);

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

// lib/server/ntfy.ts
var TIMEOUT_MS = 4e3;
var MAX_TITLE_LEN = 80;
var MAX_MESSAGE_LEN = 280;
function buildLiveClickUrl(requestUrl) {
  try {
    const origin = new URL(requestUrl).origin;
    return `${origin}/Templates/live`;
  } catch {
    return "https://roxx-udaan-bce.pages.dev/Templates/live";
  }
}
async function publishPush(env, payload) {
  if (env.NTFY_ENABLED?.trim() !== "true") {
    return "skipped";
  }
  const topic = env.NTFY_TOPIC?.trim();
  if (!topic) {
    return "skipped";
  }
  const server = (env.NTFY_SERVER?.trim() || "https://ntfy.sh").replace(
    /\/+$/,
    ""
  );
  const token = env.NTFY_TOKEN?.trim();
  const headers = {
    "Content-Type": "application/json; charset=utf-8"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const body = JSON.stringify({
    topic,
    title: payload.title.trim().slice(0, MAX_TITLE_LEN),
    message: payload.message.trim().slice(0, MAX_MESSAGE_LEN),
    priority: payload.priority,
    tags: payload.tags ?? [],
    click: payload.click
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${server}/`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal
    });
    console.log("ntfy push status:", res.status);
    return res.ok ? "sent" : "failed";
  } catch {
    console.log("ntfy push status: error");
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

// lib/server/supabase-rest.ts
function getSupabaseConfig(env) {
  const rawUrl = normalizeSecretEnv(env.SUPABASE_URL);
  const url = rawUrl.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "").replace(/\/+$/, "");
  const secretKey = normalizeSecretEnv(env.SUPABASE_SECRET_KEY);
  if (!url || !secretKey) return null;
  return { url, secretKey };
}
async function logSupabaseError(route, response) {
  const body = (await response.clone().text().catch(() => "")).slice(0, 300);
  console.error("[supabase]", route, response.status, body);
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

// functions/api/admin/podiums.ts
var VALID_EVENTS = new Set(ALL_ALLOWED_EVENTS);
var VALID_DEPARTMENTS = /* @__PURE__ */ new Set([
  "CSE",
  "ECE",
  "EE",
  "ME",
  "CE",
  "Other"
]);
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  if (method !== "POST" && method !== "DELETE") {
    return adminJsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }
  const authError = await requireAdminAuth(request, env);
  if (authError) return authError;
  const cfg = getSupabaseConfig(env);
  if (!cfg) {
    return adminJsonResponse(
      { ok: false, error: "Database is not configured on the server." },
      503
    );
  }
  const url = new URL(request.url);
  if (method === "POST") {
    let raw;
    try {
      raw = await request.json();
    } catch {
      return adminJsonResponse({ ok: false, error: "Malformed JSON." }, 400);
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return adminJsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
    }
    const obj = raw;
    const event = typeof obj.event === "string" ? obj.event.trim() : "";
    if (!VALID_EVENTS.has(event)) {
      return adminJsonResponse({ ok: false, error: `Invalid event: "${event}".` }, 400);
    }
    const place = Number(obj.place);
    if (!Number.isInteger(place) || place < 1 || place > 3) {
      return adminJsonResponse({ ok: false, error: "place must be 1, 2, or 3." }, 400);
    }
    const department = typeof obj.department === "string" ? obj.department.trim() : "";
    if (!VALID_DEPARTMENTS.has(department)) {
      return adminJsonResponse({ ok: false, error: "Invalid department." }, 400);
    }
    let teamId = null;
    if (obj.team_id !== void 0 && obj.team_id !== null && obj.team_id !== "") {
      if (typeof obj.team_id !== "string" || !UUID_REGEX.test(obj.team_id.trim())) {
        return adminJsonResponse({ ok: false, error: "Invalid team_id." }, 400);
      }
      teamId = obj.team_id.trim();
    }
    let label = null;
    if (obj.label !== void 0 && obj.label !== null) {
      if (typeof obj.label !== "string" || obj.label.trim().length > 80) {
        return adminJsonResponse({ ok: false, error: "label max length is 80 chars." }, 400);
      }
      label = obj.label.trim() || null;
    }
    try {
      const sbRes = await supabaseFetch(cfg, "podiums", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          event,
          place,
          department,
          team_id: teamId,
          label
        })
      });
      if (sbRes.status === 409) {
        await logSupabaseError("POST /api/admin/podiums", sbRes);
        return adminJsonResponse(
          { ok: false, error: "Duplicate podium award for this event, place, and department." },
          409
        );
      }
      if (!sbRes.ok) {
        await logSupabaseError("POST /api/admin/podiums", sbRes);
        return adminJsonResponse({ ok: false, error: "Failed to save podium award." }, 502);
      }
      const created = await sbRes.json();
      let push = "skipped";
      if (place === 1) {
        const pushPromise = publishPush(env, {
          title: `\u{1F947} ${department} wins ${event}`,
          message: label ? `${label} (${department}) takes 1st place in ${event}` : `${department} takes 1st place in ${event}`,
          priority: 3,
          tags: ["trophy"],
          click: buildLiveClickUrl(request.url)
        });
        context.waitUntil?.(pushPromise);
        push = await pushPromise;
      }
      return adminJsonResponse({ ok: true, podium: created[0], push }, 201);
    } catch {
      return adminJsonResponse({ ok: false, error: "Database request failed." }, 502);
    }
  }
  const id = (url.searchParams.get("id") || "").trim();
  if (!UUID_REGEX.test(id)) {
    return adminJsonResponse({ ok: false, error: "Missing or invalid podium id." }, 400);
  }
  try {
    const sbRes = await supabaseFetch(
      cfg,
      `podiums?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (!sbRes.ok) {
      await logSupabaseError("DELETE /api/admin/podiums", sbRes);
      return adminJsonResponse({ ok: false, error: "Failed to delete podium award." }, 502);
    }
    return adminJsonResponse({ ok: true, deletedId: id }, 200);
  } catch {
    return adminJsonResponse({ ok: false, error: "Database request failed." }, 502);
  }
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
