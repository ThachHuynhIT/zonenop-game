"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { activeServerBase } from "../games/gameClient";
import { getDeviceId } from "./device";
import { getSession } from "./session";
import { trackPayload } from "./trackPayload";

async function send(pathname: string): Promise<void> {
  const base = await activeServerBase();
  const url = base + "/api/track";
  const body = JSON.stringify({ path: trackPayload(pathname), device: getDeviceId() });
  const session = getSession()?.session;
  // sendBeacon cannot carry an Authorization header, so signed-in views go through fetch.
  if (!session && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    if (navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session) headers.Authorization = `Bearer ${session}`;
  await fetch(url, { method: "POST", keepalive: true, headers, body });
}

/** Counts one page view per pathname change; failures are swallowed. */
export default function PageTracker() {
  const last = useRef<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV === "test" || typeof window === "undefined" || !pathname) return;
    if (last.current === pathname) return;
    last.current = pathname;
    try {
      send(pathname).catch(() => {});
    } catch {
      /* never surface tracking errors */
    }
  }, [pathname]);

  return null;
}
