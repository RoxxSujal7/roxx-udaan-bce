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

/**
 * Builds Supabase REST auth headers for both modern `sb_secret_` keys
 * (apikey-only, never sent as Bearer JWT) and legacy JWT `service_role` keys.
 */
export function buildSupabaseAuthHeaders(
  secretKey: string,
  extra?: HeadersInit,
): Headers {
  const headers = new Headers(extra);
  headers.set("apikey", secretKey);
  if (secretKey.startsWith("sb_secret_")) {
    headers.delete("Authorization");
  } else {
    headers.set("Authorization", `Bearer ${secretKey}`);
  }
  return headers;
}

export async function supabaseFetch(
  cfg: SupabaseConfig,
  pathAndQuery: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = buildSupabaseAuthHeaders(cfg.secretKey, init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${cfg.url}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers,
  });
}
