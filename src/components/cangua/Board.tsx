"use client";

import { useEffect, useRef, useState } from "react";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { AnimatePresence, m as motion } from "motion/react";
import { type Cell, FINAL, GATE, GRID, HOME_CELLS, STABLE, STABLE_ORIGIN, TRACK, cellOf, startIndex } from "@/lib/cangua/board";
import type { CNMove, CNPlayerView } from "@/lib/cangua/protocol";
import { cn } from "@/lib/utils";

/** Colour styles per horse colour (0 đỏ · 1 xanh dương · 2 vàng · 3 xanh lá). */
export const HORSE_COLORS = [
  { name: "Đỏ", fill: "#ef4444", deep: "#991b1b", soft: "#fecaca", text: "text-red-300" },
  { name: "Xanh dương", fill: "#3b82f6", deep: "#1e3a8a", soft: "#bfdbfe", text: "text-sky-300" },
  { name: "Vàng", fill: "#facc15", deep: "#a16207", soft: "#fef08a", text: "text-yellow-300" },
  { name: "Xanh lá", fill: "#22c55e", deep: "#166534", soft: "#bbf7d0", text: "text-emerald-300" },
] as const;

const pct = (n: number) => `${(n / GRID) * 100}%`;
const keyOf = (pid: string, h: number) => `${pid}:${h}`;

/** Where a legal horse would land with this die (the server already said the move is legal). */
export function targetProgress(from: number, die: number, ladder: boolean): number {
  if (from === STABLE) return 0;
  if (ladder && from > GATE) return from + 1;
  if (ladder && from + die > GATE) return GATE + 1;
  return Math.min(from + die, FINAL);
}

// ─── Walking ────────────────────────────────────────────────────────

const STEP_MS = 170;

/**
 * Where each horse is drawn. The server jumps a horse straight to its new square; here it walks
 * there square by square, and a kicked horse flies back to its stable once the kicker arrives.
 */
