import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getAdminConfig,
  normalizeSecretEnv,
  verifySessionToken,
} from "../lib/server/admin-auth";
import {
  buildSupabaseAuthHeaders,
  getSupabaseConfig,
  logSupabaseError,
} from "../lib/server/supabase-rest";
import { onRequestPost as registrationsPost } from "../functions/api/registrations";
import { onRequest as loginHandler } from "../functions/api/admin/login";
import { onRequest as logoutHandler } from "../functions/api/admin/logout";
import { onRequestGet as adminRegistrationsGet } from "../functions/api/admin/registrations";
import { onRequest as announcementsHandler } from "../functions/api/admin/announcements";
import { onRequest as teamsHandler } from "../functions/api/admin/teams";
import { onRequest as matchesHandler } from "../functions/api/admin/matches";
import { onRequest as podiumsHandler } from "../functions/api/admin/podiums";
import { onRequest as bracketsHandler } from "../functions/api/admin/brackets";
import vercelRegistrationsHandler from "../api/registrations.js";
import vercelAdminRegistrationsHandler from "../api/admin/registrations.js";
import vercelLoginHandler from "../api/admin/login.js";

const SUPABASE_URL = "https://example.supabase.co";
const ADMIN_PW = "test-admin-secret";
const SESSION_SECRET = "test-session-signing-secret-32-chars";
const SB_SECRET = "sb_secret_test_key_123456";
const LEGACY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy.sig";
const MATCH_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_A_ID = "22222222-2222-4222-8222-222222222222";
const TEAM_B_ID = "33333333-3333-4333-8333-333333333333";

type RecordedFetch = {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
};

