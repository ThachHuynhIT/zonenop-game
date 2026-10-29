"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { m as motion } from "motion/react";
import { type TPPlayerView } from "@/lib/typhu/protocol";
import { money } from "../shared";
import { type MoneyFlow, moneyFlows } from "./moneyFlows";

interface Point {
  x: number;
  y: number;
}

interface Flight {
  key: number;
  from: Point;
  to: Point;
  coins: number;
  /** Floating "-200tr" above the payer / "+200tr" above the receiver (none for the bank). */
  lose: { at: Point; amount: number } | null;
  win: { at: Point; amount: number } | null;
}

const FLIGHT_MS = 2000;

/** Centre of whatever carries this attribute: the player's token on the board, else their panel avatar. */
function spot(id: string | null): Point | null {
  const el = id === null ? document.querySelector("[data-bank]") : document.querySelector(`[data-token="${id}"]`) ?? document.querySelector(`[data-seat="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function flightOf(f: MoneyFlow, key: number): Flight | null {
  const from = spot(f.from);
  const to = spot(f.to);
  if (!from || !to) return null;
  return {
    key,
    from,
    to,
    coins: Math.min(7, Math.max(3, Math.ceil(f.amount / 150))),
    lose: f.from ? { at: from, amount: f.amount } : null,
    win: f.to ? { at: to, amount: f.amount } : null,
  };
}

/**
 * Coins flying between players whenever cash changes hands, with the signed amount floating up over
 * each token. What a player pays and nobody receives goes to the bank (the board centre).
 */
export function MoneyFx({ players, gameKey, arrived }: { players: TPPlayerView[] | undefined; gameKey: number; arrived: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);
  const seen = useRef<{ game: number; cash: Record<string, number>; out: Set<string> } | null>(null);
  const counter = useRef(0);
  // Flows wait here until every token has finished walking: the money moves once the player is there.
  const pending = useRef<MoneyFlow[]>([]);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!players) {
      seen.current = null;
      return;
    }
    const cash = Object.fromEntries(players.map((p) => [p.id, p.cash]));
    const out = new Set(players.filter((p) => p.bankrupt).map((p) => p.id));
    const prev = seen.current;
    seen.current = { game: gameKey, cash, out };
    // First look at this game (page opened, or a new game): nothing to replay.
    if (!prev || prev.game !== gameKey) return;
    // A bankruptcy wipes the cash and hands the assets over: the "Phá sản" effect covers that.
    const skip = new Set([...out].filter((id) => !prev.out.has(id)));
    pending.current.push(...moneyFlows(prev.cash, cash, skip));
  }, [players, gameKey]);

  useEffect(() => {
    if (!arrived || !pending.current.length) return;
    // A beat after the last step, so the token is visibly on its square.
    const t = setTimeout(() => {
      const flows = pending.current;
      pending.current = [];
      const fresh = flows.flatMap((f) => flightOf(f, ++counter.current) ?? []);
      if (!fresh.length) return;
      setFlights((l) => [...l, ...fresh]);
      const keys = new Set(fresh.map((f) => f.key));
      setTimeout(() => setFlights((l) => l.filter((f) => !keys.has(f.key))), FLIGHT_MS + 200);
    }, 150);
    return () => clearTimeout(t);
  }, [players, arrived]);

  if (!mounted) return null;
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
        {flights.map((f) => (
          <div key={f.key}>
            {Array.from({ length: f.coins }, (_, i) => (
              <motion.span
                key={i}
                className="absolute -ml-3 -mt-3 text-2xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]"
                style={{ left: f.from.x, top: f.from.y }}
                initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
                animate={{
                  x: f.to.x - f.from.x,
                  y: [0, Math.min(f.to.y, f.from.y) - f.from.y - 60, f.to.y - f.from.y],
                  scale: [0.4, 1.2, 0.8],
                  opacity: [0, 1, 1, 0],
                  rotate: [0, 180, 360],
                }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.09, ease: "easeInOut" }}
              >
                🪙
              </motion.span>
            ))}
            {f.lose && <Amount at={f.lose.at} amount={-f.lose.amount} delay={0} />}
            {f.win && <Amount at={f.win.at} amount={f.win.amount} delay={0.9} />}
          </div>
        ))}
    </div>,
    document.body,
  );
}

/** "+200tr" / "-200tr" rising from a token and fading out. */
function Amount({ at, amount, delay }: { at: Point; amount: number; delay: number }) {
  const gain = amount > 0;
  return (
    <motion.span
      className={`absolute -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-sm font-black shadow-lg ring-2 sm:text-base ${gain ? "bg-emerald-500 text-white ring-emerald-200" : "bg-rose-600 text-white ring-rose-200"}`}
      style={{ left: at.x, top: at.y - 20 }}
      initial={{ y: 0, scale: 0.5, opacity: 0 }}
      animate={{ y: -44, scale: [0.5, 1.25, 1], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1.1, delay, ease: "easeOut" }}
    >
      {gain ? "+" : "-"}
      {money(Math.abs(amount))}
    </motion.span>
  );
}
