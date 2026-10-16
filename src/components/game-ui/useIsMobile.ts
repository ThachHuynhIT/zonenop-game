"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)";

const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/** Phone-sized viewport (below Tailwind's `md`). False while rendering on the server. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
