"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { authRequest, getSession, useSession } from "@/components/auth/session";

export type ActionsPlacement = "center" | "bottom";
export type ViewMode = "full" | "minimal";
/** Table effects, each one switchable (all on by default). */
export interface FxPrefs {
  /** Coins flying between players with the ± amounts. */
  money: boolean;
  /** The "Đến lượt bạn!" band when the turn passes. */
  turn: boolean;
  /** The flag dropped onto a newly bought square, and the square shaking as it lands. */
  flag: boolean;
  /** "PHÁ SẢN!", and the winner's trumpets, flags, fireworks and confetti. */
  end: boolean;
}
export const FX_KEYS = ["money", "turn", "flag", "end"] as const satisfies readonly (keyof FxPrefs)[];
export interface TyPhuPrefs {
  /** Phones only: action buttons in the board centre (default) or in a bar stuck to the bottom of the screen. */
  actions: ActionsPlacement;
  /** Phones only: everything on screen (players with cash and houses, square names) or just the board and the player chips. */
  view: ViewMode;
  /** Every screen: which table effects play. */
  fx: FxPrefs;
}
export const DEFAULT_FX: FxPrefs = { money: true, turn: true, flag: true, end: true };
export const DEFAULT_PREFS: TyPhuPrefs = { actions: "center", view: "full", fx: DEFAULT_FX };

/** Saved effect switches: only an explicit `false` turns one off (older saves have none: all on). */
function parseFx(v: unknown): FxPrefs {
  if (!v || typeof v !== "object" || Array.isArray(v)) return DEFAULT_FX;
  const saved = v as Partial<Record<keyof FxPrefs, unknown>>;
  return Object.fromEntries(FX_KEYS.map((k) => [k, saved[k] !== false])) as unknown as FxPrefs;
}
export const PREFS_KEY = "typhu:prefs";

/** Prefs from an already-parsed value (storage or the account), falling back to the defaults for anything missing or broken. */
export function prefsFrom(v: unknown): TyPhuPrefs {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const { actions, view, fx } = v as { actions?: unknown; view?: unknown; fx?: unknown };
    return { actions: actions === "bottom" ? "bottom" : "center", view: view === "minimal" ? "minimal" : "full", fx: parseFx(fx) };
  }
  return DEFAULT_PREFS;
}

/** Saved prefs, falling back to the defaults for anything missing or broken. */
export function parsePrefs(raw: string | null): TyPhuPrefs {
  try {
    return prefsFrom(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_PREFS; // broken JSON
  }
}

/** The account's Cờ Tỷ Phú prefs out of a `GET /api/auth/prefs` body (every game's prefs): null when it has none yet or the body is junk. */
export function accountPrefs(body: unknown): TyPhuPrefs | null {
  if (!body || typeof body !== "object") return null;
  const all = (body as { prefs?: unknown }).prefs;
  if (!all || typeof all !== "object" || Array.isArray(all)) return null;
  const mine = (all as Record<string, unknown>).typhu;
  return mine && typeof mine === "object" && !Array.isArray(mine) ? prefsFrom(mine) : null;
}

/** be_game caps one game's prefs JSON at this many characters. */
export const MAX_PREFS_CHARS = 2000;

/** The `PATCH /api/auth/prefs` body for these prefs: only the known fields, null if it would not fit the server's limit. */
export function prefsPatch(p: TyPhuPrefs): { game: "typhu"; prefs: TyPhuPrefs } | null {
  const prefs = prefsFrom(p); // drop anything unknown
  return JSON.stringify(prefs).length > MAX_PREFS_CHARS ? null : { game: "typhu", prefs };
}

/** How long a change waits before it is saved on the account (several quick toggles = one request). */
export const SAVE_DELAY_MS = 500;

const PHONE_WIDTH_QUERY = "(max-width: 1023px)";
const SHORT_LANDSCAPE_QUERY = "(orientation: landscape) and (max-height: 500px)";

function subscribeViewport(onChange: () => void) {
  const lists = [window.matchMedia(PHONE_WIDTH_QUERY), window.matchMedia(SHORT_LANDSCAPE_QUERY)];
  for (const l of lists) l.addEventListener("change", onChange);
  return () => {
    for (const l of lists) l.removeEventListener("change", onChange);
  };
}

const phonePortraitNow = () => window.matchMedia(PHONE_WIDTH_QUERY).matches && !window.matchMedia(SHORT_LANDSCAPE_QUERY).matches;

/** True on a phone held upright: narrower than `lg` and not the short landscape layout (the server render says false). */
export function usePhonePortrait(): boolean {
  return useSyncExternalStore(subscribeViewport, phonePortraitNow, () => false);
}

/** Saved prefs of this browser (the defaults when storage is missing or blocked). */
export function readPrefs(): TyPhuPrefs {
  try {
    return parsePrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeLocal(p: TyPhuPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // storage blocked: this tab only
  }
}

/**
 * This viewer's display prefs. The table route is client-only (`ssr: false`), so storage is read on the first render: no
 * flash of the defaults. Signed in, they are also kept on the account (`/api/auth/prefs`, every device): fetched once per
 * account on mount (applied unless the viewer already changed something; uploaded from this device when the account has
 * none yet) and every change saved there after `SAVE_DELAY_MS`. A failed call (offline, 401, a backend without the endpoint
 * answering 404) changes nothing: the local value stays.
 */
export function useTyPhuPrefs(): [TyPhuPrefs, (next: TyPhuPrefs) => void] {
  const uid = useSession()?.user.id ?? null;
  const [prefs, setPrefs] = useState<TyPhuPrefs>(readPrefs);
  const latest = useRef(prefs);
  const touched = useRef(false); // the viewer changed something since mount: the account's copy must not overwrite it
  const queued = useRef<TyPhuPrefs | null>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One request at a time; whatever was queued meanwhile goes after it (only the newest value).
  const flush = useCallback(async () => {
    if (busy.current) return;
    const next = queued.current;
    queued.current = null;
    if (!next || !getSession()) return;
    const body = prefsPatch(next);
    if (!body) return;
    busy.current = true;
    try {
      await authRequest("PATCH", "/api/auth/prefs", body);
    } catch {
      // never surfaces: the local copy is the source of truth for this device
    } finally {
      busy.current = false;
      if (queued.current) void flush();
    }
  }, []);

  const schedule = useCallback(
    (next: TyPhuPrefs) => {
      queued.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void flush();
      }, SAVE_DELAY_MS);
    },
    [flush],
  );

  // Leaving the table with a change still waiting: send it now.
  useEffect(
    () => () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      void flush();
    },
    [flush],
  );

  useEffect(() => {
    if (!uid) return;
    let live = true;
    void (async () => {
      const res = await authRequest<unknown>("GET", "/api/auth/prefs");
      if (!live || !res.ok || getSession()?.user.id !== uid) return;
      const remote = accountPrefs(res.data);
      if (!remote) {
        if (!touched.current) schedule(latest.current); // first time on this account: carry this device's choices over
      } else if (!touched.current) {
        latest.current = remote;
        setPrefs(remote);
        writeLocal(remote);
      }
    })().catch(() => {
      // offline or an old backend: keep the local prefs
    });
    return () => {
      live = false;
    };
  }, [uid, schedule]);

  const save = useCallback(
    (next: TyPhuPrefs) => {
      touched.current = true;
      latest.current = next;
      setPrefs(next);
      writeLocal(next);
      if (getSession()) schedule(next);
    },
    [schedule],
  );
  return [prefs, save];
}
