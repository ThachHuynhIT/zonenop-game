"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * The clock lives in a context so that only the few components showing a countdown re-render every 500 ms —
 * not the whole table (board cells, player rows, panels). The provider renders its `children` prop, so React
 * skips them while only the context value changes.
 */
export const NowContext = createContext(0);

export function NowProvider({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <NowContext.Provider value={useNow(active)}>{children}</NowContext.Provider>;
}

/** Whole seconds until `t` (a server-clock deadline already shifted to the local clock), re-evaluated every tick. */
export function useSecondsLeft() {
  const now = useContext(NowContext);
  return (t: number | null | undefined) => (t ? Math.max(0, Math.ceil((t - now) / 1000)) : null);
}

export function NowClock({ endsAt }: { endsAt: number }) {
  const now = useContext(NowContext);
  return <>{formatClock(endsAt - now)}</>;
}

export function useNow(active: boolean, every = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [active, every]);
  return now;
}

export const formatClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
