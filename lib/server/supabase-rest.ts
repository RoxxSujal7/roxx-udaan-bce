// Shared server-side Supabase REST helper for Cloudflare Pages Functions.

import type { AdminEnv } from "./admin-auth";

export interface SupabaseConfig {
  url: string;
  secretKey: string;
}

export function getSupabaseConfig(env: AdminEnv): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) return null;
  return { url, secretKey };
}

export async function supabaseFetch(
  cfg: SupabaseConfig,
  pathAndQuery: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("apikey", cfg.secretKey);
  headers.set("Authorization", `Bearer ${cfg.secretKey}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${cfg.url}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers,
  });
}
