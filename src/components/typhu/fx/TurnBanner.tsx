"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { AnimatePresence, m as motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * A band sweeping across the whole screen when the turn passes to somebody: loud for me, a quiet
 * strip with the name for the others. Nothing on open, only on a real change of turn.
 */
export function TurnBanner({ turn, meId, name, playing }: { turn: string | null; meId: string; name: string; playing: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [fx, setFx] = useState<{ at: number; mine: boolean; name: string } | null>(null);
  const last = useRef(turn);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const changed = turn !== last.current;
    last.current = turn;
    if (!changed || !turn || !playing) return;
    setFx({ at: Date.now(), mine: turn === meId, name });
  }, [turn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => setFx(null), fx.mine ? 1800 : 1200);
    return () => clearTimeout(t);
  }, [fx]);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {fx && (
        <motion.div
          key={fx.at}
          role="status"
          className="pointer-events-none fixed inset-x-0 top-[34%] z-[55] flex justify-center overflow-hidden"
          initial={{ opacity: 0, x: "-100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "100%", transition: { duration: 0.3 } }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
        >
          <div
            className={cn(
              "w-full text-center font-black uppercase tracking-widest text-white shadow-2xl",
              fx.mine
                ? "bg-gradient-to-r from-transparent via-amber-500 to-transparent py-4 text-3xl drop-shadow sm:py-6 sm:text-5xl"
                : "bg-gradient-to-r from-transparent via-slate-800/85 to-transparent py-2 text-base sm:text-xl",
            )}
          >
            {fx.mine ? "⏳ Đến lượt bạn!" : `Lượt của ${fx.name}`}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
