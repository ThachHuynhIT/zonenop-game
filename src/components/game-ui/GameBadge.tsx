"use client";

import { m } from "motion/react";
import { cn } from "@/lib/utils";
import { pop } from "./motion";

const TONES = {
  accent: "bg-game-accent text-game-accent-fg",
  success: "bg-emerald-400 text-emerald-950",
  warning: "bg-amber-300 text-amber-950",
  danger: "bg-rose-600 text-white",
  neutral: "bg-white/12 text-white ring-1 ring-inset ring-white/15",
} as const;

/** Small pill for states (online, playing, player count, "Lượt của bạn"…). */
export function GameBadge({
  tone = "neutral",
  pulse,
  role,
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  pulse?: boolean;
  role?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <m.span
      variants={pop}
      initial="hidden"
      animate="shown"
      role={role}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-extrabold",
        TONES[tone],
        pulse && "motion-safe:animate-pulse",
        className,
      )}
    >
      {children}
    </m.span>
  );
}
