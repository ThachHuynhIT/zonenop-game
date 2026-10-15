"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

export type ActionsPlacement = "center" | "bottom";
export interface TyPhuPrefs {
  /** Phones only: action buttons in the board centre (default) or in a bar stuck to the bottom of the screen. */
  actions: ActionsPlacement;
}
export const DEFAULT_PREFS: TyPhuPrefs = { actions: "center" };
export const PREFS_KEY = "typhu:prefs";

/** Saved prefs, falling back to the defaults for anything missing or broken. */
export function parsePrefs(raw: string | null): TyPhuPrefs {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (v && typeof v === "object" && !Array.isArray(v) && (v as { actions?: unknown }).actions === "bottom") return { actions: "bottom" };
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
