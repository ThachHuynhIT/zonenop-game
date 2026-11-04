"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { m as motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import styles from "./TurnBanner.module.scss";

/**
 * A band across the whole screen when the turn passes to somebody: loud for me, a quiet
 * strip with the name for the others. Nothing on open, only on a real change of turn. Nothing under
 * prefers-reduced-motion or with the "Báo lượt" switch off (`enabled`): the turn glow and the action bar still say it.
 */
export function TurnBanner({ turn, meId, name, playing, enabled }: { turn: string | null; meId: string; name: string; playing: boolean; enabled: boolean }) {
  const [mounted, setMounted] = useState(false);
  const reduced = useReducedMotion();
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
    const t = setTimeout(() => setFx(null), fx.mine ? 1100 : 800);
    return () => clearTimeout(t);
  }, [fx]);
  if (!mounted || !enabled || reduced) return null;
  return createPortal(
    <>
      {fx && (
        <motion.div
          key={fx.at}
          role="status"
          className={styles.layer}
          // Sharp in, held for a moment, then a gradual fade out.
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.94, 1, 1, 1] }}
          transition={{ duration: fx.mine ? 1.1 : 0.8, times: [0, 0.12, 0.4, 1], ease: "easeOut" }}
        >
          <div className={cn(styles.band, fx.mine ? styles.mine : styles.other)}>
            {fx.mine ? "⏳ Đến lượt bạn!" : `Lượt của ${fx.name}`}
          </div>
        </motion.div>
      )}
    </>,
    document.body,
  );
}
