"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Shared WebSocket client for the be_game backend (Tiến Lên, Mèo Nổ, …).
 * Handles acks, heartbeats, reconnect with backoff, the planned hand-over
 * the server asks for shortly before a Vercel function hits its time limit,
 * and failover to a backup backend (NEXT_PUBLIC_TIENLEN_FALLBACK_URL).
 */

const TOKEN_KEY = "tienlen:token";
/** One player name for every game (chosen at the games gate, shown in the games top bar). */
export const PLAYER_NAME_KEY = "games:playerName";
/** Older per-game key, migrated into PLAYER_NAME_KEY on first read. */
const LEGACY_NAME_KEYS = ["tienlen:name"];
/** Clients ping this often; the ping doubles as the presence heartbeat. */
const PING_INTERVAL_MS = 10_000;

export type Ack = { ok: true; code?: string } | { ok: false; error: string };
export type ConnectionStatus = "connecting" | "joined" | "reconnecting" | "error";

const cleanBase = (url: string | undefined) => (url ?? "").trim().replace(/\/$/, "");
/** Main be_game backend (NEXT_PUBLIC_TIENLEN_SERVER_URL, default: its local dev server). */
const PRIMARY_BASE = cleanBase(process.env.NEXT_PUBLIC_TIENLEN_SERVER_URL) || "http://localhost:4000";
/** Optional backup backend (NEXT_PUBLIC_TIENLEN_FALLBACK_URL), used while the main one does not answer. */
const FALLBACK_BASE = cleanBase(process.env.NEXT_PUBLIC_TIENLEN_FALLBACK_URL);
/** Backends in order of preference. Each keeps its own rooms and leaderboard (separate Redis). */
export const SERVER_BASES: readonly string[] =
  FALLBACK_BASE && FALLBACK_BASE !== PRIMARY_BASE ? [PRIMARY_BASE, FALLBACK_BASE] : [PRIMARY_BASE];

/** Error be_game sends when a room code does not exist on that backend. */
const ROOM_NOT_FOUND = "Không tìm thấy phòng";
const PROBE_TIMEOUT_MS = 3000;
/** How long a backend choice is reused before the main backend is asked again. */
const ACTIVE_TTL_MS = 60_000;
const CONNECT_TIMEOUT_MS = 8000;

const wsUrl = (base: string, path: string) => base.replace(/^http/, "ws") + path;

/**
 * True when the backend answers in time. Probes `/api/rooms`: it exists on every
 * deployment (on Vercel bare `/api` is not a function and 404s) and touches Redis.
 */