async function withMockFetch<T>(
  handler: (req: RecordedFetch) => Response | Promise<Response>,
  fn: (calls: RecordedFetch[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const calls: RecordedFetch[] = [];
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === "string" ? init.body : null;
    const rec: RecordedFetch = { url, method, headers, body };
    calls.push(rec);
    return handler(rec);
  }) as typeof fetch;
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function assertKeyHeaders(headers: Headers, key: string) {
  assert.equal(headers.get("apikey"), key, "apikey header must match secretKey");
  if (key.startsWith("sb_secret_")) {
    assert.equal(
      headers.get("Authorization"),
      null,
      "sb_secret_ key must NOT be sent in Authorization Bearer header",
    );
  } else {
    assert.equal(
      headers.get("Authorization"),
      `Bearer ${key}`,
      "legacy JWT key must be sent in Authorization Bearer header",
    );
  }
}

async function makeSessionCookie(): Promise<string> {
  const { token } = await createSessionToken(SESSION_SECRET);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

async function testAuthHeaderHelper() {
  const modern = buildSupabaseAuthHeaders(SB_SECRET, {
    Authorization: "Bearer stale",
    "Content-Type": "application/json",
  });
  assertKeyHeaders(modern, SB_SECRET);
  assert.equal(modern.get("Content-Type"), "application/json");

  const legacy = buildSupabaseAuthHeaders(LEGACY_JWT);
  assertKeyHeaders(legacy, LEGACY_JWT);
}

async function testLoginLogoutSessionAndCsrf() {
  const env = {
    ADMIN_PASSWORD: ADMIN_PW,
    ADMIN_SESSION_SECRET: SESSION_SECRET,
    SUPABASE_URL,
    SUPABASE_SECRET_KEY: SB_SECRET,
  };

  // Missing ADMIN_SESSION_SECRET -> 503 fail closed
  const noSecretLogin = await loginHandler({
    request: new Request("https://udaan.test/api/admin/login", {
      method: "POST",
      headers: {
        Origin: "https://udaan.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: ADMIN_PW }),
    }),
    env: { ADMIN_PASSWORD: ADMIN_PW },
  });
  assert.equal(noSecretLogin.status, 503);

  // Cross-origin login -> 403
  const crossLogin = await loginHandler({
    request: new Request("https://udaan.test/api/admin/login", {
      method: "POST",
      headers: {
        Origin: "https://evil.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: ADMIN_PW }),
    }),
    env,
  });
  assert.equal(crossLogin.status, 403);

  // Wrong password -> 401
  const badLogin = await loginHandler({
    request: new Request("https://udaan.test/api/admin/login", {
      method: "POST",
      headers: {
        Origin: "https://udaan.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "wrong" }),
    }),
    env,
  });
  assert.equal(badLogin.status, 401);

  // Valid login -> 200 + HttpOnly; SameSite=Strict; Secure cookie
  const goodLogin = await loginHandler({
    request: new Request("https://udaan.test/api/admin/login", {
      method: "POST",
      headers: {
        Origin: "https://udaan.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: ADMIN_PW }),
    }),
    env,
  });
  assert.equal(goodLogin.status, 200);
  const setCookie = goodLogin.headers.get("Set-Cookie") || "";
  assert.ok(setCookie.includes(`${SESSION_COOKIE_NAME}=`));
  assert.ok(setCookie.includes("HttpOnly"));
  assert.ok(setCookie.includes("SameSite=Strict"));
  assert.ok(setCookie.includes("Secure"));

  const cookiePair = setCookie.split(";")[0];

  // Unauthenticated request -> 401
  const unauth = await adminRegistrationsGet({
    request: new Request("https://udaan.test/api/admin/registrations"),
    env,
  });
  assert.equal(unauth.status, 401);

  // Cross-origin state-changing request with valid cookie -> 403 CSRF rejection
  const csrfBlocked = await teamsHandler({
    request: new Request("https://udaan.test/api/admin/teams", {
      method: "POST",
      headers: {
        Origin: "https://attacker.test",
        Cookie: cookiePair,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event: "Cricket", name: "X", department: "CSE" }),
    }),
    env,
  });
  assert.equal(csrfBlocked.status, 403);

  // Missing Origin & Referer on state-changing request -> 403
  const noOriginBlocked = await teamsHandler({
    request: new Request("https://udaan.test/api/admin/teams", {
      method: "POST",
      headers: {
        Cookie: cookiePair,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event: "Cricket", name: "X", department: "CSE" }),
    }),
    env,
  });
  assert.equal(noOriginBlocked.status, 403);

  // Session expiry & tampering verification
  const now = 1_700_000_000_000;
  const created = await createSessionToken(SESSION_SECRET, now);
  assert.equal(await verifySessionToken(created.token, SESSION_SECRET, now + 1000), true);
  assert.equal(
    await verifySessionToken(created.token, SESSION_SECRET, now + 9 * 60 * 60 * 1000),
    false,
    "Expired session token must be rejected",
  );
  assert.equal(
    await verifySessionToken(created.token + "x", SESSION_SECRET, now + 1000),
    false,
    "Tampered session token must be rejected",
  );

  // Logout clears cookie
  const logoutRes = await logoutHandler({
    request: new Request("https://udaan.test/api/admin/logout", {
      method: "POST",
      headers: { Origin: "https://udaan.test", Cookie: cookiePair },
    }),
  });
  assert.equal(logoutRes.status, 200);
  assert.ok((logoutRes.headers.get("Set-Cookie") || "").includes("Max-Age=0"));
}

async function testKeyCompatibilityAcrossAllRoutes(secretKey: string) {
  const env = {
    ADMIN_PASSWORD: ADMIN_PW,
    ADMIN_SESSION_SECRET: SESSION_SECRET,
    SUPABASE_URL,
    SUPABASE_SECRET_KEY: secretKey,
    NTFY_ENABLED: "false",
  };
  const cookie = await makeSessionCookie();
  const authHeaders = {
    Origin: "https://udaan.test",
    Cookie: cookie,
    "Content-Type": "application/json",
  };

  // 1. Public registration write + 409 deduplication lookup
  await withMockFetch(
    (rec) => {
      assertKeyHeaders(rec.headers, secretKey);
      if (rec.method === "POST") {
        return new Response(JSON.stringify({ code: "23505" }), { status: 409 });
      }
      return new Response(
        JSON.stringify([{ id: "reg-1", created_at: "2026-11-20T00:00:00Z" }]),
        { status: 200 },
      );
    },
    async (calls) => {
      const req = new Request("https://udaan.test/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: "44444444-4444-4444-8444-444444444444",
          fullName: "Test Player",
          email: "player@bcebhagalpur.ac.in",
          phone: "9876543210",
          college: "BCE Bhagalpur",
          rollNumber: "24101105001",
          department: "CSE",
          academicYear: "2nd Year",
          events: ["Cricket"],
          participationType: "Team",
          teamName: "CSE Lions",
          teamMembers: "A, B",
          confirmedDetails: true,
        }),
      });
      const res = await registrationsPost({ request: req, env });
      assert.equal(res.status, 200);
      assert.equal(calls.length, 2);
    },
  );

  // 2. Admin registrations read
  await withMockFetch(
    (rec) => {
      assertKeyHeaders(rec.headers, secretKey);
      return new Response(JSON.stringify([]), { status: 200 });
    },
    async () => {
      const res = await adminRegistrationsGet({
        request: new Request("https://udaan.test/api/admin/registrations", {
          headers: { Cookie: cookie },
        }),
        env,
      });
      assert.equal(res.status, 200);
    },
  );

  // 3. Announcements POST + protocol-relative / unsafe URL checks
  await withMockFetch(
    (rec) => {
      assertKeyHeaders(rec.headers, secretKey);
      return new Response(JSON.stringify([{ id: "ann-1", message: "Hi" }]), {
        status: 201,
      });
    },
    async () => {
      for (const validLink of ["/Templates/live", "./live.html", "../index.html"]) {
        const res = await announcementsHandler({
          request: new Request("https://udaan.test/api/admin/announcements", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              message: "Match update: starts at 10 AM",
              level: "info",
              link: validLink,
              expiresInMinutes: 30,
            }),
          }),
          env,
        });
        assert.equal(res.status, 201, `Valid relative link ${validLink} must succeed`);
      }

      for (const badLink of [
        "//evil.com",
        "///evil.com",
        "/\\evil.com",
        "\\\\evil.com",
        "https://evil.com/phish",
        "javascript:alert(1)",
      ]) {
        const res = await announcementsHandler({
          request: new Request("https://udaan.test/api/admin/announcements", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              message: "Match update: starts at 10 AM",
              level: "info",
              link: badLink,
              expiresInMinutes: 30,
            }),
          }),
          env,
        });
        assert.equal(res.status, 400, `Unsafe link ${badLink} must be rejected`);
      }
    },
  );

  // 4. Teams POST + transactional PATCH (rpc/update_team_and_sync)
  await withMockFetch(
    (rec) => {
      assertKeyHeaders(rec.headers, secretKey);
      if (rec.url.includes("rpc/update_team_and_sync")) {
        const payload = JSON.parse(rec.body || "{}");
        if (payload.p_event === "Football") {
          return new Response(JSON.stringify({ message: "TEAM_HAS_MATCHES" }), {
            status: 400,
          });
        }
        return new Response(
          JSON.stringify([{ id: TEAM_A_ID, name: payload.p_name || "CSE Lions", event: "Cricket" }]),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify([{ id: TEAM_A_ID, name: "CSE Lions" }]),
        { status: 201 },
      );
    },
    async () => {
      const res = await teamsHandler({
        request: new Request("https://udaan.test/api/admin/teams", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            event: "Cricket",
            name: "CSE Lions",
            department: "CSE",
          }),
        }),
        env,
      });
      assert.equal(res.status, 201);

      const conflictRes = await teamsHandler({
        request: new Request(`https://udaan.test/api/admin/teams?id=${TEAM_A_ID}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ event: "Football" }),
        }),
        env,
      });
      assert.equal(conflictRes.status, 409, "Event change with linked matches must return 409");

      const renameRes = await teamsHandler({
        request: new Request(`https://udaan.test/api/admin/teams?id=${TEAM_A_ID}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ name: "CSE Tigers" }),
        }),
        env,
      });
      assert.equal(renameRes.status, 200);
    },
  );

  // 5. Matches POST ?action=finish -> rpc/record_match_result
  await withMockFetch(
    (rec) => {
      assertKeyHeaders(rec.headers, secretKey);
      if (rec.url.includes("rpc/record_match_result")) {
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify([
          {
            id: MATCH_ID,
            status: "live",
            round: "league",
            event: "Cricket",
            team_a_id: TEAM_A_ID,
            team_b_id: TEAM_B_ID,
            team_a: "CSE Lions",
            team_b: "ECE Eagles",
          },
        ]),
        { status: 200 },
      );
    },
    async (calls) => {
      const res = await matchesHandler({
        request: new Request(
          `https://udaan.test/api/admin/matches?id=${MATCH_ID}&action=finish`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              points_a: 120,
              points_b: 98,
              result: "CSE Lions won by 22 runs",
            }),
          },
        ),
        env,
      });
      assert.equal(res.status, 200);
      assert.ok(calls.some((c) => c.url.includes("rpc/record_match_result")));
    },
  );

  // 6. Podiums POST
  await withMockFetch(
    (rec) => {
      assertKeyHeaders(rec.headers, secretKey);
      return new Response(
        JSON.stringify([{ id: "pod-1", event: "Cricket", place: 1 }]),
        { status: 201 },
      );
    },
    async () => {
      const res = await podiumsHandler({
        request: new Request("https://udaan.test/api/admin/podiums", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            event: "Cricket",
            place: 1,
            department: "CSE",
          }),
        }),
        env,
      });
      assert.equal(res.status, 201);
    },
  );

  // 7. Brackets PUT
  await withMockFetch(
    (rec) => {
      assertKeyHeaders(rec.headers, secretKey);
      return new Response(JSON.stringify([{ event: "Cricket" }]), {
        status: 200,
      });
    },
    async () => {
      const res = await bracketsHandler({
        request: new Request(
          "https://udaan.test/api/admin/brackets?event=Cricket",
          {
            method: "PUT",
            headers: authHeaders,
            body: JSON.stringify({
              stage: [],
              group: [],
              round: [],
              match: [],
              match_game: [],
              participant: [],
            }),
          },
        ),
        env,
      });
      assert.equal(res.status, 200);
    },
  );
}

