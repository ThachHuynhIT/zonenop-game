"use client";

import { useEffect, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { cn } from "@/lib/utils";

const MAX_SCALE = 2.6;

/**
 * Pinch-to-zoom and drag-to-pan for a board on phones / tablets (below `lg`): two fingers (or ctrl + wheel / a trackpad
 * pinch) zoom between 1× and 2.6×, one finger pans while zoomed, and the "Thu nhỏ" chip resets. At 1× one finger still scrolls
 * the page (`touch-action: pan-y`), and taps keep reaching the children (drags are not taps). On wide screens it renders
 * its children untouched.
 */
export function PinchZoom({ children, className }: { children: React.ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      setOn(mq.matches);
      if (!mq.matches) setView({ s: 1, x: 0, y: 0 });
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const clamp = (s: number, x: number, y: number) => {
    const el = box.current;
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    const mx = ((s - 1) * w) / 2;
    const my = ((s - 1) * h) / 2;
    return { s, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };

  useGesture(
    {
      onPinch: ({ offset: [s], origin: [ox, oy], first, memo }) => {
        const el = box.current;
        if (!el) return memo;
        const r = el.getBoundingClientRect();
        const prev = viewRef.current;
        // Keep the point under the fingers where it is while the scale changes.
        const cx = ox - (r.left + r.width / 2);
        const cy = oy - (r.top + r.height / 2);
        const ratio = s / prev.s;
        const next = clamp(s, prev.x * ratio + cx * (1 - ratio), prev.y * ratio + cy * (1 - ratio));
        setView(next.s <= 1.01 ? { s: 1, x: 0, y: 0 } : next);
        return first ? s : memo;
      },
      onDrag: ({ delta: [dx, dy], pinching, cancel }) => {
        if (pinching) return cancel();
        const prev = viewRef.current;
        if (prev.s <= 1) return;
        setView(clamp(prev.s, prev.x + dx, prev.y + dy));
      },
    },
    {
      target: box,
      enabled: on,
      eventOptions: { passive: false },
      pinch: { scaleBounds: { min: 1, max: MAX_SCALE }, from: () => [viewRef.current.s, 0], rubberband: false },
      drag: { filterTaps: true, pointer: { touch: true } },
    },
  );

  const zoomed = view.s > 1;
  return (
    <div ref={box} className={cn("relative overflow-hidden", on && (zoomed ? "touch-none" : "touch-pan-y"), className)}>
      <div style={on ? { transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transformOrigin: "center", willChange: zoomed ? "transform" : undefined } : undefined}>{children}</div>
      {on && zoomed && (
        <button
          type="button"
          onClick={() => setView({ s: 1, x: 0, y: 0 })}
          className="absolute right-2 top-2 z-30 min-h-9 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white shadow-lg ring-1 ring-white/30"
        >
          🔍 Thu nhỏ
        </button>
      )}
    </div>
  );
}
