// Server-side ntfy.sh JSON push helper for Cloudflare Pages Functions.
// Reads NTFY_TOKEN only from server env; never expose NTFY_TOKEN to clients or logs.

export type PushOutcome = "sent" | "skipped" | "failed";

export interface NtfyEnv {
  NTFY_ENABLED?: string;
  NTFY_TOPIC?: string;
  NTFY_TOKEN?: string;
  NTFY_SERVER?: string;
}

export interface PushPayload {
  title: string;
  message: string;
  priority: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  click: string;
}

const TIMEOUT_MS = 4_000;
const MAX_TITLE_LEN = 80;
const MAX_MESSAGE_LEN = 280;

/** Build the absolute Live page URL from the incoming request origin so previews link to themselves. */
export function buildLiveClickUrl(requestUrl: string): string {
  try {
    const origin = new URL(requestUrl).origin;
    return `${origin}/Templates/live`;
  } catch {
    return "https://roxx-udaan-bce.pages.dev/Templates/live";
  }
}

/**
 * Best-effort JSON push to ntfy. Never throws; logs only the HTTP status code.
 * Skips silently when NTFY_ENABLED !== "true" or NTFY_TOPIC is missing.
 */
export async function publishPush(
  env: NtfyEnv,
  payload: PushPayload,
): Promise<PushOutcome> {
  if (env.NTFY_ENABLED?.trim() !== "true") {
    return "skipped";
  }
  const topic = env.NTFY_TOPIC?.trim();
  if (!topic) {
    return "skipped";
  }

  const server = (env.NTFY_SERVER?.trim() || "https://ntfy.sh").replace(
    /\/+$/,
    "",
  );
  const token = env.NTFY_TOKEN?.trim();

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
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
    click: payload.click,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${server}/`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
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
