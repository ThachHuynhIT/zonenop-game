"use client";

import { createPortal } from "react-dom";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { m as motion, useReducedMotion } from "motion/react";
import { Building } from "../shared";
import styles from "./DropFx.module.scss";

export interface Drop {
  key: number;
  /** Screen position the piece lands on: its horizontal centre and its base. */
  x: number;
  base: number;
  size: number;
  kind: "flag" | "house" | "hotel";
  color: string;
}

/** How long a drop is on screen (ms), for the owner's clean-up timer. */
export const DROP_MS = { flag: 1800, house: 900, hotel: 1000 } as const;
/** When the piece touches down (ms): what should appear on the square itself waits for it. */
export const LAND_MS = 380;

/** Where a piece dropped on this square lands (null while the square isn't mounted). */
export function dropOn(el: Element | null, kind: Drop["kind"], color = "#fff"): Drop | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const flag = kind === "flag";
  return {
    key: Date.now(),
    x: r.left + r.width / 2,
    base: r.top + r.height * (flag ? 0.62 : 0.55),
    size: flag ? Math.min(72, Math.max(36, r.height * 1.1)) : Math.min(54, Math.max(28, r.height * 0.8)),
    kind,
    color,
  };
}

/**
 * A flag / house coming straight down from above onto a square and touching down. It is drawn on the
 * page, not inside the square: squares clip what overflows them, and the piece starts well above.
 * Nothing under prefers-reduced-motion (the building / owner tint still show up on the square).
 */
export function DropFx({ drop }: { drop: Drop | null }) {
  const reduced = useReducedMotion();
  if (!drop || reduced || typeof document === "undefined") return null;
  const flag = drop.kind === "flag";
  const width = flag ? drop.size * 0.75 : drop.size;
  return createPortal(
    <motion.div
      key={drop.key}
      aria-hidden
      className={styles.piece}
      style={{ left: drop.x - width / 2, top: drop.base - drop.size, width, height: drop.size }}
      initial={{ y: -(drop.size * 2 + 90), opacity: 0 }}
      animate={{ y: 0, opacity: [0, 1, 1, 0] }}
      transition={{
        y: { duration: LAND_MS / 1000, ease: "easeIn" },
        opacity: { duration: (flag ? DROP_MS.flag : DROP_MS[drop.kind]) / 1000, times: [0, 0.04, 0.7, 1], ease: "linear" },
      }}
    >
      {flag ? (
        <svg viewBox="0 0 24 32" className={styles.fill}>
          <path d="M5 30V3" stroke="#6b4a2b" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M6 4h16l-4.5 5.5L22 15H6z" fill={drop.color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
          <ellipse cx="5" cy="30" rx="4" ry="1.5" fill="rgba(0,0,0,0.35)" />
        </svg>
      ) : (
        <Building hotel={drop.kind === "hotel"} className={styles.fill} />
      )}
    </motion.div>,
    document.body,
  );
}
