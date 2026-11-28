"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App1 } from "@/components/ui/app-1";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Registration } from "@/components/ui/app-1-utils/app-1-data";

const API_URL = "/api/admin/registrations";
const LOGIN_URL = "/api/admin/login";
const LOGOUT_URL = "/api/admin/logout";
const REFRESH_INTERVAL_MS = 60_000;

// ─── API calls (HttpOnly cookie session — never stored in Web Storage) ─────

type FetchResult =
  | { ok: true; registrations: Registration[]; fetchedAt: string }
  | { ok: false; status: number; error: string };

async function fetchRegistrations(): Promise<FetchResult> {
  try {
    const res = await fetch(API_URL, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const json = (await res.json()) as {
      ok: boolean;
      registrations?: Registration[];
      fetchedAt?: string;
      error?: string;
    };
    if (res.ok && json.ok && json.registrations) {
      return {
        ok: true,
        registrations: json.registrations,
        fetchedAt: json.fetchedAt ?? new Date().toISOString(),
      };
    }
    return {
      ok: false,
      status: res.status,
      error: json.error ?? "Unknown error.",
    };
  } catch {
    return { ok: false, status: 0, error: "Network error. Check connection." };
  }
}

async function loginWithPassword(
  password: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      cache: "no-store",
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (res.ok && json.ok) return { ok: true };
    return {
      ok: false,
      status: res.status,
      error: json.error ?? "Login failed.",
    };
  } catch {
    return { ok: false, status: 0, error: "Network error. Check connection." };
  }
}

// ─── Login Screen ──────────────────────────────────────────────────────────

function LoginScreen({
  onLogin,
}: {
  onLogin: (data: Registration[], fetchedAt: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    const loginRes = await loginWithPassword(password.trim());
    if (!loginRes.ok) {
      setLoading(false);
      if (loginRes.status === 401) {
        setError("Wrong password. Please try again.");
      } else if (loginRes.status === 429) {
        setError("Too many attempts. Please wait 15 minutes and try again.");
      } else if (loginRes.status === 503) {
        setError("Admin access is not configured on the server.");
      } else {
        setError(loginRes.error || "Login failed. Please try again.");
      }
      return;
    }

    const result = await fetchRegistrations();
    setLoading(false);
    if (result.ok) {
      setPassword("");
      onLogin(result.registrations, result.fetchedAt);
    } else if (result.status === 401) {
      setError("Session could not be established. Please try again.");
    } else if (result.status === 503) {
      setError("Admin access is not configured on the server.");
    } else {
      setError(result.error || "Login failed. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex items-center justify-center">
            <img
              src="../Assets/Logo.png"
              alt="UDAAN 2026"
              className="h-14 w-14 object-contain"
            />
          </div>
          <CardTitle className="text-xl">UDAAN 2026</CardTitle>
          <CardDescription>Admin dashboard — organizers only</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              disabled={loading}
            />
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading || !password.trim()}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── App Shell ─────────────────────────────────────────────────────────────

function AdminApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [fetchedAt, setFetchedAt] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [silentCheckDone, setSilentCheckDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check existing HttpOnly session cookie on load
  useEffect(() => {
    fetchRegistrations().then((result) => {
      if (result.ok) {
        setAuthenticated(true);
        setRegistrations(result.registrations);
        setFetchedAt(result.fetchedAt);
      }
      setSilentCheckDone(true);
    });
  }, []);

  // Auto-refresh every 60 s while tab is visible
  const startAutoRefresh = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      if (document.hidden) return;
      const result = await fetchRegistrations();
      if (result.ok) {
        setRegistrations(result.registrations);
        setFetchedAt(result.fetchedAt);
      } else if (result.status === 401) {
        setAuthenticated(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        toast.error("Session expired. Please sign in again.");
      }
    }, REFRESH_INTERVAL_MS);
  }, []);

  useEffect(() => {
    if (authenticated) startAutoRefresh();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [authenticated, startAutoRefresh]);

  async function handleRefresh() {
    if (!authenticated || refreshing) return;
    setRefreshing(true);
    const result = await fetchRegistrations();
    setRefreshing(false);
    if (result.ok) {
      setRegistrations(result.registrations);
      setFetchedAt(result.fetchedAt);
      toast.success("Refreshed.");
    } else if (result.status === 401) {
      setAuthenticated(false);
      toast.error("Session expired. Please sign in again.");
    } else {
      toast.error(result.error || "Refresh failed.");
    }
  }

  async function handleLogout() {
    try {
      await fetch(LOGOUT_URL, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      /* ignore */
    }
    setAuthenticated(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRegistrations([]);
    setFetchedAt("");
  }

  function handleLogin(data: Registration[], fetchedAtStr: string) {
    setAuthenticated(true);
    setRegistrations(data);
    setFetchedAt(fetchedAtStr);
    startAutoRefresh();
  }

  // Show nothing while silently checking existing session cookie
  if (!silentCheckDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <>
      {authenticated ? (
        <div className="h-screen w-full overflow-auto">
          <App1
            registrations={registrations}
            fetchedAt={fetchedAt}
            onRefresh={handleRefresh}
            onLogout={handleLogout}
            refreshing={refreshing}
          />
        </div>
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
      <Toaster richColors position="bottom-right" />
    </>
  );
}

// ─── Dark mode sync ────────────────────────────────────────────────────────
function syncDarkMode() {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    document.documentElement.classList.toggle("dark", mql.matches);
  };
  apply();
  mql.addEventListener("change", apply);
}
syncDarkMode();

// ─── Mount ─────────────────────────────────────────────────────────────────

const rootEl = document.getElementById("admin-root");
if (rootEl) {
  createRoot(rootEl).render(
    <TooltipProvider>
      <AdminApp />
    </TooltipProvider>,
  );
}