async function testFinishedMatchIntegrityAndToctou() {
  const env = {
    ADMIN_PASSWORD: ADMIN_PW,
    ADMIN_SESSION_SECRET: SESSION_SECRET,
    SUPABASE_URL,
    SUPABASE_SECRET_KEY: SB_SECRET,
    NTFY_ENABLED: "true",
    NTFY_TOPIC: "udaan-test-topic",
  };
  const cookie = await makeSessionCookie();
  const authHeaders = {
    Origin: "https://udaan.test",
    Cookie: cookie,
    "Content-Type": "application/json",
  };

  let matchState = {
    id: MATCH_ID,
    status: "upcoming",
    round: "SF",
    event: "Cricket",
    team_a: "CSE Lions",
    team_b: "ECE Eagles",
    team_a_id: TEAM_A_ID,
    team_b_id: TEAM_B_ID,
    points_a: null as number | null,
    points_b: null as number | null,
    score_a: null as string | null,
    score_b: null as string | null,
    winner_id: null as string | null,
    result: null as string | null,
    hidden: false,
  };
  let ntfyPushCount = 0;

  const mockSupabase = (rec: RecordedFetch): Response => {
    if (rec.url.startsWith("https://ntfy.sh/")) {
      ntfyPushCount++;
      return new Response("{}", { status: 200 });
    }
    if (rec.url.includes("rpc/record_match_result") && rec.method === "POST") {
      const args = JSON.parse(rec.body || "{}");
      const winner =
        args.p_points_a !== null &&
        args.p_points_b !== null &&
        args.p_points_a !== args.p_points_b
          ? args.p_points_a > args.p_points_b
            ? matchState.team_a_id
            : matchState.team_b_id
          : args.p_winner_id;
      matchState = {
        ...matchState,
        points_a: args.p_points_a,
        points_b: args.p_points_b,
        winner_id: winner,
        result: args.p_result,
        status: "finished",
      };
      return new Response(null, { status: 204 });
    }
    if (rec.url.includes("/rest/v1/matches") && rec.method === "GET") {
      return new Response(JSON.stringify([matchState]), { status: 200 });
    }
    if (rec.url.includes("/rest/v1/matches") && rec.method === "PATCH") {
      if (rec.url.includes("status=neq.finished") && matchState.status === "finished") {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      const patch = JSON.parse(rec.body || "{}");
      matchState = { ...matchState, ...patch };
      return new Response(JSON.stringify([matchState]), { status: 200 });
    }
    return new Response("[]", { status: 200 });
  };

  await withMockFetch(mockSupabase, async (calls) => {
    const livePatch = await matchesHandler({
      request: new Request(
        `https://udaan.test/api/admin/matches?id=${MATCH_ID}`,
        {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ status: "live", points_a: 50, points_b: 40 }),
        },
      ),
      env,
    });
    assert.equal(livePatch.status, 200);
    assert.equal(matchState.status, "live");
    assert.equal(ntfyPushCount, 1);

    // Atomic filter verification: locked PATCH includes status=neq.finished
    const lastPatch = [...calls].reverse().find((c) => c.method === "PATCH");
    assert.ok(lastPatch?.url.includes("status=neq.finished"));

    const badFinishPatch = await matchesHandler({
      request: new Request(
        `https://udaan.test/api/admin/matches?id=${MATCH_ID}`,
        {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ status: "finished" }),
        },
      ),
      env,
    });
    assert.equal(badFinishPatch.status, 400);

    const finishRes = await matchesHandler({
      request: new Request(
        `https://udaan.test/api/admin/matches?id=${MATCH_ID}&action=finish`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            points_a: 120,
            points_b: 98,
            result: "CSE Lions won by 22 runs",
          }),
        },
      ),
      env,
    });
    assert.equal(finishRes.status, 200);
    assert.equal(matchState.status, "finished");
    assert.equal(matchState.winner_id, TEAM_A_ID);
    assert.equal(ntfyPushCount, 2);

    const patchCountBefore = calls.filter((c) => c.method === "PATCH").length;
    for (const payload of [
      { points_a: 10, points_b: 99 },
      { score_a: "10", score_b: "99" },
      { result: "Tampered" },
      { status: "live" },
      { team_a_id: TEAM_B_ID },
      { round: "F" },
    ]) {
      const blocked = await matchesHandler({
        request: new Request(
          `https://udaan.test/api/admin/matches?id=${MATCH_ID}`,
          {
            method: "PATCH",
            headers: authHeaders,
            body: JSON.stringify(payload),
          },
        ),
        env,
      });
      assert.equal(blocked.status, 409);
    }
    const patchCountAfter = calls.filter((c) => c.method === "PATCH").length;
    assert.equal(patchCountAfter, patchCountBefore);

    const hideRes = await matchesHandler({
      request: new Request(
        `https://udaan.test/api/admin/matches?id=${MATCH_ID}`,
        {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ hidden: true }),
        },
      ),
      env,
    });
    assert.equal(hideRes.status, 200);
    assert.equal(matchState.hidden, true);

    const correctionRes = await matchesHandler({
      request: new Request(
        `https://udaan.test/api/admin/matches?id=${MATCH_ID}&action=finish`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            points_a: 95,
            points_b: 100,
            result: "ECE Eagles won by 5 runs",
          }),
        },
      ),
      env,
    });
    assert.equal(correctionRes.status, 200);
    const correctionJson = (await correctionRes.json()) as { push: string };
    assert.equal(correctionJson.push, "skipped");
    assert.equal(matchState.winner_id, TEAM_B_ID);
    assert.equal(ntfyPushCount, 2);
  });

  // Simulated TOCTOU race: GET sees status='live', then match finishes before PATCH executes
  await withMockFetch(
    (rec) => {
      if (rec.method === "GET") {
        return new Response(
          JSON.stringify([{ id: MATCH_ID, status: "live", team_a_id: TEAM_A_ID, team_b_id: TEAM_B_ID }]),
          { status: 200 },
        );
      }
      // Concurrent finish already committed, so status=neq.finished updates 0 rows
      return new Response(JSON.stringify([]), { status: 200 });
    },
    async () => {
      const raceRes = await matchesHandler({
        request: new Request(
          `https://udaan.test/api/admin/matches?id=${MATCH_ID}`,
          {
            method: "PATCH",
            headers: authHeaders,
            body: JSON.stringify({ points_a: 1, points_b: 99 }),
          },
        ),
        env,
      });
      assert.equal(raceRes.status, 409, "Concurrent TOCTOU PATCH must return 409");
    },
  );
}

