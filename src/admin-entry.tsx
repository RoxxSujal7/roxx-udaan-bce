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

const SESSION_KEY = "udaan_admin_pw";
const API_URL = "/api/admin/registrations";
const REFRESH_INTERVAL_MS = 60_000;

// ─── Storage helpers (safe try/catch) ──────────────────────────────────────

function storedPassword(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function savePassword(pw: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, pw);
  } catch {
    /* ignore */
  }
}

function clearPassword() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// ─── API call ──────────────────────────────────────────────────────────────

type FetchResult =
  | { ok: true; registrations: Registration[]; fetchedAt: string }
  | { ok: false; status: number; error: string };

async function fetchRegistrations(password: string): Promise<FetchResult> {
  try {
    const res = await fetch(API_URL, {
      headers: { Authorization: `Bearer ${password}` },
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

// ─── Login Screen ──────────────────────────────────────────────────────────

function LoginScreen({
  onLogin,
}: {
  onLogin: (pw: string, data: Registration[], fetchedAt: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    const result = await fetchRegistrations(password.trim());
    setLoading(false);
    if (result.ok) {
      savePassword(password.trim());
      onLogin(password.trim(), result.registrations, result.fetchedAt);
    } else if (result.status === 401) {
      setError("Wrong password. Please try again.");
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
  const [password, setPassword] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [fetchedAt, setFetchedAt] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [silentCheckDone, setSilentCheckDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Try stored password on load
  useEffect(() => {
    const stored = storedPassword();
    if (!stored) {
      setSilentCheckDone(true);
      return;
    }
    fetchRegistrations(stored).then((result) => {
      if (result.ok) {
        setPassword(stored);
        setRegistrations(result.registrations);
        setFetchedAt(result.fetchedAt);
      } else {
        clearPassword();
      }
      setSilentCheckDone(true);
    });
  }, []);

  // Auto-refresh every 60 s while tab is visible
  const startAutoRefresh = useCallback(
    (pw: string) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(async () => {
        if (document.hidden) return;
        const result = await fetchRegistrations(pw);
        if (result.ok) {
          setRegistrations(result.registrations);
          setFetchedAt(result.fetchedAt);
        } else if (result.status === 401) {
          clearPassword();
          setPassword(null);
          if (intervalRef.current) clearInterval(intervalRef.current);
          toast.error("Session expired. Please sign in again.");
        }
      }, REFRESH_INTERVAL_MS);
    },
    [],
  );

  useEffect(() => {
    if (password) startAutoRefresh(password);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [password, startAutoRefresh]);

  async function handleRefresh() {
    if (!password || refreshing) return;
    setRefreshing(true);
    const result = await fetchRegistrations(password);
    setRefreshing(false);
    if (result.ok) {
      setRegistrations(result.registrations);
      setFetchedAt(result.fetchedAt);
      toast.success("Refreshed.");
    } else if (result.status === 401) {
      clearPassword();
      setPassword(null);
      toast.error("Session expired. Please sign in again.");
    } else {
      toast.error(result.error || "Refresh failed.");
    }
  }

  function handleLogout() {
    clearPassword();
    setPassword(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRegistrations([]);
    setFetchedAt("");
  }

  function handleLogin(
    pw: string,
    data: Registration[],
    fetchedAtStr: string,
  ) {
    setPassword(pw);
    setRegistrations(data);
    setFetchedAt(fetchedAtStr);
    startAutoRefresh(pw);
  }

  // Show nothing while silently checking stored credentials
  if (!silentCheckDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <>
      {password ? (
        <div className="h-screen w-full overflow-auto">
          <App1
            adminPassword={password}
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
