"use client";

import { useEffect, useRef, useState } from "react";
import { type TPGameView } from "@/lib/typhu/protocol";
import { boardRef } from "../board-ref";

/**
 * The squares a token visits between two positions: forward one square at a time, or a few
 * squares back for "lùi 3 ô" cards. Entering jail walks to the Vào tù square first when the
 * dice put the player there, then jumps to the jail.
 */
function walkPath(from: number, to: number, enteredJail: boolean, dice: [number, number] | null): number[] {
  const BOARD_SIZE = boardRef.current.length;
  const GO_TO_JAIL_POS = boardRef.current.findIndex((q) => q.kind === "gotojail");
  const forward = (a: number, b: number) => {
    const steps: number[] = [];
    for (let p = a; p !== b; ) steps.push((p = (p + 1) % BOARD_SIZE));
    return steps;
  };
  if (enteredJail) {
    const landed = dice ? (from + dice[0] + dice[1]) % BOARD_SIZE : -1;
    return landed === GO_TO_JAIL_POS ? [...forward(from, GO_TO_JAIL_POS), to] : [to];
  }
  const ahead = (to - from + BOARD_SIZE) % BOARD_SIZE;
  if (BOARD_SIZE - ahead <= 3) return Array.from({ length: BOARD_SIZE - ahead }, (_, i) => (from - i - 1 + BOARD_SIZE) % BOARD_SIZE);
  return forward(from, to);
}

/**
 * Where each token is drawn. The server jumps a player straight to their new square; here the
 * token walks there square by square (faster for long card moves) so everyone can follow it.
 */
export function useWalkingTokens(g: TPGameView | null) {
  const players = g?.players ?? [];
  const [shown, setShown] = useState<Record<string, number>>(() => Object.fromEntries(players.map((p) => [p.id, p.pos])));
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const jailRef = useRef<Record<string, number>>(Object.fromEntries(players.map((p) => [p.id, p.jail])));
  const dice = g?.dice ?? null;
  const key = players.map((p) => `${p.id}:${p.pos}:${p.jail}`).join("|");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // A new game puts everyone back on Khởi hành: no walk.
    const reset = players.length > 0 && players.every((p) => p.pos === 0) && players.some((p) => (shownRef.current[p.id] ?? 0) !== 0);
    for (const p of players) {
      const from = shownRef.current[p.id];
      const wasJailed = (jailRef.current[p.id] ?? 0) > 0;
      jailRef.current[p.id] = p.jail;
      if (from === p.pos) continue;
      if (from === undefined || reset) {
        setShown((m) => ({ ...m, [p.id]: p.pos }));
        continue;
      }
      const path = walkPath(from, p.pos, !wasJailed && p.jail > 0, dice);
      const step = Math.max(40, Math.min(110, 1300 / path.length));
      path.forEach((pos, i) => timers.push(setTimeout(() => setShown((m) => ({ ...m, [p.id]: pos })), step * (i + 1))));
    }
    return () => timers.forEach(clearTimeout);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (id: string, fallback: number) => shown[id] ?? fallback;
}
