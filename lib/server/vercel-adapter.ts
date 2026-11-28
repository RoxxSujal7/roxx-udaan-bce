// Thin adapter allowing Vercel Node.js Serverless Functions (api/**) to reuse
// the exact Cloudflare Pages Function handlers (functions/api/**) without duplicating logic.

import type { AdminEnv } from "./admin-auth";
import type { NtfyEnv } from "./ntfy";

export type AppEnv = AdminEnv & NtfyEnv;

interface NodeReq {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  rawBody?: Uint8Array | string;
  readableEnded?: boolean;
  [Symbol.asyncIterator](): AsyncIterator<Uint8Array>;
}

interface NodeRes {
  statusCode: number;
  setHeader(name: string, value: string | string[]): void;
  end(chunk?: Uint8Array | string): void;
}

export function getVercelEnv(): AppEnv {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process;
  const e = proc?.env ?? {};
  return {
    ADMIN_PASSWORD: e.ADMIN_PASSWORD,
    ADMIN_SESSION_SECRET: e.ADMIN_SESSION_SECRET,
    SUPABASE_URL: e.SUPABASE_URL,
    SUPABASE_SECRET_KEY: e.SUPABASE_SECRET_KEY,
    NTFY_ENABLED: e.NTFY_ENABLED,
    NTFY_TOPIC: e.NTFY_TOPIC,
    NTFY_TOKEN: e.NTFY_TOKEN,
    NTFY_SERVER: e.NTFY_SERVER,
  };
}

export async function nodeReqToWebRequest(req: NodeReq): Promise<Request> {
  const host =
    (Array.isArray(req.headers["x-forwarded-host"])
      ? req.headers["x-forwarded-host"][0]
      : req.headers["x-forwarded-host"]) ||
    (Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host) ||
    "localhost";
  const proto =
    (Array.isArray(req.headers["x-forwarded-proto"])
      ? req.headers["x-forwarded-proto"][0]
      : req.headers["x-forwarded-proto"]) || "https";
  const reqPath = req.url || "/";
  const fullUrl = reqPath.startsWith("http") ? reqPath : `${proto}://${host}${reqPath}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const item of v) headers.append(k, item);
    } else {
      headers.set(k, v);
    }
  }

  const method = (req.method || "GET").toUpperCase();
  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (req.rawBody !== undefined) {
      body =
        typeof req.rawBody === "string"
          ? req.rawBody
          : Uint8Array.from(req.rawBody);
    } else if (req.readableEnded && req.body !== undefined) {
      body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    } else {
      const chunks: Uint8Array[] = [];
      let total = 0;
      for await (const chunk of req) {
        const buf =
          typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
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

export async function sendWebResponse(
  webRes: Response,
  res: NodeRes,
): Promise<void> {
  res.statusCode = webRes.status;
  const setCookies =
    typeof (webRes.headers as unknown as { getSetCookie?: () => string[] })
      .getSetCookie === "function"
      ? (webRes.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [];
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

export function toVercelHandler(
  fn: (ctx: { request: Request; env: AppEnv }) => Promise<Response>,
): (req: NodeReq, res: NodeRes) => Promise<void> {
  return async (req: NodeReq, res: NodeRes) => {
    const request = await nodeReqToWebRequest(req);
    const webRes = await fn({ request, env: getVercelEnv() });
    await sendWebResponse(webRes, res);
  };
}
