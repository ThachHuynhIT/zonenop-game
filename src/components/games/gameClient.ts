"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getDeviceId } from "../auth/device";
import { clearSession, getSession, setSignOutReason, signOutMessage, subscribeSession, type SignOutReason } from "../auth/session";

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

/** Ack error be_game sends when the session is missing or no longer valid. */
const NEED_LOGIN = "Cần đăng nhập";
/** Error be_game sends when a room code does not exist on that backend. */
const ROOM_NOT_FOUND = "Không tìm thấy phòng";
/** Ack error Channel.request resolves with when the server does not answer in time. */
const REQUEST_TIMEOUT_ERROR = "Máy chủ không phản hồi";
const DISCONNECTED_ERROR = "Mất kết nối máy chủ";
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

/**
 * Backends to try for a room: the one it was joined on first, then the others. With a store shared by both backends a
 * room survives its backend going down, so a dead pinned backend falls through to the next; with separate stores the
 * other backend answers "Không tìm thấy phòng" and the loop goes back to waiting for the pinned one.
 */
export function basesToTry(roomBase: string | null, candidates: readonly string[]): string[] {
  if (!roomBase || !candidates.includes(roomBase)) return [...candidates];
  return [roomBase, ...candidates.filter((b) => b !== roomBase)];
}

/** What one attempt to join a room on one backend came to. */
export type JoinOutcome<C> =
  | { kind: "joined"; channel: C }
  | { kind: "unreachable" }
  | { kind: "not-found" }
  | { kind: "error"; error: string }
  | { kind: "cancelled" };

/** What open() does once the backends have been tried. */
export type JoinStep<C> =
  | { kind: "join"; base: string; channel: C }
  | { kind: "retry" }
  | { kind: "error"; error: string }
  | { kind: "keep" }
  | { kind: "cancelled" };

/**
 * Outcome of a failed join/watch ack. A request that times out counts as unreachable: a backend that accepts the
 * socket but cannot reach its store hangs, and the player should move on to the other backend. Every other server
 * error (room full, wrong name, …) is terminal.
 */
export function failedJoinOutcome(error: string): JoinOutcome<never> {
  if (error === ROOM_NOT_FOUND) return { kind: "not-found" };
  // No answer, or the socket dropped mid-join (backend died): try the other backend.
  if (error === REQUEST_TIMEOUT_ERROR || error === DISCONNECTED_ERROR) return { kind: "unreachable" };
  return { kind: "error", error };
}

/**
 * Try `bases` in order until one settles the join, then say what to do:
 * - joined: join on that backend (the others are not tried);
 * - the room's own backend (`roomBase`) says not found: the room is gone, so an error (the others are not tried);
 * - any other server error: show it;
 * - nothing joinable but a backend was unreachable: the room may live there, so retry. When `hasChannel()` is true
 *   (a planned hand-over still has its old channel) the old channel stays and no retry is needed;
 * - every backend answered "not found": the room does not exist.
 */
