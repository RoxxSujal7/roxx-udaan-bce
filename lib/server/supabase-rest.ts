// Shared server-side Supabase REST helper for Cloudflare Pages Functions.

import { normalizeSecretEnv, type AdminEnv } from "./admin-auth";

export interface SupabaseConfig {
  url: string;
  secretKey: string;
}

export function getSupabaseConfig(env: AdminEnv): SupabaseConfig | null {
  const rawUrl = normalizeSecretEnv(env.SUPABASE_URL);
  const url = rawUrl
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "")
    .replace(/\/+$/, "");
  const secretKey = normalizeSecretEnv(env.SUPABASE_SECRET_KEY);
  if (!url || !secretKey) return null;
  return { url, secretKey };
}

/**
 * Logs non-OK Supabase REST responses without ever printing keys or headers.
 */
export async function logSupabaseError(
  route: string,
  response: Response,
): Promise<void> {
  const body = (await response.clone().text().catch(() => "")).slice(0, 300);
  console.error("[supabase]", route, response.status, body);
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
