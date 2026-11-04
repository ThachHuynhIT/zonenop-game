"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

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

/** Saved prefs, falling back to the defaults for anything missing or broken. */
export function parsePrefs(raw: string | null): TyPhuPrefs {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const { actions, view, fx } = v as { actions?: unknown; view?: unknown; fx?: unknown };
      return { actions: actions === "bottom" ? "bottom" : "center", view: view === "minimal" ? "minimal" : "full", fx: parseFx(fx) };
    }
  } catch {
    // broken JSON: defaults
  }
  return DEFAULT_PREFS;
}

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

/** This viewer's display prefs. The table route is client-only (`ssr: false`), so storage is read on the first render: no flash of the defaults. */
export function useTyPhuPrefs(): [TyPhuPrefs, (next: TyPhuPrefs) => void] {
  const [prefs, setPrefs] = useState<TyPhuPrefs>(readPrefs);
  const save = useCallback((next: TyPhuPrefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // storage blocked: this tab only
    }
  }, []);
  return [prefs, save];
}
