"use client";

// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { m as motion } from "motion/react";
import { cn } from "@/lib/utils";

// ─── Centre controls ────────────────────────────────────────────────

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function Die({ value, rolling }: { value: number; rolling: number }) {
  return (
    <motion.div
      key={rolling}
      initial={{ rotate: -200, scale: 0.4, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
      className="grid h-10 w-10 grid-cols-3 grid-rows-3 gap-[2px] rounded-lg bg-white p-1.5 shadow-lg sm:h-14 sm:w-14 sm:p-2 short:h-8 short:w-8 short:p-1"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={cn("rounded-full", PIPS[value]?.includes(i) && "bg-emerald-950")} />
      ))}
    </motion.div>
  );
}
