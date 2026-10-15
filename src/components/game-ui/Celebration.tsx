"use client";

import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { winBanner } from "./motion";
import { CONFETTI_COLORS, useGameTheme } from "./theme";

const DURATION = 4200;

/**
 * Victory effect for every table: confetti in the game's colours + a banner, only on the playing → ended transition
 * this mounted component saw (a reconnect onto a finished game never replays it). Same props as WinCelebration.
 * Pointer-events-none overlay (z-40, below dialogs), ~4 s. prefers-reduced-motion: banner only.
 */
export function Celebration({ show, playing, won, title }: { show: boolean; playing: boolean; won: boolean; title?: string }) {
  const [run, setRun] = useState(0);
  const wasPlaying = useRef(false);
  const wasShow = useRef(false);

  useEffect(() => {
    if (show && !wasShow.current && wasPlaying.current) setRun((r) => r + 1);
    if (playing && !show) wasPlaying.current = true;
    if (!playing && !show) wasPlaying.current = false;
    wasShow.current = show;
  }, [show, playing]);

  if (!run) return null;
  return <Burst key={run} won={won} title={title} />;
}

function Burst({ won, title }: { won: boolean; title?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useGameTheme() ?? "hub";
  const [alive, setAlive] = useState(true);
  const [fading, setFading] = useState(false);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), DURATION - 700);
    const t2 = setTimeout(() => setAlive(false), DURATION);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!won || reduced || !cv) return;
    let stop = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (stop) return;
      const fire = confetti.create(cv, { resize: true, useWorker: false });
      const base = { colors: CONFETTI_COLORS[game], disableForReducedMotion: true, zIndex: 40 };
      fire({ ...base, particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.85 }, startVelocity: 55 });
      fire({ ...base, particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.85 }, startVelocity: 55 });
      fire({ ...base, particleCount: 120, spread: 100, origin: { x: 0.5, y: 0.4 }, scalar: 1.1 });
      for (let i = 0; i < 6; i++) {
        timers.push(
          setTimeout(() => {
            fire({ ...base, particleCount: 50, spread: 360, startVelocity: 28, ticks: 70, gravity: 0.8, scalar: 0.9, origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.35 } });
          }, 450 + i * 380),
        );
      }
    });
    return () => {
      stop = true;
      timers.forEach(clearTimeout);
    };
  }, [won, reduced, game]);

  if (!alive) return null;
  const text = won ? "🏆 Bạn thắng!" : title;
  return (
    <div aria-hidden data-game={game} className={cn("pointer-events-none fixed inset-0 z-40 overflow-hidden transition-opacity duration-700", fading ? "opacity-0" : "opacity-100")}>
      {won && !reduced && <canvas ref={canvas} className="absolute inset-0 h-full w-full" />}
      {text && (
        <div className={cn("absolute inset-x-0 flex justify-center", won ? "top-[22%]" : "top-16")}>
          <m.div
            variants={winBanner}
            initial="hidden"
            animate="shown"
            className={
              won
                ? "game-raised rounded-game-card border border-white/20 bg-game-accent px-7 py-3 font-heading text-3xl font-extrabold text-game-accent-fg"
                : "rounded-full border border-white/15 bg-black/70 px-4 py-1.5 text-sm font-bold text-white"
            }
          >
            {text}
          </m.div>
        </div>
      )}
    </div>
  );
}