function testAssetIntegrityAndNoStoragePassword() {
  const root = process.cwd();
  const htmlFiles = [
    "index.html",
    "Templates/live.html",
    "Templates/archive.html",
    "Templates/gallery.html",
    "Templates/ignition.html",
    "Templates/registration.html",
    "Templates/admin.html",
  ];
  for (const rel of htmlFiles) {
    const content = fs.readFileSync(path.join(root, rel), "utf8");
    assert.equal(
      content.includes("kit.fontawesome.com"),
      false,
      `${rel} must not load un-pinned kit.fontawesome.com`,
    );
    assert.equal(
      content.includes("maxcdn.bootstrapcdn.com"),
      false,
      `${rel} must not load un-pinned maxcdn.bootstrapcdn.com`,
    );
  }
  const adminEntry = fs.readFileSync(path.join(root, "src/admin-entry.tsx"), "utf8");
  assert.equal(adminEntry.includes("sessionStorage"), false);
  assert.equal(adminEntry.includes("localStorage"), false);
}

async function invokeNodeHandler(
  handler: (req: any, res: any) => Promise<void>,
  opts: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<{ status: number; headers: Record<string, string | string[]>; body: string }> {
  const chunks = opts.body ? [new TextEncoder().encode(opts.body)] : [];
  const req = {
    url: opts.url,
    method: opts.method,
    headers: { host: "udaan.vercel.app", ...(opts.headers ?? {}) },
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
  const outHeaders: Record<string, string | string[]> = {};
  let status = 200;
  let body = "";
  const res = {
    set statusCode(code: number) {
      status = code;
    },
    get statusCode() {
      return status;
    },
    setHeader(name: string, value: string | string[]) {
      outHeaders[name.toLowerCase()] = value;
    },
    end(chunk?: Uint8Array | string) {
      if (typeof chunk === "string") body += chunk;
      else if (chunk) body += new TextDecoder().decode(chunk);
    },
  };
  await handler(req, res);
  return { status, headers: outHeaders, body };
}

async function testVercelAdapters() {
  const prevEnv = { ...process.env };
  process.env.ADMIN_PASSWORD = ADMIN_PW;
  process.env.ADMIN_SESSION_SECRET = SESSION_SECRET;
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_SECRET_KEY = SB_SECRET;
  try {
    const badReg = await invokeNodeHandler(vercelRegistrationsHandler, {
      url: "/api/registrations",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(badReg.status, 400);

    const unauthAdmin = await invokeNodeHandler(vercelAdminRegistrationsHandler, {
      url: "/api/admin/registrations",
      method: "GET",
    });
    assert.equal(unauthAdmin.status, 401);

    const loginRes = await invokeNodeHandler(vercelLoginHandler, {
      url: "/api/admin/login",
      method: "POST",
      headers: {
        origin: "https://udaan.vercel.app",
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: ADMIN_PW }),
    });
    assert.equal(loginRes.status, 200);
    const setCookie = loginRes.headers["set-cookie"];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie || "");
    assert.ok(cookieStr.includes("HttpOnly"));
  } finally {
    process.env = prevEnv;
  }
}

async function testSecretNormalizationAnd503Logging() {
  assert.equal(normalizeSecretEnv('  "demo123"  '), "demo123");
  assert.equal(normalizeSecretEnv("  'sujal123'  "), "sujal123");
  assert.equal(normalizeSecretEnv('""'), "");
  assert.equal(normalizeSecretEnv('"unbalanced'), '"unbalanced');

  // Verify 503 logs missing env var names without exposing secret values or lengths
  const errors: string[] = [];
  const origError = console.error;
  console.error = (...args: unknown[]) => errors.push(args.map(String).join(" "));
  try {
    const cfg = getAdminConfig({ ADMIN_PASSWORD: '""' });
    assert.equal(cfg, null);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes("ADMIN_PASSWORD"));
    assert.ok(errors[0].includes("ADMIN_SESSION_SECRET"));
  } finally {
    console.error = origError;
  }

  // Quoted env vars still allow login + session verification
  const quotedEnv = {
    ADMIN_PASSWORD: `"${ADMIN_PW}"`,
    ADMIN_SESSION_SECRET: `'${SESSION_SECRET}'`,
  };
  const loginRes = await loginHandler({
    request: new Request("https://udaan.test/api/admin/login", {
      method: "POST",
      headers: {
        Origin: "https://udaan.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: ADMIN_PW }),
    }),
    env: quotedEnv,
  });
  assert.equal(loginRes.status, 200);
}

async function testSupabaseUrlNormalizationAndErrorLogging() {
  const cfg1 = getSupabaseConfig({
    SUPABASE_URL: '  "https://example.supabase.co/rest/v1/"  ',
    SUPABASE_SECRET_KEY: `  '${SB_SECRET}'  `,
  });
  assert.deepEqual(cfg1, {
    url: "https://example.supabase.co",
    secretKey: SB_SECRET,
  });

  const cfg2 = getSupabaseConfig({
    SUPABASE_URL: "https://example.supabase.co/rest/v1",
    SUPABASE_SECRET_KEY: SB_SECRET,
  });
  assert.deepEqual(cfg2, {
    url: "https://example.supabase.co",
    secretKey: SB_SECRET,
  });

  // registrations.ts uses shared getSupabaseConfig + supabaseFetch + logSupabaseError
  const regSrc = fs.readFileSync(
    path.join(process.cwd(), "functions", "api", "registrations.ts"),
    "utf8",
  );
  assert.ok(regSrc.includes("getSupabaseConfig("));
  assert.ok(regSrc.includes("supabaseFetch("));
  assert.ok(regSrc.includes("logSupabaseError("));

  const errors: string[] = [];
  const origError = console.error;
  console.error = (...args: unknown[]) => errors.push(args.map(String).join(" "));
  try {
    await logSupabaseError(
      "POST /api/registrations",
      new Response("PGRST125 Invalid path", { status: 404 }),
    );
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes("[supabase]"));
    assert.ok(errors[0].includes("POST /api/registrations"));
    assert.ok(errors[0].includes("404"));
    assert.ok(errors[0].includes("PGRST125"));

    const res = await withMockFetch(
      async (req) => {
        assert.equal(
          req.url,
          "https://example.supabase.co/rest/v1/event_registrations",
        );
        return new Response(JSON.stringify([{ id: "reg-1", created_at: "2026-01-01T00:00:00Z" }]), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
      async () =>
        registrationsPost({
          request: new Request("https://udaan.test/api/registrations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              submissionId: "11111111-1111-4111-8111-111111111111",
              fullName: "Test User",
              email: "test@example.com",
              phoneCountryCode: "+91",
              phone: "9876543210",
              college: "BCE Bhagalpur",
              rollNumber: "24101105001",
              department: "CSE",
              academicYear: "2nd Year",
              events: ["Cricket"],
              participationType: "individual",
              confirmedDetails: true,
            }),
          }),
          env: {
            SUPABASE_URL: '"https://example.supabase.co/rest/v1/"',
            SUPABASE_SECRET_KEY: SB_SECRET,
          },
        }),
    );
    assert.equal(res.status, 201);
  } finally {
    console.error = origError;
  }
}

