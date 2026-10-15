"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { countdownState } from "@/components/game-ui/logic";

const STROKE = 3;
const RADIUS = 16; // rounded-2xl

/**
 * My turn's clock drawn on the panel's own border: a line that shortens as the time runs out (red once a quarter is left),
 * plus the seconds left in the top-right corner. The parent must be `relative` and rounded-2xl.
 */
export function BorderTimer({ deadline, total }: { deadline: number; total: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const frame = requestAnimationFrame(tick);
    const id = setInterval(tick, 200);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, [deadline]);

  // The rectangle is drawn in pixels, so follow the panel's size.
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { remainingMs, fraction, urgent } = countdownState(deadline, total, now);
  const secs = Math.ceil(remainingMs / 1000);
  return (
    <>
      <svg ref={svgRef} aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
        {size.w > 0 && (
          <rect
            x={STROKE / 2}
            y={STROKE / 2}
            width={Math.max(0, size.w - STROKE)}
            height={Math.max(0, size.h - STROKE)}
            rx={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${fraction * 100} 100`}
            className={cn("transition-[stroke-dasharray] duration-200 ease-linear", urgent ? "stroke-rose-500" : "stroke-emerald-600")}
          />
        )}
      </svg>
      <span
        role="timer"
        aria-label={`Còn ${secs} giây`}
        className={cn(
          "absolute right-3 top-0 z-10 -translate-y-1/2 rounded-full px-2 py-0.5 font-heading text-sm font-extrabold tabular-nums text-white shadow-md",
          urgent ? "bg-rose-600 motion-safe:animate-pulse" : "bg-emerald-700",
        )}
      >
        {secs}s
      </span>
    </>
  );
}
