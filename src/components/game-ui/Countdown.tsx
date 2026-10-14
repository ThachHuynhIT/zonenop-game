"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { countdownState } from "./logic";

/** Turn timer: a ring emptying clockwise around the seconds left, red once a quarter is left. */
export function Countdown({ deadline, total, size = 44, className }: { deadline: number | null; total: number; size?: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline === null) return null;

  const { remainingMs, fraction, urgent } = countdownState(deadline, total, now);
  const secs = Math.ceil(remainingMs / 1000);
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <span role="timer" aria-label={`Còn ${secs} giây`} className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-white/15" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={cn("transition-[stroke-dashoffset] duration-200 ease-linear", urgent ? "stroke-rose-500" : "stroke-game-accent")}
        />
      </svg>
      <span aria-hidden className={cn("absolute font-heading text-sm font-extrabold tabular-nums", urgent && "text-rose-300 motion-safe:animate-pulse")}>
        {secs}
      </span>
    </span>
  );
}