function useWalkingHorses(players: CNPlayerView[], last: CNMove | null) {
  const flat = () => Object.fromEntries(players.flatMap((p) => p.horses.map((pos, h) => [keyOf(p.id, h), pos])));
  const [shown, setShown] = useState<Record<string, number>>(flat);
  const [flying, setFlying] = useState<Record<string, boolean>>({});
  const [boom, setBoom] = useState<{ cell: Cell; id: number } | null>(null);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const lastRef = useRef(last);
  lastRef.current = last;
  const key = players.map((p) => `${p.id}:${p.horses.join(",")}`).join("|");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const set = (k: string, pos: number) => setShown((m) => (m[k] === pos ? m : { ...m, [k]: pos }));
    const mv = lastRef.current;
    let walkMs = 0;
    const kicked: { k: string; cell: Cell }[] = [];
    for (const p of players) {
      p.horses.forEach((to, h) => {
        const k = keyOf(p.id, h);
        const from = shownRef.current[k];
        if (from === to) return;
        if (from === undefined || to < from) {
          // A kick (fly home after the walk) or a new game / forfeit (just put it back).
          const isKick = to === STABLE && mv?.kicked?.player === p.id && mv.kicked.horse === h;
          if (isKick && from !== undefined && from !== STABLE) kicked.push({ k, cell: cellOf(p.color, from, h) });
          else set(k, to);
          return;
        }
        if (from === STABLE) {
          set(k, to);
          walkMs = Math.max(walkMs, 250);
          return;
        }
        const path = Array.from({ length: to - from }, (_, i) => from + i + 1);
        const step = Math.max(70, Math.min(STEP_MS, 1800 / path.length));
        path.forEach((pos, i) => later(step * (i + 1), () => set(k, pos)));
        walkMs = Math.max(walkMs, step * path.length);
      });
    }
    if (kicked.length) {
      later(walkMs + 60, () => {
        setBoom({ cell: kicked[0].cell, id: Date.now() });
        setFlying((f) => ({ ...f, ...Object.fromEntries(kicked.map((x) => [x.k, true])) }));
        kicked.forEach((x) => set(x.k, STABLE));
      });
    }
    return () => timers.forEach(clearTimeout);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expire the kick effects on their own clock: the next move's effect cleanup must not keep them.
  useEffect(() => {
    if (!boom) return;
    const a = setTimeout(() => setFlying({}), 850);
    const b = setTimeout(() => setBoom(null), 1100);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [boom]);

  return { pos: (pid: string, h: number, fallback: number) => shown[keyOf(pid, h)] ?? fallback, flying, boom };
}

// ─── Board ──────────────────────────────────────────────────────────

const HOME_STEP = new Map<string, { color: number; step: number }>();
HOME_CELLS.forEach((cells, color) => cells.forEach(([r, c], i) => HOME_STEP.set(`${r},${c}`, { color, step: i + 1 })));
const START_AT = new Map<number, number>([0, 1, 2, 3].map((c) => [startIndex(c), c]));
const GATE_AT = new Map<number, number>([0, 1, 2, 3].map((c) => [(startIndex(c) + GATE) % TRACK.length, c]));

export function CaNguaBoard({
  players,
  last,
  turn,
  legal,
  die,
  ladder,
  onPick,
  meId,
}: {
  players: CNPlayerView[];
  last: CNMove | null;
  turn: string | null;
  /** Horses of the current player I may move (empty unless it's my move). */
  legal: number[];
  die: number | null;
  ladder: boolean;
  onPick?: (horse: number) => void;
  meId: string;
}) {
  const { pos, flying, boom } = useWalkingHorses(players, last);
  const [hover, setHover] = useState<number | null>(null);
  const mover = players.find((p) => p.id === turn) ?? null;
  const targets =
    mover && die !== null && onPick
      ? legal.map((h) => ({ h, cell: cellOf(mover.color, targetProgress(mover.horses[h], die, ladder), h) }))
      : [];
  const usedColors = new Set(players.filter((p) => !p.forfeited).map((p) => p.color));

  // Horses drawn per cell, to fan out any that share a square (mid-walk, or stable slots).
  const placed = players.flatMap((p) =>
    p.horses.map((real, h) => {
      const at = pos(p.id, h, real);
      return { p, h, at, cell: cellOf(p.color, at, h) };
    }),
  );
  const stacks = new Map<string, number>();
  const stackIndex = placed.map((x) => {
    const k = x.cell.join(",");
    const i = stacks.get(k) ?? 0;
    stacks.set(k, i + 1);
    return i;
  });

  return (
    <div className="relative aspect-square w-full select-none rounded-[4%] bg-[#e9dcbc] p-[1.5%] shadow-[0_10px_40px_rgba(0,0,0,0.55),inset_0_0_0_3px_#b89a5e] [container-type:inline-size]">
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)`, gridTemplateRows: `repeat(${GRID}, 1fr)` }}>
        {STABLE_ORIGIN.map(([r, c], color) => {
          const col = HORSE_COLORS[color];
          return (
            <div
              key={`s${color}`}
              className={cn("relative rounded-[10%] shadow-inner ring-1 ring-black/20", !usedColors.has(color) && "opacity-45 saturate-50")}
              style={{ gridArea: `${r + 1} / ${c + 1} / span 6 / span 6`, background: `linear-gradient(145deg, ${col.fill}, ${col.deep})` }}
            >
              <div className="absolute inset-[12%] rounded-[14%] bg-white/85 shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)]" />
              {[
                [1, 1],
                [1, 4],
                [4, 1],
                [4, 4],
              ].map(([dr, dc]) => (
                <span
                  key={`${dr}${dc}`}
                  className="absolute aspect-square w-[15%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed"
                  style={{ left: `${((dc + 0.5) / 6) * 100}%`, top: `${((dr + 0.5) / 6) * 100}%`, borderColor: col.deep, background: col.soft }}
                />
              ))}
            </div>
          );
        })}

        {TRACK.map(([r, c], i) => {
          const start = START_AT.get(i);
          const gate = GATE_AT.get(i);
          const col = start !== undefined ? HORSE_COLORS[start] : null;
          return (
            <div
              key={`t${i}`}
              className="relative flex items-center justify-center border-[0.5px] border-[#a88d55]/70 text-[2.6cqw] font-black leading-none"
              style={{ gridArea: `${r + 1} / ${c + 1}`, background: col ? col.fill : "#fffaf0", color: col ? "white" : undefined }}
            >
              {start !== undefined && <span className="opacity-90 drop-shadow">★</span>}
              {gate !== undefined && (
                <span className="absolute inset-[30%] rounded-full" style={{ background: HORSE_COLORS[gate].fill, opacity: 0.55 }} />
              )}
            </div>
          );
        })}

        {HOME_CELLS.flatMap((cells, color) =>
          cells.map(([r, c], i) => {
            const col = HORSE_COLORS[color];
            return (
              <div
                key={`h${color}${i}`}
                className="flex items-center justify-center border-[0.5px] border-[#a88d55]/70 text-[2.4cqw] font-black leading-none"
                style={{
                  gridArea: `${r + 1} / ${c + 1}`,
                  background: `color-mix(in srgb, ${col.fill} ${30 + i * 12}%, white)`,
                  color: col.deep,
                }}
              >
                {i + 1}
              </div>
            );
          }),
        )}

        <div
          className="flex items-center justify-center text-[3.4cqw]"
          style={{
            gridArea: "8 / 8",
            background: `conic-gradient(from 45deg, ${HORSE_COLORS[1].fill} 0 25%, ${HORSE_COLORS[2].fill} 0 50%, ${HORSE_COLORS[3].fill} 0 75%, ${HORSE_COLORS[0].fill} 0 100%)`,
          }}
        >
          🏆
        </div>
      </div>

      {/* Horses and markers share the grid's coordinate frame. */}
      <div className="pointer-events-none absolute inset-[1.5%]">
        {targets.map(({ h, cell: [r, c] }) => (
          <span
            key={`tg${h}`}
            className={cn(
              "absolute aspect-square w-[6.2%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.5cqw] border-dashed border-white motion-safe:animate-pulse",
              hover === h ? "bg-white/70" : "bg-white/30",
            )}
            style={{ left: pct(c + 0.5), top: pct(r + 0.5), boxShadow: "0 0 1.2cqw rgba(255,255,255,0.9)" }}
          />
        ))}

        {placed.map(({ p, h, at, cell: [r, c] }, idx) => {
          const col = HORSE_COLORS[p.color];
          const n = stacks.get(`${r},${c}`) ?? 1;
          const si = stackIndex[idx];
          const dx = n > 1 ? (si % 2 ? 1 : -1) * 0.18 : 0;
          const dy = n > 1 ? (si < 2 ? -1 : 1) * 0.18 * (n > 2 ? 1 : 0) : 0;
          const canPick = !!onPick && p.id === turn && legal.includes(h);
          const k = keyOf(p.id, h);
          const isFly = !!flying[k];
          const isTurn = p.id === turn;
          return (
            <button
              key={k}
              type="button"
              disabled={!canPick}
              onClick={canPick ? () => onPick?.(h) : undefined}
              onPointerEnter={() => canPick && setHover(h)}
              onPointerLeave={() => setHover(null)}
              aria-label={`Ngựa ${col.name} ${h + 1}${canPick ? " — bấm để đi" : ""}`}
              className={cn(
                "absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[0.45cqw] border-white text-[3.4cqw] leading-none shadow-[0_0.5cqw_1cqw_rgba(0,0,0,0.55)]",
                n > 1 ? "w-[5%]" : "w-[6.2%]",
                canPick ? "pointer-events-auto z-30 cursor-pointer" : "z-10",
                p.forfeited && "opacity-30 grayscale",
                at > GATE && "z-20",
              )}
              style={{
                left: pct(c + 0.5 + dx),
                top: pct(r + 0.5 + dy),
                background: `radial-gradient(circle at 35% 30%, ${col.soft}, ${col.fill} 45%, ${col.deep})`,
                transition: isFly ? "left 0.7s cubic-bezier(.3,1.4,.6,1), top 0.7s cubic-bezier(.3,1.4,.6,1)" : `left ${STEP_MS - 20}ms ease-out, top ${STEP_MS - 20}ms ease-out`,
              }}
            >
              {canPick && (
                <span
                  aria-hidden
                  className="absolute -inset-[35%] rounded-full motion-safe:animate-ping"
                  style={{ boxShadow: `0 0 0 0.5cqw white, 0 0 2cqw 0.6cqw ${col.fill}` }}
                />
              )}
              {canPick && <span aria-hidden className="absolute -inset-[22%] rounded-full ring-[0.6cqw] ring-white shadow-[0_0_2cqw_white]" />}
              {/* Bigger invisible hit area: tokens are only ~22px wide on phones. */}
              {canPick && <span aria-hidden className="absolute left-1/2 top-1/2 h-[150%] min-h-11 w-[150%] min-w-11 -translate-x-1/2 -translate-y-1/2 rounded-full" />}
              {canPick && (
                <kbd
                  aria-hidden
                  className="absolute -right-[18%] -top-[18%] z-10 hidden size-[42%] min-w-3 place-items-center rounded-full bg-white font-mono text-[2.2cqw] font-black leading-none text-black shadow lg:grid [@media(pointer:coarse)]:hidden"
                >
                  {legal.indexOf(h) + 1}
                </kbd>
              )}
              <span className={cn("relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]", isFly && "motion-safe:animate-spin", p.id === meId && !canPick && isTurn && "motion-safe:animate-bounce")}>
                🐴
              </span>
            </button>
          );
        })}

        <AnimatePresence>
          {boom && (
            <motion.span
              key={boom.id}
              initial={{ scale: 0.2, opacity: 0, rotate: -30 }}
              animate={{ scale: 1.6, opacity: 1, rotate: 0 }}
              exit={{ scale: 2.2, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 12 }}
              className="absolute z-40 -translate-x-1/2 -translate-y-1/2 text-[7cqw]"
              style={{ left: pct(boom.cell[1] + 0.5), top: pct(boom.cell[0] + 0.5) }}
            >
              💥
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Die ────────────────────────────────────────────────────────────

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

/** A die that tumbles through random faces for a moment whenever `seq` changes, then shows `value`. */
export function RollingDie({ value, seq, color, size = "md" }: { value: number | null; seq: number; color?: string; size?: "md" | "lg" }) {
  const [face, setFace] = useState(value ?? 1);
  const [rolling, setRolling] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      setFace(value ?? 1);
      return;
    }
    if (value === null) return;
    setRolling(true);
    const spin = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70);
    const stop = setTimeout(() => {
      clearInterval(spin);
      setFace(value);
      setRolling(false);
    }, 550);
    return () => {
      clearInterval(spin);
      clearTimeout(stop);
    };
  }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.div
      key={seq}
      initial={{ rotate: -220, scale: 0.5 }}
      animate={{ rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 14 }}
      className={cn(
        "grid shrink-0 grid-cols-3 grid-rows-3 gap-[2px] rounded-xl bg-white shadow-[0_6px_18px_rgba(0,0,0,0.5),inset_0_-3px_0_rgba(0,0,0,0.15)]",
        size === "lg" ? "h-16 w-16 p-2.5" : "h-12 w-12 p-2",
        rolling && "motion-safe:animate-bounce",
      )}
      style={color ? { boxShadow: `0 0 0 3px ${color}, 0 6px 18px rgba(0,0,0,0.5)` } : undefined}
      aria-label={value ? `Xúc xắc: ${value}` : "Xúc xắc"}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={cn("rounded-full", PIPS[face]?.includes(i) && (face === 1 || face === 4 ? "bg-red-600" : "bg-stone-900"))} />
      ))}
    </motion.div>
  );
}

/** Small round horse token for panels. */
export function HorseChip({ color, className }: { color: number; className?: string }) {
  const col = HORSE_COLORS[color] ?? HORSE_COLORS[0];
  return (
    <span
      className={cn("inline-flex aspect-square w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-sm leading-none shadow", className)}
      style={{ background: `radial-gradient(circle at 35% 30%, ${col.soft}, ${col.fill} 45%, ${col.deep})` }}
    >
      🐴
    </span>
  );
}