export async function resolveJoin<C>(
  bases: readonly string[],
  roomBase: string | null,
  hasChannel: () => boolean,
  attempt: (base: string) => Promise<JoinOutcome<C>>,
): Promise<JoinStep<C>> {
  let unreachable = false;
  for (const base of bases) {
    const outcome = await attempt(base);
    switch (outcome.kind) {
      case "joined":
        return { kind: "join", base, channel: outcome.channel };
      case "cancelled":
      case "error":
        return outcome;
      case "unreachable":
        unreachable = true;
        break;
      case "not-found":
        if (base === roomBase) return { kind: "error", error: ROOM_NOT_FOUND };
        break;
    }
  }
  if (unreachable) return hasChannel() ? { kind: "keep" } : { kind: "retry" };
  return { kind: "error", error: ROOM_NOT_FOUND };
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

/**
 * GET a public JSON endpoint (rooms list, leaderboard) of the active backend. Sends no Authorization header on
 * purpose: a header would force a CORS preflight on every poll, and an older backend would fail it.
 */
export function fetchApi<T>(path: string): Promise<T> {
  const now = Date.now();
  const sess = getSession()?.session;
  const key = sess ? `${path}\n${sess}` : path;
  const hit = sharedGets.get(key);
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
  sharedGets.set(key, { at: now, promise });
  // A failed request is not shared: the next caller retries.
  promise.catch(() => {
    if (sharedGets.get(key)?.promise === promise) sharedGets.delete(key);
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
 * is the same player; on another device the account takes its seat back. A token from the
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
  // Signed in: the account's username is the name at every table.
  const account = getSession()?.user.username;
  if (account) return account;
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
  const offSession = subscribeSession(listener); // signing in/out changes the name
  return () => {
    offSession();
    nameListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Live player name: `null` until read on the client (and during SSR), then the saved name ("" = none). */
export function usePlayerName(): string | null {
  return useSyncExternalStore(subscribeName, getSavedName, () => null);
}

type ServerMessage = ({ type: "ack"; id: number } & Ack) | { type: "state"; view: unknown } | { type: "reconnect" } | { type: "pong" } | { type: "signedOut"; reason: "replaced" | "revoked" };

/** A delayed room event must never erase a session obtained by a newer sign-in. */
export function signOutGameSession(session: string | undefined, reason: SignOutReason): boolean {
  if (!session || getSession()?.session !== session) return false;
  setSignOutReason(reason);
  clearSession();
  return true;
}

/** This browser holds a session other than the one a socket joined with (it signed in again, or changed the password). */
export function hasNewerSession(sent: string | undefined): boolean {
  const current = getSession()?.session;
  return !!current && current !== sent;
}

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
      this.pending.forEach((resolve) => resolve({ ok: false, error: DISCONNECTED_ERROR }));
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
    if (this.ws.readyState !== WebSocket.OPEN) return Promise.resolve({ ok: false, error: DISCONNECTED_ERROR });
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: REQUEST_TIMEOUT_ERROR });
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
  onSignedOut?: () => void,
) {
  const [view, setView] = useState<V | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<Channel | null>(null);
  const localizeRef = useRef(localize);
  localizeRef.current = localize;
  const signedOutRef = useRef(onSignedOut);
  signedOutRef.current = onSignedOut;

  useEffect(() => {
    if (!name) return;
    let disposed = false;
    let stopped = false;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const token = getToken();
    /** Backend this room lives on once known. Reconnects try it first, then the others (see basesToTry). */
    let roomBase = knownRoomServer(wsPath, code);

    /** Connect to one backend and join (or watch) the room there. */
    const tryJoin = async (base: string): Promise<JoinOutcome<Channel>> => {
      if (disposed || stopped) return { kind: "cancelled" };
      const ch = new Channel(wsUrl(base, wsPath));
      const sentSession = getSession()?.session;
      ch.onMessage = (msg) => {
        if (disposed || stopped) return;
        if (msg.type === "signedOut") {
          // Revoked by this browser's own newer session (e.g. a password change at the table): join again with it.
          if (hasNewerSession(sentSession)) {
            const current = channelRef.current === ch;
            ch.close();
            if (current) {
              channelRef.current = null;
              setStatus("reconnecting");
              void open();
            }
            return;
          }
          stopped = true;
          if (retryTimer) clearTimeout(retryTimer);
          setStatus("error");
          setError(signOutMessage(msg.reason));
          if (signOutGameSession(sentSession, msg.reason)) signedOutRef.current?.();
          return;
        }
        if (msg.type === "state") {
          setRoomLooks((msg.view as { looks?: Record<string, PlayerProfile> }).looks);
          setView(localizeRef.current(msg.view as V));
        }
        else if (msg.type === "reconnect" && channelRef.current === ch) void open();
      };
      ch.onClose = () => {
        if (disposed || stopped || channelRef.current !== ch) return;
        channelRef.current = null;
        setStatus((s) => (s === "error" ? s : "reconnecting"));
        scheduleRetry();
      };

      if (!(await ch.opened(CONNECT_TIMEOUT_MS))) {
        ch.close();
        return { kind: "unreachable" };
      }
      if (disposed || stopped) {
        ch.close();
        return { kind: "cancelled" };
      }
      const res = await ch.request({
        type: mode === "watch" ? "watch" : "join",
        code,
        name,
        token,
        look: getSavedProfile(),
        session: sentSession,
        device: getDeviceId(),
      });
      if (disposed || stopped) {
        ch.close();
        return { kind: "cancelled" };
      }
      if (res.ok) return { kind: "joined", channel: ch };
      ch.close();
      if (res.error === NEED_LOGIN) {
        if (sentSession && getSession()?.session === sentSession) {
          setSignOutReason("revoked");
          clearSession();
        }
        signedOutRef.current?.();
      }
      return failedJoinOutcome(res.error);
    };

    /**
     * Open a channel and join. Used for the first connection, after drops, and
     * for a planned hand-over (`reconnect` from the server before the platform
     * cuts the connection): the new channel joins before the old one closes.
     * Each backend is tried in turn, the room's own first once it is known.
     */
    const open = async () => {
      if (disposed || stopped) return;
      const bases = basesToTry(roomBase, roomBase ? SERVER_BASES : await candidateBases());
      const step = await resolveJoin(
        bases,
        roomBase,
        () => channelRef.current !== null,
        async (base) => {
          const outcome = await tryJoin(base);
          if (disposed || stopped) {
            if (outcome.kind === "joined") outcome.channel.close();
            return { kind: "cancelled" };
          }
          if (outcome.kind === "unreachable" && !roomBase) markUnreachable(base);
          return outcome;
        },
      );
      switch (step.kind) {
        case "join": {
          roomBase = step.base;
          rememberRoomServer(wsPath, code, step.base);
          const previous = channelRef.current;
          channelRef.current = step.channel;
          previous?.close();
          retry = 0;
          setStatus("joined");
          setError(null);
          return;
        }
        case "error":
          setStatus("error");
          setError(step.error);
          return;
        case "retry":
          // The room may live on the backend that is down: keep retrying.
          setStatus((s) => (s === "joined" ? "reconnecting" : s));
          scheduleRetry();
          return;
        case "keep": // planned hand-over found nothing joinable: the old channel stays
        case "cancelled":
          return;
      }
    };

    const scheduleRetry = () => {
      if (disposed || stopped || retryTimer) return;
      const delay = Math.min(500 * 2 ** retry++, 8000);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void open();
      }, delay);
    };

    const pinger = setInterval(() => { if (!stopped) channelRef.current?.ping(); }, PING_INTERVAL_MS);
    // Come back fast when the tab regains focus or the network returns.
    const wake = () => {
      if (!disposed && !stopped && !channelRef.current && !retryTimer) void open();
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
      if (ch) {
        if (stopped) ch.close();
        else void ch.request({ type: "leave" }, 1500).finally(() => ch.close());
      }
    };
  }, [wsPath, code, name, mode]);

  const call: Call = useCallback((msg) => {
    const ch = channelRef.current;
    return ch ? ch.request(msg) : Promise.resolve<Ack>({ ok: false, error: DISCONNECTED_ERROR });
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

let userProfile: { user: object; profile: PlayerProfile } | null = null;

export function getSavedProfile(): PlayerProfile {
  const user = getSession()?.user;
  if (user) {
    // Signed in: the account's look wins (memoised so useSyncExternalStore sees a stable value).
    if (userProfile?.user !== user) userProfile = { user, profile: { icon: user.icon, color: user.color } };
    return userProfile.profile;
  }
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
  const offSession = subscribeSession(listener); // the account's look replaces the saved one on sign-in/out
  return () => {
    offSession();
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
