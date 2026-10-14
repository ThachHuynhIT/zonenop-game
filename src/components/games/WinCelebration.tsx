"use client";

import { useEffect, useRef, useState } from "react";

const DURATION = 4200;
const COLORS = ["#fbbf24", "#f87171", "#34d399", "#60a5fa", "#a78bfa", "#f472b6", "#fde68a", "#ffffff"];

/**
 * Victory effect shared by every game table: confetti burst + banner when a game just ended.
 * - `playing`: the game is in progress (status !== "ended" and a game exists). The celebration only fires on the
 *   playing -> ended transition seen by this mounted component, so a reconnect / refresh onto an already-ended game
 *   (or a re-render of the same result) never replays it.
 * - `show`: the game has ended.
 * - `won`: I am a winner -> confetti + "Bạn thắng!". Otherwise (loser / spectator) only a small banner with `title`.
 * Pointer-events-none fixed overlay (z-40, below modals), ~4 s then fades. prefers-reduced-motion: banner only.
 */
export function WinCelebration({ show, playing, won, title }: { show: boolean; playing: boolean; won: boolean; title?: string }) {
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
    // canvas-confetti is loaded on demand so the lobby bundles stay small.
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (stop) return;
      const fire = confetti.create(cv, { resize: true, useWorker: false });
      const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 40 };
      // Two cannons from the bottom corners, then fireworks bursting in the upper half.
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
  }, [won, reduced]);

  if (!alive) return null;
  const text = won ? "🏆 Bạn thắng!" : title;
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-40 overflow-hidden transition-opacity duration-700 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      {won && !reduced && <canvas ref={canvas} className="absolute inset-0 h-full w-full" />}
      {text && (
        <div className={`absolute inset-x-0 flex justify-center ${won ? "top-[22%]" : "top-16"}`}>
          <div
            className={
              won
                ? "animate-bounce rounded-2xl border border-amber-300/60 bg-black/70 px-6 py-3 text-3xl font-black text-amber-300 shadow-[0_0_40px_rgba(251,191,36,0.5)] motion-reduce:animate-none"
                : "rounded-full border border-amber-300/30 bg-black/65 px-4 py-1.5 text-sm font-bold text-amber-200"
            }
          >
            {text}
          </div>
        </div>
      )}
    </div>
  );
}
