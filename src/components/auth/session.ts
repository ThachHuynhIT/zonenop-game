"use client";

import { useSyncExternalStore } from "react";
import { SERVER_BASES, activeServerBase } from "../games/gameClient";

export interface PublicUser {
  id: string;
  username: string;
  role: "user" | "admin";
  icon: string;
  color: string;
}
export interface StoredSession {
  session: string;
  user: PublicUser;
}

/** localStorage: JSON {session, user}. */
export const SESSION_KEY = "games:session";

let cached: { raw: string | null; value: StoredSession | null } | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredSession> | null;
    const u = v?.user;
    if (!v || typeof v.session !== "string" || !v.session || !u || typeof u.id !== "string" || typeof u.username !== "string") return null;
    return { session: v.session, user: u };
  } catch {
    return null;
  }
}

// Used when storage is blocked: the session lasts until the tab closes.
let memory: string | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return memory;
  }
}

export function getSession(): StoredSession | null {
  const raw = readRaw();
  if (cached && cached.raw === raw) return cached.value;
  cached = { raw, value: parse(raw) };
  return cached.value;
}

function notify() {
  listeners.forEach((l) => l());
}

export function saveSession(s: StoredSession): void {
  const raw = JSON.stringify({ session: s.session, user: s.user });
  memory = raw;
  try {
    localStorage.setItem(SESSION_KEY, raw);
  } catch {
    /* kept in memory */
  }
  notify();
}

export function clearSession(): void {
  memory = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SESSION_KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Live session; null during SSR. */
export function useSession(): StoredSession | null {
  return useSyncExternalStore(subscribeSession, getSession, () => null);
}

export type AuthResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const NETWORK_ERROR = "Không kết nối được máy chủ";

/** Call an auth/admin endpoint with the session (when there is one). Tries the active backend, then the others on network errors. */
export async function authRequest<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<AuthResult<T>> {
  const first = await activeServerBase();
  const bases = [first, ...SERVER_BASES.filter((b) => b !== first)];
  const sent = getSession();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (sent) headers.Authorization = `Bearer ${sent.session}`;
  for (const base of bases) {
    let res: Response;
    try {
      res = await fetch(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      continue;
    }
    let json: Record<string, unknown> | null = null;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      /* no JSON body */
    }
    if (res.status === 401 && sent && getSession()?.session === sent.session) clearSession();
    if (res.ok && json && json.ok !== false) return { ok: true, data: json as T };
    const error = json && typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
    return { ok: false, status: res.status, error };
  }
  return { ok: false, status: 0, error: NETWORK_ERROR };
}

/** Re-read the user from the server (role/look may have changed); signs out when the session is no longer valid. */
export async function refreshMe(): Promise<void> {
  const current = getSession();
  if (!current) return;
  const res = await authRequest<{ user: PublicUser }>("GET", "/api/auth/me");
  // Skip when the user signed out or in as someone else while the request was in flight.
  const now = getSession();
  if (res.ok && now?.session === current.session && now.user === current.user) saveSession({ session: current.session, user: res.data.user });
}

/** Save my icon and colour on the account and refresh the stored user (the table hears it on the next join). */
export async function updateLook(look: { icon: string; color: string }): Promise<AuthResult<{ user: PublicUser }>> {
  const sent = getSession();
  const res = await authRequest<{ user: PublicUser }>("PATCH", "/api/auth/me", { icon: look.icon, color: look.color });
  if (res.ok && sent && getSession()?.session === sent.session) saveSession({ session: sent.session, user: res.data.user });
  return res;
}
