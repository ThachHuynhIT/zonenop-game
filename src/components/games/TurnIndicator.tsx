"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * "It's your turn" highlight shared by the game tables: a softly pulsing
 * amber-red ring laid over the player's hand / controls (the parent must be
 * `relative`). Only the ring pulses, so cards and buttons stay fully opaque;
 * `motion-safe:` keeps it still for prefers-reduced-motion.
 */
export function TurnRing({ active, className }: { active: boolean; className?: string }) {
  if (!active) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -inset-1.5 rounded-2xl ring-2 ring-rose-400 shadow-[0_0_18px_3px_rgba(251,146,60,0.45),inset_0_0_14px_rgba(251,113,133,0.2)] motion-safe:animate-pulse",
        className,
      )}
    />
  );
}

/** Pill announcing the player's turn (screen readers get it via role="status"). */
export function MyTurnBadge({ className, children = "Lượt của bạn" }: { className?: string; children?: React.ReactNode }) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-2.5 py-0.5 text-xs font-bold text-black shadow-[0_0_12px_rgba(251,113,133,0.5)]",
        className,
      )}
    >
      <span aria-hidden>⏳</span>
      {children}
    </span>
  );
}

/**
 * A countdown drawn as a line running around the parent's border: full at the start of the
 * turn, shrinking clockwise to nothing at the deadline, turning red for the last few seconds.
 * The parent must be `relative`; the big seconds number sits on its top-right corner.
 */
export function TurnTimerBorder({ deadline, totalMs, now, radius = 16 }: { deadline: number | null; totalMs: number; now: number; radius?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [deadline === null]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!deadline) return null;
  const leftMs = Math.max(0, deadline - now);
  const frac = Math.min(1, leftMs / Math.max(totalMs, leftMs, 1));
  const secs = Math.ceil(leftMs / 1000);
  const urgent = secs <= 5;
  const inset = 2;
  return (
    <>
      <svg ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
        {size.w > 0 && (
          <rect
            x={inset}
            y={inset}
            width={Math.max(0, size.w - inset * 2)}
            height={Math.max(0, size.h - inset * 2)}
            rx={radius}
            pathLength={100}
            fill="none"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="100 100"
            strokeDashoffset={100 - frac * 100}
            className={cn("transition-[stroke-dashoffset] duration-200 ease-linear", urgent ? "stroke-red-500" : "stroke-rose-400")}
            style={{ filter: `drop-shadow(0 0 6px ${urgent ? "rgba(239,68,68,0.9)" : "rgba(251,113,133,0.7)"})` }}
          />
        )}
      </svg>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-3.5 right-4 z-20 rounded-full px-3 py-0.5 font-mono text-lg font-black tabular-nums shadow-lg ring-2",
          urgent ? "bg-red-600 text-white ring-red-300 motion-safe:animate-pulse" : "bg-black/85 text-rose-200 ring-rose-400/70",
        )}
      >
        ⏱ {secs}s
      </span>
    </>
  );
}