async function reachable(base: string): Promise<boolean> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/rooms`, { cache: "no-store", signal: abort.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let active: { base: string; at: number } | null = null;
let resolving: Promise<string> | null = null;

/**
 * Backend for new rooms and lobby lists: the first one in SERVER_BASES that answers
 * (the main one when nothing answers, so its errors show). Cached for ACTIVE_TTL_MS,
 * so traffic returns to the main backend about a minute after it comes back.
 */
export function activeServerBase(): Promise<string> {
  if (SERVER_BASES.length === 1) return Promise.resolve(PRIMARY_BASE);
  if (active && Date.now() - active.at < ACTIVE_TTL_MS) return Promise.resolve(active.base);
  return (resolving ??= (async () => {
    let base = PRIMARY_BASE;
    for (const candidate of SERVER_BASES) {
      if (await reachable(candidate)) {
        base = candidate;
        break;
      }
    }
    active = { base, at: Date.now() };
    return base;
  })().finally(() => {
    resolving = null;
  }));
}

/** Forget the cached choice after `base` failed to connect, so the next call probes again. */
function markUnreachable(base: string) {
  if (active?.base === base) active = null;
}

/** Backends to try for a room whose server is not known yet: the active one first, then the rest. */
async function candidateBases(): Promise<string[]> {
  const first = await activeServerBase();
  return [first, ...SERVER_BASES.filter((b) => b !== first)];
}

/** Which backend each room lives on (per tab), so reconnects never jump to a backend without the room. */
const ROOM_SERVERS_KEY = "games:roomServers";
let memoryRoomServers: Record<string, string> = {};
const roomKey = (wsPath: string, code: string) => `${wsPath} ${code.toUpperCase()}`;

function loadRoomServers(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(ROOM_SERVERS_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return memoryRoomServers;
  }
}

function knownRoomServer(wsPath: string, code: string): string | null {
  const base = loadRoomServers()[roomKey(wsPath, code)];
  return base && SERVER_BASES.includes(base) ? base : null;
}

function rememberRoomServer(wsPath: string, code: string, base: string) {
  if (SERVER_BASES.length === 1) return;
  const all = { ...loadRoomServers(), [roomKey(wsPath, code)]: base };
  // Keep the most recent rooms only.
  const trimmed = Object.fromEntries(Object.entries(all).slice(-30));
  memoryRoomServers = trimmed;
  try {
    sessionStorage.setItem(ROOM_SERVERS_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage unavailable — kept in memory for this tab */
  }
}

/**
 * Identical GETs started within this window share one request: on a lobby page the game's lobby and
 * the all-rooms panel poll the same `/rooms` endpoint, and every request costs the backend Redis reads.
 */
const SHARED_GET_MS = 4_000;
const sharedGets = new Map<string, { at: number; promise: Promise<unknown> }>();

/** GET a JSON endpoint (rooms list, leaderboard) of the active backend. */
export function fetchApi<T>(path: string): Promise<T> {
  const now = Date.now();
  const hit = sharedGets.get(path);
  if (hit && now - hit.at < SHARED_GET_MS) return hit.promise as Promise<T>;
  const promise = (async () => {
    const base = await activeServerBase();
    let res: Response;
    try {
      res = await fetch(base + path, { cache: "no-store" });
    } catch (err) {
      markUnreachable(base);
      throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  })();
  sharedGets.set(path, { at: now, promise });
  // A failed request is not shared: the next caller retries.
  promise.catch(() => {
    if (sharedGets.get(path)?.promise === promise) sharedGets.delete(path);
  });
  return promise;
}

/** Runs `load` now, every `ms` while the tab is visible, and right away when the tab becomes visible again. */
export function pollWhileVisible(load: () => void, ms: number): () => void {
  load();
  const id = setInterval(() => {
    if (document.visibilityState === "visible") load();
  }, ms);
  const onVisible = () => {
    if (document.visibilityState === "visible") load();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

const randomToken = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join("");

/**
 * Secret reconnect token, shared by every tab of this browser (localStorage): a reload, closing the
 * tab or opening the invite link again all come back to the same seat. A second tab in the same room
 * is the same player; another browser or a private window plays as someone else. A token from the
 * older per-tab storage (sessionStorage) is carried over so seats taken before keep working.
 */
let memoryToken: string | null = null;
export function getToken(): string {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = sessionStorage.getItem(TOKEN_KEY) || randomToken();
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch {
    return (memoryToken ??= randomToken());
  }
}

let cachedName: string | null = null;
const nameListeners = new Set<() => void>();

function loadName(): string {
  try {
    const saved = localStorage.getItem(PLAYER_NAME_KEY);
    if (saved !== null) return saved.trim();
    for (const key of LEGACY_NAME_KEYS) {
      const old = localStorage.getItem(key)?.trim();
      if (old) {
        localStorage.setItem(PLAYER_NAME_KEY, old);
        localStorage.removeItem(key);
        return old;
      }
    }
  } catch {
    /* storage unavailable — fall through to "no name yet" */
  }
  return "";
}

/** The player's name for every game ("" when none has been chosen yet). */
export function getSavedName(): string {
  return (cachedName ??= loadName());
}

export function saveName(name: string) {
  cachedName = name.trim();
  try {
    localStorage.setItem(PLAYER_NAME_KEY, cachedName);
  } catch {
    /* storage unavailable — the name lasts until the tab closes */
  }
  nameListeners.forEach((l) => l());
}

function subscribeName(listener: () => void) {
  nameListeners.add(listener);
  // Another tab renamed the player.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PLAYER_NAME_KEY) return;
    cachedName = (e.newValue ?? "").trim();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    nameListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Live player name: `null` until read on the client (and during SSR), then the saved name ("" = none). */
export function usePlayerName(): string | null {
  return useSyncExternalStore(subscribeName, getSavedName, () => null);
}

type ServerMessage = ({ type: "ack"; id: number } & Ack) | { type: "state"; view: unknown } | { type: "reconnect" } | { type: "pong" };

/** One WebSocket with request/ack bookkeeping. */
class Channel {
  readonly ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, (res: Ack) => void>();
  onMessage: (msg: ServerMessage) => void = () => {};
  onClose: () => void = () => {};

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (msg.type === "ack") {
        // The ack carries the Ack fields (plus harmless `type`/`id`).
        this.pending.get(msg.id)?.(msg as Ack);
        this.pending.delete(msg.id);
      } else {
        this.onMessage(msg);
      }
    };
    this.ws.onclose = () => {
      this.pending.forEach((resolve) => resolve({ ok: false, error: "Mất kết nối máy chủ" }));
      this.pending.clear();
      this.onClose();
    };
  }

  opened(timeoutMs = 10_000): Promise<boolean> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      this.ws.addEventListener("open", () => (clearTimeout(timer), resolve(true)), { once: true });
      this.ws.addEventListener("close", () => (clearTimeout(timer), resolve(false)), { once: true });
    });
  }

  request(msg: Record<string, unknown> & { type: string }, timeoutMs = 10_000): Promise<Ack> {
    if (this.ws.readyState !== WebSocket.OPEN) return Promise.resolve({ ok: false, error: "Mất kết nối máy chủ" });
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: "Máy chủ không phản hồi" });
      }, timeoutMs);
      this.pending.set(id, (res) => {
        clearTimeout(timer);
        resolve(res);
      });
      this.ws.send(JSON.stringify({ ...msg, id }));
    });
  }

  ping() {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: "ping" }));
  }

  close() {
    this.onClose = () => {};
    this.ws.close(1000);
  }
}

/**
 * Ask a backend for a new room code using a short-lived connection: the active
 * backend first, the next one when it cannot be reached. Remembers where the room lives.
 */
export async function createGameRoom(wsPath: string): Promise<string> {
  for (const base of await candidateBases()) {
    const ch = new Channel(wsUrl(base, wsPath));
    try {
      if (!(await ch.opened(CONNECT_TIMEOUT_MS))) {
        markUnreachable(base);
        continue;
      }
      const res = await ch.request({ type: "create" });
      if (!res.ok) throw new Error(res.error);
      if (!res.code) throw new Error("Không tạo được phòng");
      rememberRoomServer(wsPath, res.code, base);
      return res.code;
    } finally {
      ch.close();
    }
  }
  throw new Error("Không kết nối được máy chủ game");
}

export type Call = (msg: Record<string, unknown> & { type: string }) => Promise<Ack>;

/**
 * Join (or watch) a room over `wsPath` and keep its latest view.
 * `localize` can shift server-clock deadlines onto the local clock.
 */
export function useGameRoom<V>(
  wsPath: string,
  code: string,
  name: string | null,
  mode: "play" | "watch" = "play",
  localize: (view: V) => V = (v) => v,
) {
  const [view, setView] = useState<V | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<Channel | null>(null);
  const localizeRef = useRef(localize);
  localizeRef.current = localize;

  useEffect(() => {
    if (!name) return;
    let disposed = false;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const token = getToken();
    /** Backend this room lives on once known. Reconnects stay on it: the other backend has no such room. */
    let roomBase = knownRoomServer(wsPath, code);

    /** Connect to one backend and join (or watch) the room there. */
    const tryJoin = async (base: string): Promise<Channel | "unreachable" | "not-found" | { error: string }> => {
      const ch = new Channel(wsUrl(base, wsPath));
      ch.onMessage = (msg) => {
        if (msg.type === "state") {
          setRoomLooks((msg.view as { looks?: Record<string, PlayerProfile> }).looks);
          setView(localizeRef.current(msg.view as V));
        }
        else if (msg.type === "reconnect" && channelRef.current === ch) void open();
      };
      ch.onClose = () => {
        if (disposed || channelRef.current !== ch) return;
        channelRef.current = null;
        setStatus((s) => (s === "error" ? s : "reconnecting"));
        scheduleRetry();
      };

      if (!(await ch.opened(CONNECT_TIMEOUT_MS))) {
        ch.close();
        return "unreachable";
      }
      const res = await ch.request({ type: mode === "watch" ? "watch" : "join", code, name, token, look: getSavedProfile() });
      if (res.ok) return ch;
      ch.close();
      return res.error === ROOM_NOT_FOUND ? "not-found" : { error: res.error };
    };

    /**
     * Open a channel and join. Used for the first connection, after drops, and
     * for a planned hand-over (`reconnect` from the server before the platform
     * cuts the connection): the new channel joins before the old one closes.
     * While the room's backend is unknown (a shared link), each backend is tried in turn.
     */
    const open = async () => {
      if (disposed) return;
      const bases = roomBase ? [roomBase] : await candidateBases();
      let unreachable = false;
      for (const base of bases) {
        const outcome = await tryJoin(base);
        if (disposed) {
          if (outcome instanceof Channel) outcome.close();
          return;
        }
        if (outcome === "unreachable") {
          unreachable = true;
          if (!roomBase) markUnreachable(base);
          continue;
        }
        if (outcome === "not-found") continue;
        if (!(outcome instanceof Channel)) {
          setStatus("error");
          setError(outcome.error);
          return;
        }
        roomBase = base;
        rememberRoomServer(wsPath, code, base);
        const previous = channelRef.current;
        channelRef.current = outcome;
        previous?.close();
        retry = 0;
        setStatus("joined");
        setError(null);
        return;
      }
      if (unreachable) {
        // The room may live on the backend that is down: keep retrying.
        if (!channelRef.current) {
          setStatus((s) => (s === "joined" ? "reconnecting" : s));
          scheduleRetry();
        }
        return;
      }
      setStatus("error");
      setError(ROOM_NOT_FOUND);
    };

    const scheduleRetry = () => {
      if (disposed || retryTimer) return;
      const delay = Math.min(500 * 2 ** retry++, 8000);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void open();
      }, delay);
    };

    const pinger = setInterval(() => channelRef.current?.ping(), PING_INTERVAL_MS);
    // Come back fast when the tab regains focus or the network returns.
    const wake = () => {
      if (!channelRef.current && !retryTimer) void open();
    };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);

    void open();

    return () => {
      disposed = true;
      clearInterval(pinger);
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      const ch = channelRef.current;
      channelRef.current = null;
      if (ch) void ch.request({ type: "leave" }, 1500).finally(() => ch.close());
    };
  }, [wsPath, code, name, mode]);

  const call: Call = useCallback((msg) => {
    const ch = channelRef.current;
    return ch ? ch.request(msg) : Promise.resolve<Ack>({ ok: false, error: "Mất kết nối máy chủ" });
  }, []);

  // Changing icon/colour at the table reaches everyone at once (the name stays frozen until the next table).
  useEffect(() => {
    if (!name) return;
    return subscribeProfile(() => {
      void channelRef.current?.request({ type: "look", look: getSavedProfile() });
    });
  }, [name]);

  return { view, status, error, call };
}

/** Player look (icon + colour) shown next to the name. Stored per browser; shared with other players once be_game relays it. */
export interface PlayerProfile {
  icon: string;
  color: string;
}
/** Avatar icons: a whole row of cats first (several breeds and moods), then the rest. */
export const PROFILE_ICONS = ["🐱", "🐈", "🐈‍⬛", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🐆", "🦁", "😀", "😎", "🤠", "🐶", "🦊", "🐼", "🐯", "🦄", "🐲", "🐴", "👑", "🎩", "💎", "🔥", "⭐"];
export const PROFILE_COLORS = ["#fbbf24", "#f87171", "#fb923c", "#a3e635", "#34d399", "#22d3ee", "#60a5fa", "#a78bfa", "#f472b6", "#e5e7eb"];
export const DEFAULT_PROFILE: PlayerProfile = { icon: "", color: PROFILE_COLORS[0] };
const PROFILE_KEY = "games:playerProfile";

let cachedProfile: PlayerProfile | null = null;
const profileListeners = new Set<() => void>();

const validProfile = (p: Partial<PlayerProfile> | null): PlayerProfile => ({
  icon: p && typeof p.icon === "string" && (PROFILE_ICONS.includes(p.icon) || p.icon === "") ? p.icon : DEFAULT_PROFILE.icon,
  color: p && typeof p.color === "string" && PROFILE_COLORS.includes(p.color) ? p.color : DEFAULT_PROFILE.color,
});

export function getSavedProfile(): PlayerProfile {
  if (cachedProfile) return cachedProfile;
  let raw: Partial<PlayerProfile> | null = null;
  try {
    raw = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null");
  } catch {
    /* storage unavailable or corrupt — default look */
  }
  return (cachedProfile = validProfile(raw));
}

export function saveProfile(profile: PlayerProfile) {
  cachedProfile = validProfile(profile);
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(cachedProfile));
  } catch {
    /* lasts until the tab closes */
  }
  profileListeners.forEach((l) => l());
}

function subscribeProfile(listener: () => void) {
  profileListeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PROFILE_KEY) return;
    cachedProfile = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    profileListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Live player look; the default during SSR. */
export function usePlayerProfile(): PlayerProfile {
  return useSyncExternalStore(subscribeProfile, getSavedProfile, () => DEFAULT_PROFILE);
}

/** Looks of everyone at the current table, by player name (relayed by be_game in each state view). */
let roomLooks: Record<string, PlayerProfile> = {};
const roomLookListeners = new Set<() => void>();

function setRoomLooks(next: Record<string, PlayerProfile> | undefined) {
  const clean = next ?? {};
  if (JSON.stringify(clean) === JSON.stringify(roomLooks)) return;
  roomLooks = clean;
  roomLookListeners.forEach((l) => l());
}

/** The look a player picked, or null when they have none (older client / not in the room). */
export function useLookOf(name: string): PlayerProfile | null {
  return useSyncExternalStore(
    (l) => {
      roomLookListeners.add(l);
      return () => void roomLookListeners.delete(l);
    },
    () => roomLooks[name] ?? null,
    () => null,
  );
}

/** Looks of everyone at the current table by name; re-renders when a state view changes them. */
export function useRoomLooks(): Record<string, PlayerProfile> {
  return useSyncExternalStore(
    (l) => {
      roomLookListeners.add(l);
      return () => void roomLookListeners.delete(l);
    },
    () => roomLooks,
    () => EMPTY_LOOKS,
  );
}
const EMPTY_LOOKS: Record<string, PlayerProfile> = {};
