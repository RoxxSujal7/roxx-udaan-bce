// Thin adapter allowing Vercel Functions (api/**) to reuse the exact
// Cloudflare Pages Function handlers (functions/api/**) without duplicating logic.

import type { AdminEnv } from "./admin-auth";
import type { NtfyEnv } from "./ntfy";

export type AppEnv = AdminEnv & NtfyEnv;

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

export function callPagesHandler(
  fn: (ctx: { request: Request; env: AppEnv }) => Promise<Response>,
  request: Request,
): Promise<Response> {
  return fn({ request, env: getVercelEnv() });
}
