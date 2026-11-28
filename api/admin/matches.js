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
async function requireAdminAuth(request, env) {
  const adminPassword = env.ADMIN_PASSWORD?.trim();
  const sessionSecret = env.ADMIN_SESSION_SECRET?.trim();
  if (!adminPassword || !sessionSecret) {
    return adminJsonResponse(
      { ok: false, error: "Admin access is not configured." },
      503
    );
  }
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

// functions/api/admin/matches.ts
var VALID_EVENTS = /* @__PURE__ */ new Set([...ALL_ALLOWED_EVENTS, "Other"]);
var VALID_STATUSES = /* @__PURE__ */ new Set([
  "upcoming",
  "live",
  "finished",
  "postponed",
  "cancelled"
]);
var VALID_ROUNDS = /* @__PURE__ */ new Set(["league", "QF", "SF", "3P", "F"]);
var PUSH_ROUNDS = /* @__PURE__ */ new Set(["SF", "3P", "F"]);
var FINISHED_LOCKED_FIELDS = [
  "status",
  "points_a",
  "points_b",
  "score_a",
  "score_b",
  "result",
  "team_a_id",
  "team_b_id",
  "team_a",
  "team_b",
  "event",
  "round"
];
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var MIN_STARTS_MS = Date.parse("2026-11-19T18:30:00Z");
var MAX_STARTS_MS = Date.parse("2026-12-05T18:30:00Z");
var ROUND_LABELS = {
  QF: "Quarter-final",
  SF: "Semi-final",
  "3P": "3rd Place",
  F: "Final"
};
function cleanOptStr(val, maxLen) {
  if (val === void 0) return void 0;
  if (val === null) return null;
  if (typeof val !== "string") return void 0;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return void 0;
  return trimmed;
}
function cleanOptUuid(val) {
  if (val === void 0) return void 0;
  if (val === null || val === "") return null;
  if (typeof val !== "string") return void 0;
  const trimmed = val.trim();
  if (!UUID_REGEX.test(trimmed)) return void 0;
  return trimmed;
}
function cleanOptPoints(val) {
  if (val === void 0) return void 0;
  if (val === null || val === "") return null;
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isInteger(n) || n < 0 || n > 9999) return void 0;
  return n;
}
function validateStartsAt(val) {
  if (typeof val !== "string") return null;
  const ms = Date.parse(val);
  if (Number.isNaN(ms) || ms < MIN_STARTS_MS || ms > MAX_STARTS_MS) {
    return null;
  }
  return new Date(ms).toISOString();
}
async function resolveTeamNames(cfg, ids) {
  const unique = Array.from(new Set(ids.filter((x) => UUID_REGEX.test(x))));
  const map = /* @__PURE__ */ new Map();
  if (unique.length === 0) return map;
  const inClause = unique.map((id) => encodeURIComponent(id)).join(",");
  const res = await supabaseFetch(
    cfg,
    `teams?id=in.(${inClause})&select=id,name`
  );
  if (!res.ok) return map;
  const rows = await res.json();
  for (const r of rows) map.set(r.id, r.name);
  return map;
}
async function maybePushMatchEvent(context, prevStatus, match) {
  const status = typeof match.status === "string" ? match.status : "";
  const round = typeof match.round === "string" ? match.round : "league";
  if (!PUSH_ROUNDS.has(round) || status === prevStatus) {
    return "skipped";
  }
  const event = typeof match.event === "string" ? match.event : "UDAAN";
  const roundLabel = ROUND_LABELS[round] || round;
  const teamA = typeof match.team_a === "string" ? match.team_a : "Team A";
  const teamB = typeof match.team_b === "string" ? match.team_b : "Team B";
  const venue = typeof match.venue === "string" ? match.venue : "";
  const result = typeof match.result === "string" ? match.result : "";
  const click = buildLiveClickUrl(context.request.url);
  if (status === "live") {
    const p = publishPush(context.env, {
      title: `${event} ${roundLabel} is LIVE`,
      message: [`${teamA} vs ${teamB}`, venue].filter(Boolean).join(" \xB7 "),
      priority: 3,
      tags: ["red_circle"],
      click
    });
    context.waitUntil?.(p);
    return await p;
  }
  if (status === "finished") {
    const p = publishPush(context.env, {
      title: `${event} ${roundLabel} Result`,
      message: result || `${teamA} vs ${teamB} finished`,
      priority: 3,
      tags: ["trophy"],
      click
    });
    context.waitUntil?.(p);
    return await p;
  }
  return "skipped";
}
function validateCreateRow(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Invalid match object." };
  }
  const obj = raw;
  const event = typeof obj.event === "string" ? obj.event.trim() : "";
  if (!VALID_EVENTS.has(event)) {
    return { ok: false, error: `Invalid event: "${event}".` };
  }
  const venue = typeof obj.venue === "string" ? obj.venue.trim() : "";
  if (!venue || venue.length > 80) {
    return { ok: false, error: "Venue is required (max 80 chars)." };
  }
  const startsAt = validateStartsAt(obj.starts_at);
  if (!startsAt) {
    return {
      ok: false,
      error: "starts_at must be a valid ISO date between 20 Nov and 5 Dec 2026."
    };
  }
  const status = obj.status === void 0 ? "upcoming" : typeof obj.status === "string" ? obj.status.trim() : "";
  if (!VALID_STATUSES.has(status)) {
    return { ok: false, error: "Invalid match status." };
  }
  const round = obj.round === void 0 ? "league" : typeof obj.round === "string" ? obj.round.trim() : "";
  if (!VALID_ROUNDS.has(round)) {
    return { ok: false, error: "Invalid round (league, QF, SF, 3P, F)." };
  }
  const title = cleanOptStr(obj.title, 80);
  if (obj.title !== void 0 && obj.title !== null && title === void 0) {
    return { ok: false, error: "Title must be a string (max 80 chars)." };
  }
  const stage = cleanOptStr(obj.stage, 40);
  if (obj.stage !== void 0 && obj.stage !== null && stage === void 0) {
    return { ok: false, error: "Stage must be a string (max 40 chars)." };
  }
  const groupLabel = cleanOptStr(obj.group_label, 20);
  if (obj.group_label !== void 0 && obj.group_label !== null && groupLabel === void 0) {
    return { ok: false, error: "group_label max length is 20 chars." };
  }
  const teamA = cleanOptStr(obj.team_a, 80);
  if (obj.team_a !== void 0 && obj.team_a !== null && teamA === void 0) {
    return { ok: false, error: "team_a must be a string (max 80 chars)." };
  }
  const teamB = cleanOptStr(obj.team_b, 80);
  if (obj.team_b !== void 0 && obj.team_b !== null && teamB === void 0) {
    return { ok: false, error: "team_b must be a string (max 80 chars)." };
  }
  const teamAId = cleanOptUuid(obj.team_a_id);
  if (obj.team_a_id !== void 0 && obj.team_a_id !== null && teamAId === void 0) {
    return { ok: false, error: "Invalid team_a_id." };
  }
  const teamBId = cleanOptUuid(obj.team_b_id);
  if (obj.team_b_id !== void 0 && obj.team_b_id !== null && teamBId === void 0) {
    return { ok: false, error: "Invalid team_b_id." };
  }
  const scoreA = cleanOptStr(obj.score_a, 60);
  if (obj.score_a !== void 0 && obj.score_a !== null && scoreA === void 0) {
    return { ok: false, error: "score_a must be a string (max 60 chars)." };
  }
  const scoreB = cleanOptStr(obj.score_b, 60);
  if (obj.score_b !== void 0 && obj.score_b !== null && scoreB === void 0) {
    return { ok: false, error: "score_b must be a string (max 60 chars)." };
  }
  const pointsA = cleanOptPoints(obj.points_a);
  if (obj.points_a !== void 0 && obj.points_a !== null && pointsA === void 0) {
    return { ok: false, error: "points_a must be a non-negative integer." };
  }
  const pointsB = cleanOptPoints(obj.points_b);
  if (obj.points_b !== void 0 && obj.points_b !== null && pointsB === void 0) {
    return { ok: false, error: "points_b must be a non-negative integer." };
  }
  const result = cleanOptStr(obj.result, 160);
  if (obj.result !== void 0 && obj.result !== null && result === void 0) {
    return { ok: false, error: "result must be a string (max 160 chars)." };
  }
  const hidden = typeof obj.hidden === "boolean" ? obj.hidden : false;
  return {
    ok: true,
    data: {
      event,
      title: title ?? null,
      stage: stage ?? null,
      group_label: groupLabel ?? null,
      round,
      team_a: teamA ?? null,
      team_b: teamB ?? null,
      team_a_id: teamAId ?? null,
      team_b_id: teamBId ?? null,
      venue,
      starts_at: startsAt,
      status,
      score_a: scoreA ?? null,
      score_b: scoreB ?? null,
      points_a: pointsA ?? null,
      points_b: pointsB ?? null,
      result: result ?? null,
      hidden
    }
  };
}
function validatePatchRow(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Invalid JSON body." };
  }
  const obj = raw;
  const patch = {};
  if ("event" in obj) {
    const ev = typeof obj.event === "string" ? obj.event.trim() : "";
    if (!VALID_EVENTS.has(ev)) return { ok: false, error: "Invalid event." };
    patch.event = ev;
  }
  if ("venue" in obj) {
    const v = typeof obj.venue === "string" ? obj.venue.trim() : "";
    if (!v || v.length > 80) {
      return { ok: false, error: "Venue must be 1..80 chars." };
    }
    patch.venue = v;
  }
  if ("starts_at" in obj) {
    const s = validateStartsAt(obj.starts_at);
    if (!s) {
      return {
        ok: false,
        error: "starts_at must be within 20 Nov \u2013 5 Dec 2026."
      };
    }
    patch.starts_at = s;
  }
  if ("status" in obj) {
    const st = typeof obj.status === "string" ? obj.status.trim() : "";
    if (!VALID_STATUSES.has(st)) {
      return { ok: false, error: "Invalid match status." };
    }
    patch.status = st;
  }
  if ("round" in obj) {
    const rd = typeof obj.round === "string" ? obj.round.trim() : "";
    if (!VALID_ROUNDS.has(rd)) {
      return { ok: false, error: "Invalid round." };
    }
    patch.round = rd;
  }
  if ("hidden" in obj) {
    if (typeof obj.hidden !== "boolean") {
      return { ok: false, error: "hidden must be boolean." };
    }
    patch.hidden = obj.hidden;
  }
  for (const key of ["team_a_id", "team_b_id"]) {
    if (key in obj) {
      const cleaned = cleanOptUuid(obj[key]);
      if (obj[key] !== null && obj[key] !== "" && cleaned === void 0) {
        return { ok: false, error: `Invalid ${key}.` };
      }
      patch[key] = cleaned ?? null;
    }
  }
  for (const key of ["points_a", "points_b"]) {
    if (key in obj) {
      const cleaned = cleanOptPoints(obj[key]);
      if (obj[key] !== null && obj[key] !== "" && cleaned === void 0) {
        return { ok: false, error: `${key} must be a non-negative integer.` };
      }
      patch[key] = cleaned ?? null;
    }
  }
  const strFields = [
    ["title", 80],
    ["stage", 40],
    ["group_label", 20],
    ["team_a", 80],
    ["team_b", 80],
    ["score_a", 60],
    ["score_b", 60],
    ["result", 160]
  ];
  for (const [key, max] of strFields) {
    if (key in obj) {
      const cleaned = cleanOptStr(obj[key], max);
      if (obj[key] !== null && cleaned === void 0) {
        return { ok: false, error: `${key} exceeds ${max} chars or invalid.` };
      }
      patch[key] = cleaned ?? null;
    }
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No valid fields provided to update." };
  }
  return { ok: true, data: patch };
}
async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  if (method !== "POST" && method !== "PATCH" && method !== "DELETE") {
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
  const id = (url.searchParams.get("id") || "").trim();
  const action = (url.searchParams.get("action") || "").trim();
  if (method === "POST" && action === "finish") {
    if (!UUID_REGEX.test(id)) {
      return adminJsonResponse(
        { ok: false, error: "Missing or invalid match id." },
        400
      );
    }
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
    const pointsA = cleanOptPoints(obj.points_a);
    if (obj.points_a !== void 0 && obj.points_a !== null && pointsA === void 0) {
      return adminJsonResponse({ ok: false, error: "Invalid points_a." }, 400);
    }
    const pointsB = cleanOptPoints(obj.points_b);
    if (obj.points_b !== void 0 && obj.points_b !== null && pointsB === void 0) {
      return adminJsonResponse({ ok: false, error: "Invalid points_b." }, 400);
    }
    const winnerId = cleanOptUuid(obj.winner_id);
    if (obj.winner_id !== void 0 && obj.winner_id !== null && winnerId === void 0) {
      return adminJsonResponse({ ok: false, error: "Invalid winner_id." }, 400);
    }
    const resultStr = cleanOptStr(obj.result, 160);
    if (obj.result !== void 0 && obj.result !== null && resultStr === void 0) {
      return adminJsonResponse({ ok: false, error: "result max length is 160 chars." }, 400);
    }
    try {
      const existingRes = await supabaseFetch(
        cfg,
        `matches?id=eq.${encodeURIComponent(id)}&select=*`
      );
      if (!existingRes.ok) {
        return adminJsonResponse({ ok: false, error: "Failed to load match." }, 502);
      }
      const existingRows = await existingRes.json();
      if (!existingRows.length) {
        return adminJsonResponse({ ok: false, error: "Match not found." }, 404);
      }
      const prev = existingRows[0];
      const teamAId = typeof prev.team_a_id === "string" ? prev.team_a_id : null;
      const teamBId = typeof prev.team_b_id === "string" ? prev.team_b_id : null;
      const pA = pointsA ?? null;
      const pB = pointsB ?? null;
      let resolvedWinner = winnerId ?? null;
      if (pA !== null && pB !== null && pA !== pB) {
        resolvedWinner = pA > pB ? teamAId : teamBId;
      }
      if (!resolvedWinner || resolvedWinner !== teamAId && resolvedWinner !== teamBId) {
        return adminJsonResponse(
          {
            ok: false,
            error: "A valid winner_id (team_a_id or team_b_id) is required."
          },
          400
        );
      }
      const rpcRes = await supabaseFetch(cfg, "rpc/record_match_result", {
        method: "POST",
        body: JSON.stringify({
          p_match_id: id,
          p_points_a: pA,
          p_points_b: pB,
          p_result: resultStr ?? null,
          p_winner_id: resolvedWinner
        })
      });
      if (!rpcRes.ok) {
        return adminJsonResponse(
          { ok: false, error: "Failed to record match result." },
          502
        );
      }
      const refreshedRes = await supabaseFetch(
        cfg,
        `matches?id=eq.${encodeURIComponent(id)}&select=*`
      );
      const refreshedRows = refreshedRes.ok ? await refreshedRes.json() : [prev];
      const updated = refreshedRows[0] ?? prev;
      const push = await maybePushMatchEvent(
        context,
        typeof prev.status === "string" ? prev.status : null,
        updated
      );
      return adminJsonResponse({ ok: true, match: updated, push }, 200);
    } catch {
      return adminJsonResponse(
        { ok: false, error: "Database request failed." },
        502
      );
    }
  }
  if (method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return adminJsonResponse({ ok: false, error: "Malformed JSON." }, 400);
    }
    const items = Array.isArray(body) ? body : [body];
    if (items.length === 0 || items.length > 100) {
      return adminJsonResponse(
        { ok: false, error: "Provide between 1 and 100 matches." },
        400
      );
    }
    const rows = [];
    const teamIdsToResolve = [];
    for (let i = 0; i < items.length; i++) {
      const res = validateCreateRow(items[i]);
      if (!res.ok) {
        return adminJsonResponse(
          { ok: false, error: `Row ${i + 1}: ${res.error}` },
          400
        );
      }
      if (typeof res.data.team_a_id === "string") teamIdsToResolve.push(res.data.team_a_id);
      if (typeof res.data.team_b_id === "string") teamIdsToResolve.push(res.data.team_b_id);
      rows.push(res.data);
    }
    try {
      const nameMap = await resolveTeamNames(cfg, teamIdsToResolve);
      for (const r of rows) {
        if (typeof r.team_a_id === "string" && nameMap.has(r.team_a_id)) {
          r.team_a = nameMap.get(r.team_a_id);
        }
        if (typeof r.team_b_id === "string" && nameMap.has(r.team_b_id)) {
          r.team_b = nameMap.get(r.team_b_id);
        }
      }
      const sbRes = await supabaseFetch(cfg, "matches", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(rows)
      });
      if (!sbRes.ok) {
        return adminJsonResponse(
          { ok: false, error: "Failed to save match(es) to database." },
          502
        );
      }
      const created = await sbRes.json();
      return adminJsonResponse({ ok: true, matches: created }, 201);
    } catch {
      return adminJsonResponse(
        { ok: false, error: "Database request failed." },
        502
      );
    }
  }
  if (!UUID_REGEX.test(id)) {
    return adminJsonResponse(
      { ok: false, error: "Missing or invalid match id." },
      400
    );
  }
  if (method === "PATCH") {
    let body;
    try {
      body = await request.json();
    } catch {
      return adminJsonResponse({ ok: false, error: "Malformed JSON." }, 400);
    }
    const res = validatePatchRow(body);
    if (!res.ok) {
      return adminJsonResponse({ ok: false, error: res.error }, 400);
    }
    try {
      const prevRes = await supabaseFetch(
        cfg,
        `matches?id=eq.${encodeURIComponent(id)}&select=id,status,round,event,team_a,team_b,team_a_id,team_b_id,venue,result`
      );
      if (!prevRes.ok) {
        return adminJsonResponse(
          { ok: false, error: "Failed to load match." },
          502
        );
      }
      const prevRows = await prevRes.json();
      if (!prevRows.length) {
        return adminJsonResponse(
          { ok: false, error: "Match not found." },
          404
        );
      }
      const prevRow = prevRows[0];
      const prevStatus = typeof prevRow.status === "string" ? prevRow.status : null;
      const hasLockedField = FINISHED_LOCKED_FIELDS.some(
        (field) => field in res.data
      );
      if (prevStatus === "finished" && hasLockedField) {
        return adminJsonResponse(
          {
            ok: false,
            error: "Finished matches cannot be modified via PATCH. Use POST ?id=...&action=finish to update the final result."
          },
          409
        );
      }
      const effectiveTeamAId = "team_a_id" in res.data ? res.data.team_a_id : prevRow?.team_a_id ?? null;
      const effectiveTeamBId = "team_b_id" in res.data ? res.data.team_b_id : prevRow?.team_b_id ?? null;
      if (res.data.status === "finished" && (effectiveTeamAId || effectiveTeamBId)) {
        return adminJsonResponse(
          {
            ok: false,
            error: "Matches with linked teams must be finished via POST ?id=...&action=finish so a winner is recorded."
          },
          400
        );
      }
      const idsToResolve = [];
      if (typeof res.data.team_a_id === "string") idsToResolve.push(res.data.team_a_id);
      if (typeof res.data.team_b_id === "string") idsToResolve.push(res.data.team_b_id);
      if (idsToResolve.length > 0) {
        const nameMap = await resolveTeamNames(cfg, idsToResolve);
        if (typeof res.data.team_a_id === "string" && nameMap.has(res.data.team_a_id)) {
          res.data.team_a = nameMap.get(res.data.team_a_id);
        }
        if (typeof res.data.team_b_id === "string" && nameMap.has(res.data.team_b_id)) {
          res.data.team_b = nameMap.get(res.data.team_b_id);
        }
      }
      const patchFilter = hasLockedField ? `matches?id=eq.${encodeURIComponent(id)}&status=neq.finished` : `matches?id=eq.${encodeURIComponent(id)}`;
      const sbRes = await supabaseFetch(cfg, patchFilter, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(res.data)
      });
      if (!sbRes.ok) {
        return adminJsonResponse(
          { ok: false, error: "Failed to update match in database." },
          502
        );
      }
      const updated = await sbRes.json();
      if (!updated.length) {
        if (hasLockedField) {
          return adminJsonResponse(
            {
              ok: false,
              error: "Finished matches cannot be modified via PATCH. Use POST ?id=...&action=finish to update the final result."
            },
            409
          );
        }
        return adminJsonResponse(
          { ok: false, error: "Match not found." },
          404
        );
      }
      const push = await maybePushMatchEvent(context, prevStatus, updated[0]);
      return adminJsonResponse({ ok: true, match: updated[0], push }, 200);
    } catch {
      return adminJsonResponse(
        { ok: false, error: "Database request failed." },
        502
      );
    }
  }
  try {
    const sbRes = await supabaseFetch(
      cfg,
      `matches?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (!sbRes.ok) {
      return adminJsonResponse(
        { ok: false, error: "Failed to delete match from database." },
        502
      );
    }
    return adminJsonResponse({ ok: true, deletedId: id }, 200);
  } catch {
    return adminJsonResponse(
      { ok: false, error: "Database request failed." },
      502
    );
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
