"use client";

import { useEffect, useRef } from "react";

export type Hotkeys = Record<string, (() => void) | undefined>;

/**
 * Desktop keyboard shortcuts. `bindings` maps a key (`KeyboardEvent.key`, case-insensitive: "r", " ", "Escape")
 * to its action; the latest bindings are used on every key press, so handlers can close over fresh state.
 *
 * Ignored while typing in a field, with Ctrl / Alt / Meta held, on key repeat, and — except for the keys in
 * `allowInDialog` — while a dialog is open. Space / Enter are also ignored on a focused button or link, which the
 * browser already "clicks" itself (it would fire twice).
 */
export function useHotkeys(bindings: Hotkeys, enabled = true, allowInDialog: string[] = []) {
  const ref = useRef({ bindings, allowInDialog });
  ref.current = { bindings, allowInDialog };

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
      const target = e.target instanceof Element ? (e.target as HTMLElement) : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if ((key === " " || key === "Enter") && target?.closest("button, a, summary, [role='button']")) return;
      const { bindings: b, allowInDialog: allow } = ref.current;
      const action = b[key];
      if (!action) return;
      if (key !== "Escape" && !allow.includes(key) && document.querySelector("[role='dialog']")) return;
      e.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
