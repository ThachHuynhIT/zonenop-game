"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { m as motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import styles from "./VictoryFx.module.scss";

/** Whole effect on screen (ms), fade-out included. */
const DURATION = 4600;
const FADE_MS = 700;
/** A rocket's climb before it bursts (ms). */
const RISE_MS = 750;
const ROCKETS = 6;

interface Rocket {
  key: number;
  /** Burst point, 0–1 of the screen. */
  x: number;
  y: number;
  /** Launch time (ms). */
  delay: number;
}

/**
 * The winner's own victory moment, layered with the shared `Celebration`: two trumpets blowing in the lower corners,
 * two flags in the winner's colour rising on poles at the sides and waving, and fireworks (rockets climbing, then
 * bursting). Only for the winner, only on the playing → ended transition this mounted component saw (same guard as
 * `Celebration`: a reconnect onto a finished game never replays it). Nothing under prefers-reduced-motion or with the
 * "Phá sản & chiến thắng" switch off (`enabled`). Pointer-events-none, aria-hidden, z-41: below dialogs (z-50).
 */
export function VictoryFx({ show, playing, won, color, enabled }: { show: boolean; playing: boolean; won: boolean; color: string; enabled: boolean }) {
  const [run, setRun] = useState(0);
  const wasPlaying = useRef(false);
  const wasShow = useRef(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (show && !wasShow.current && wasPlaying.current) setRun((r) => r + 1);
    if (playing && !show) wasPlaying.current = true;
    if (!playing && !show) wasPlaying.current = false;
    wasShow.current = show;
  }, [show, playing]);

  if (!run || !won || !enabled || reduced) return null;
  return <Show key={run} color={color} />;
}

function Show({ color }: { color: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  const [alive, setAlive] = useState(true);
  const [fading, setFading] = useState(false);
  // Spread over the width, staggered in time, bursting in the upper half.
  const [rockets] = useState<Rocket[]>(() =>
    Array.from({ length: ROCKETS }, (_, i) => ({
      key: i,
      x: 0.15 + ((i * 0.37 + Math.random() * 0.2) % 0.7),
      y: 0.15 + Math.random() * 0.25,
      delay: 250 + i * 520,
    })),
  );

  useEffect(() => {
    setMounted(true);
    const t1 = setTimeout(() => setFading(true), DURATION - FADE_MS);
    const t2 = setTimeout(() => setAlive(false), DURATION);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!mounted || !cv) return;
    let stop = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (stop) return;
      const fire = confetti.create(cv, { resize: true, useWorker: false });
      for (const r of rockets) {
        timers.push(
          setTimeout(() => {
            const burst = { origin: { x: r.x, y: r.y }, spread: 360, ticks: 90, gravity: 0.6, decay: 0.92, shapes: ["circle" as const], disableForReducedMotion: true };
            fire({ ...burst, particleCount: 60, startVelocity: 24, scalar: 0.8, colors: [color, "#fde047", "#ffffff"] });
            fire({ ...burst, particleCount: 25, startVelocity: 12, scalar: 0.6, colors: ["#fef3c7", "#fbbf24"] });
          }, r.delay + RISE_MS),
        );
      }
    });
    return () => {
      stop = true;
      timers.forEach(clearTimeout);
    };
  }, [mounted, rockets, color]);

  if (!mounted || !alive) return null;
  return createPortal(
    <div aria-hidden className={cn(styles.layer, fading && styles.fading)}>
      <canvas ref={canvas} className={styles.canvas} />
      {rockets.map((r) => (
        <motion.span
          key={r.key}
          className={styles.rocket}
          // Burst point: random per run, so a runtime value.
          style={{ left: `${r.x * 100}%` }}
          initial={{ top: "102%", opacity: 0 }}
          animate={{ top: `${r.y * 100}%`, opacity: [0, 1, 1, 0] }}
          transition={{
            top: { duration: RISE_MS / 1000, delay: r.delay / 1000, ease: "easeOut" },
            opacity: { duration: RISE_MS / 1000, delay: r.delay / 1000, times: [0, 0.1, 0.9, 1] },
          }}
        />
      ))}
      <Flag color={color} side="left" />
      <Flag color={color} side="right" />
      <Trumpet side="left" />
      <Trumpet side="right" />
    </div>,
    document.body,
  );
}

/** A flag in the winner's colour rising on its pole at one side of the screen, then waving (the cloth points inward). */
function Flag({ color, side }: { color: string; side: "left" | "right" }) {
  return (
    <div className={cn(styles.pole, side === "right" && styles.mirror)}>
      <svg viewBox="0 0 60 200" preserveAspectRatio="xMinYMin meet" className={styles.poleSvg}>
        <rect x="4" y="6" width="5" height="194" rx="2" fill="#7c5a36" />
        <circle cx="6.5" cy="6" r="5" fill="#fbbf24" />
      </svg>
      <svg viewBox="0 0 50 34" className={styles.cloth}>
        <path d="M0 2 Q12 -2 25 2 T50 2 V32 Q38 36 25 32 T0 32 Z" fill={color} stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <text x="25" y="23" textAnchor="middle" fontSize="15">
          🏆
        </text>
      </svg>
    </div>
  );
}

/** A trumpet in a lower corner blowing a fanfare: it pulses and notes float out of its bell. */
function Trumpet({ side }: { side: "left" | "right" }) {
  return (
    <div className={cn(styles.trumpet, side === "right" && styles.trumpetRight)}>
      <span className={styles.horn}>🎺</span>
      <span className={styles.notes}>
        <span>♪</span>
        <span>♫</span>
        <span>♪</span>
      </span>
    </div>
  );
}
