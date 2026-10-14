"use client";

import { useCallback, useEffect, useState } from "react";

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

/** This viewer's display prefs, read after mount (the server render always uses the defaults). */
export function useTyPhuPrefs(): [TyPhuPrefs, (next: TyPhuPrefs) => void] {
  const [prefs, setPrefs] = useState<TyPhuPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setPrefs(parsePrefs(localStorage.getItem(PREFS_KEY)));
      } catch {
        // storage blocked: keep the defaults
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
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
