"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { m as motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { inkOn } from "../tokens";
import styles from "./TurnBanner.module.scss";

/** On screen for this long (ms): loud for me, shorter for the others. The fade-in takes about a fifth of it. */
const MINE_MS = 1400;
const OTHER_MS = 1000;

/**
 * A band across the whole screen when the turn passes to somebody: loud for me, a quiet
 * strip with the name for the others, in the turn player's token colour (darkened, black edges). Nothing on open, only on a
 * real change of turn. Nothing under prefers-reduced-motion or with the "Báo lượt" switch off (`enabled`): the turn glow
 * and the action bar still say it.
 */
export function TurnBanner({
  turn,
  meId,
  name,
  color,
  playing,
  enabled,
}: {
  turn: string | null;
  meId: string;
  name: string;
  /** The turn player's token colour (#rrggbb). */
  color: string;
  playing: boolean;
  enabled: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const reduced = useReducedMotion();
  const [fx, setFx] = useState<{ at: number; mine: boolean; name: string; color: string } | null>(null);
  const last = useRef(turn);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const changed = turn !== last.current;
    last.current = turn;
    if (!changed || !turn || !playing) return;
    setFx({ at: Date.now(), mine: turn === meId, name, color });
  }, [turn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => setFx(null), fx.mine ? MINE_MS : OTHER_MS);
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
          // Eased in, held for a moment, then a gradual fade out.
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.94, 1, 1, 1] }}
          transition={{ duration: (fx.mine ? MINE_MS : OTHER_MS) / 1000, times: [0, fx.mine ? 0.19 : 0.24, 0.55, 1], ease: "easeOut" }}
        >
          <div
            className={cn(styles.band, fx.mine ? styles.mine : styles.other, inkOn(fx.color) === "#ffffff" ? styles.lightInk : styles.darkInk)}
            // Runtime value: the turn player's colour.
            style={{ "--turn-color": fx.color } as CSSProperties}
          >
            {fx.mine ? "⏳ Đến lượt bạn!" : `Lượt của ${fx.name}`}
          </div>
        </motion.div>
      )}
    </>,
    document.body,
  );
}