async function testLoginRateLimitingAndFailOpen() {
  const env = {
    ADMIN_PASSWORD: ADMIN_PW,
    ADMIN_SESSION_SECRET: SESSION_SECRET,
    SUPABASE_URL,
    SUPABASE_SECRET_KEY: SB_SECRET,
  };

  let failCount = 0;
  let lockedUntil: string | null = null;
  let clearedCount = 0;

  // 5 failures -> 6th attempt returns 429 even with correct password
  await withMockFetch(
    async (req) => {
      if (req.url.includes("admin_login_attempts") && req.method === "GET") {
        return new Response(JSON.stringify([{ locked_until: lockedUntil }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (req.url.includes("rpc/record_admin_login_failure") && req.method === "POST") {
        failCount += 1;
        if (failCount >= 5) {
          lockedUntil = new Date(Date.now() + 15 * 60_000).toISOString();
        }
        return new Response(
          JSON.stringify([{ fail_count: failCount, locked_until: lockedUntil }]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (req.url.includes("admin_login_attempts") && req.method === "DELETE") {
        clearedCount += 1;
        failCount = 0;
        lockedUntil = null;
        return new Response("", { status: 204 });
      }
      return new Response("Not found", { status: 404 });
    },
    async () => {
      for (let i = 0; i < 5; i++) {
        const res = await loginHandler({
          request: new Request("https://udaan.test/api/admin/login", {
            method: "POST",
            headers: {
              Origin: "https://udaan.test",
              "Content-Type": "application/json",
              "CF-Connecting-IP": "203.0.113.42",
            },
            body: JSON.stringify({ password: "wrong-password" }),
          }),
          env,
        });
        assert.equal(res.status, 401);
      }

      // 6th attempt with CORRECT password must be blocked with 429 + Retry-After
      const blocked = await loginHandler({
        request: new Request("https://udaan.test/api/admin/login", {
          method: "POST",
          headers: {
            Origin: "https://udaan.test",
            "Content-Type": "application/json",
            "CF-Connecting-IP": "203.0.113.42",
          },
          body: JSON.stringify({ password: ADMIN_PW }),
        }),
        env,
      });
      assert.equal(blocked.status, 429);
      assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
      assert.equal(blocked.headers.get("Set-Cookie"), null);

      // Unlock and verify successful login clears counter
      lockedUntil = null;
      const okRes = await loginHandler({
        request: new Request("https://udaan.test/api/admin/login", {
          method: "POST",
          headers: {
            Origin: "https://udaan.test",
            "Content-Type": "application/json",
            "X-Forwarded-For": "203.0.113.42, 10.0.0.1",
          },
          body: JSON.stringify({ password: ADMIN_PW }),
        }),
        env,
      });
      assert.equal(okRes.status, 200);
      assert.equal(clearedCount, 1);
    },
  );

  // Supabase unavailable -> fail open (allows login check)
  const errors: string[] = [];
  const origError = console.error;
  console.error = (...args: unknown[]) => errors.push(args.map(String).join(" "));
  try {
    const failOpenRes = await withMockFetch(
      async () => new Response("Service Unavailable", { status: 503 }),
      async () =>
        loginHandler({
          request: new Request("https://udaan.test/api/admin/login", {
            method: "POST",
            headers: {
              Origin: "https://udaan.test",
              "Content-Type": "application/json",
              "X-Real-IP": "198.51.100.7",
            },
            body: JSON.stringify({ password: ADMIN_PW }),
          }),
          env,
        }),
    );
    assert.equal(failOpenRes.status, 200);
    assert.ok(errors.some((e) => e.includes("[supabase]")));
  } finally {
    console.error = origError;
  }
}

async function testRegistrationFormRules() {
  const env = {
    SUPABASE_URL,
    SUPABASE_SECRET_KEY: SB_SECRET,
  };

  const makeReq = (body: Record<string, unknown>) =>
    new Request("https://udaan.test/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId: "55555555-5555-4555-8555-555555555555",
        fullName: "Aarav Kumar",
        email: "aarav@example.com",
        phoneCountryCode: "+1",
        phone: "09876543210",
        college: "Other College",
        rollNumber: "23101105001",
        department: "CSE",
        academicYear: "2nd Year",
        events: ["Cricket"],
        participationType: "individual",
        confirmedDetails: true,
        ...body,
      }),
    });

  // 1. Phone forced to +91 & college forced to "Bhagalpur College of Engineering"
  let capturedRecord: Record<string, unknown> | null = null;
  const okRes = await withMockFetch(
    async (req) => {
      capturedRecord = JSON.parse(req.body || "{}") as Record<string, unknown>;
      return new Response(
        JSON.stringify([{ id: "reg-ind-1", created_at: "2026-11-28T00:00:00Z" }]),
        { status: 201 },
      );
    },
    () => registrationsPost({ request: makeReq({}), env }),
  );
  assert.equal(okRes.status, 201);
  assert.equal(capturedRecord?.phone, "+919876543210");
  assert.equal(capturedRecord?.college, "Bhagalpur College of Engineering");

  // 2. Non-Indian phone rejected even if phoneCountryCode is +1
  const badPhone = await registrationsPost({
    request: makeReq({ phoneCountryCode: "+1", phone: "5551234567" }),
    env,
  });
  assert.equal(badPhone.status, 400);

  // 3. Academic fields required
  for (const patch of [
    { rollNumber: "" },
    { rollNumber: "12" },
    { rollNumber: "24CSE01" },
    { rollNumber: "23-101" },
    { rollNumber: "23 CSE 01" },
    { department: "" },
    { department: "BIO" },
    { academicYear: "" },
    { academicYear: "5th Year" },
  ]) {
    const r = await registrationsPost({ request: makeReq(patch), env });
    assert.equal(r.status, 400, `Expected 400 for ${JSON.stringify(patch)}`);
  }

  // 4. Checkbox requirements
  const noConfirm = await registrationsPost({
    request: makeReq({ confirmedDetails: false }),
    env,
  });
  assert.equal(noConfirm.status, 400);

  const validTeamBase = {
    events: ["BGMI"],
    participationType: "team",
    teamName: "Squad Alpha",
    teamMemberDetails: [
      {
        name: "Rohan Singh",
        rollNumber: "23101105002",
        department: "ECE",
        academicYear: "2nd Year",
      },
    ],
    teamConfirmed: true,
  };

  const noTeamConfirm = await registrationsPost({
    request: makeReq({ ...validTeamBase, teamConfirmed: false }),
    env,
  });
  assert.equal(noTeamConfirm.status, 400);

  // 5. Team member validation (empty, >15, missing branch, duplicate reg no, matches participant roll)
  const tooMany = Array.from({ length: 16 }, (_, i) => ({
    name: `Player ${i + 1}`,
    rollNumber: `23101105${String(i + 10).padStart(3, "0")}`,
    department: "CSE",
    academicYear: "2nd Year",
  }));
  for (const patch of [
    { ...validTeamBase, teamMemberDetails: [] },
    { ...validTeamBase, teamMemberDetails: tooMany },
    {
      ...validTeamBase,
      teamMemberDetails: [
        { name: "Rohan", rollNumber: "23101105002", department: "", academicYear: "2nd Year" },
      ],
    },
    {
      ...validTeamBase,
      teamMemberDetails: [
        { name: "Rohan", rollNumber: "23101105002", department: "CSE", academicYear: "Bad" },
      ],
    },
    {
      ...validTeamBase,
      teamMemberDetails: [
        { name: "Rohan", rollNumber: "23101105001", department: "CSE", academicYear: "2nd Year" },
      ],
    },
    {
      ...validTeamBase,
      teamMemberDetails: [
        { name: "Rohan", rollNumber: "23101105002", department: "CSE", academicYear: "2nd Year" },
        { name: "Mohan", rollNumber: "23101105002", department: "ECE", academicYear: "2nd Year" },
      ],
    },
  ]) {
    const r = await registrationsPost({ request: makeReq(patch), env });
    assert.equal(r.status, 400, `Expected 400 for team patch`);
  }

  // 6. Valid team stores formatted "Name — RegNo — Branch — Year" lines
  let capturedTeam: Record<string, unknown> | null = null;
  const okTeamRes = await withMockFetch(
    async (req) => {
      capturedTeam = JSON.parse(req.body || "{}") as Record<string, unknown>;
      return new Response(
        JSON.stringify([{ id: "reg-team-1", created_at: "2026-11-28T00:00:00Z" }]),
        { status: 201 },
      );
    },
    () =>
      registrationsPost({
        request: makeReq({
          ...validTeamBase,
          teamMemberDetails: [
            {
              name: "Rohan Singh",
              rollNumber: "23101105002",
              department: "ECE",
              academicYear: "2nd Year",
            },
            {
              name: "Priya Verma",
              rollNumber: "23101105003",
              department: "CSE",
              academicYear: "3rd Year",
            },
          ],
        }),
        env,
      }),
  );
  assert.equal(okTeamRes.status, 201);
  assert.equal(
    capturedTeam?.team_members,
    "Rohan Singh — 23101105002 — ECE — 2nd Year\nPriya Verma — 23101105003 — CSE — 3rd Year",
  );
}

async function main() {
  await testAuthHeaderHelper();
  await testSecretNormalizationAnd503Logging();
  await testSupabaseUrlNormalizationAndErrorLogging();
  await testLoginRateLimitingAndFailOpen();
  await testRegistrationFormRules();
  await testLoginLogoutSessionAndCsrf();
  await testKeyCompatibilityAcrossAllRoutes(SB_SECRET);
  await testKeyCompatibilityAcrossAllRoutes(LEGACY_JWT);
  await testFinishedMatchIntegrityAndToctou();
  await testVercelAdapters();
  testAssetIntegrityAndNoStoragePassword();
  console.log("ALL_BACKEND_INTEGRITY_TESTS_PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
