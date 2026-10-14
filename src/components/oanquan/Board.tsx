"use client";

import { useEffect, useRef, useState } from "react";
import { SEGMENT, quanIndex, rowOf } from "@/lib/oanquan/board";
import type { OQGameView, OQMove } from "@/lib/oanquan/protocol";
import { cn } from "@/lib/utils";

/** What the board shows while a move is being replayed stone by stone. */
export interface SowFrame {
  seq: number;
  dan: number[];
  quan: boolean[];
  /** Square the hand is over (just sown into / picked up from). */
  cell: number | null;
  /** Stones still in the hand. */
  hand: number;
  /** Squares captured so far in this move (flash). */
  captured: number[];
  /** Captures not yet shown (this move's remaining + queued moves), so piles count up as they land. */
  pending: Record<string, { dan: number; quan: number }>;
  player: string;
}

const STEP_MS = 180;
/** Long relays are sped up so the replay never eats most of the next player's turn. */
const MAX_REPLAY_MS = 6500;
/** If more moves pile up than this (e.g. the tab was in the background), skip to the newest. */
const MAX_QUEUE = 2;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

const capturesOf = (m: OQMove) => {
  let dan = 0;
  let quan = 0;
  for (const s of m.steps) {
    if (s.k !== "capture") continue;
    dan += s.dan;
    if (s.quan) quan += 1;
  }
  return { dan, quan };
};

/**
 * Replays each new `lastMove` from the board before it, one stone per ~180 ms, in order
 * (a move that arrives mid-replay waits its turn). The move already on the board when the
 * table opens is not replayed.
 */
export function useSowReplay(g: OQGameView | null): SowFrame | null {
  const move = g?.lastMove ?? null;
  // seq restarts every game, so a move is identified by when it was made + its seq.
  const key = move ? `${move.at ?? 0}:${move.seq}` : null;
  // Every broadcast brings a new object; key the replay on the move's identity only.
  const moveRef = useRef(move);
  moveRef.current = move;
  const initial = useRef<string | null>(key);
  const queue = useRef<OQMove[]>([]);
  const running = useRef<{ timers: ReturnType<typeof setTimeout>[] } | null>(null);
  const [frame, setFrame] = useState<SowFrame | null>(null);

  const playNext = useRef<() => void>(() => {});
  playNext.current = () => {
    const next = queue.current.shift();
    if (!next) {
      running.current = null;
      setFrame(null);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    running.current = { timers };
    const delay = Math.max(55, Math.min(STEP_MS, MAX_REPLAY_MS / Math.max(1, next.steps.length)));
    replay(next, delay, queue.current, setFrame, timers, () => playNext.current());
  };

  useEffect(() => {
    const m = moveRef.current;
    if (!m || key === initial.current || prefersReducedMotion()) return;
    if (queue.current.some((q) => q.seq === m.seq && q.at === m.at)) return;
    queue.current.push(m);
    if (queue.current.length > MAX_QUEUE) queue.current = queue.current.slice(-1);
    if (!running.current) playNext.current();
  }, [key]);

  useEffect(
    () => () => {
      running.current?.timers.forEach(clearTimeout);
      running.current = null;
      queue.current = [];
    },
    [],
  );

  return frame;
}

function replay(
  move: OQMove,
  delay: number,
  queued: OQMove[],
  setFrame: (f: SowFrame | null) => void,
  timers: ReturnType<typeof setTimeout>[],
  done: () => void,
) {
  const pending: SowFrame["pending"] = {};
  for (const m of [move, ...queued]) {
    const c = capturesOf(m);
    const p = (pending[m.player] ??= { dan: 0, quan: 0 });
    p.dan += c.dan;
    p.quan += c.quan;
  }
  const f: SowFrame = {
    seq: move.seq,
    dan: move.before.dan.slice(),
    quan: move.before.quan.slice(),
    cell: move.cell,
    hand: 0,
    captured: [],
    pending,
    player: move.player,
  };
  const emit = () => setFrame({ ...f, dan: f.dan.slice(), quan: f.quan.slice(), pending: JSON.parse(JSON.stringify(f.pending)) });
  emit();
  move.steps.forEach((s, i) => {
    timers.push(
      setTimeout(() => {
        if (s.k === "pick") {
          f.hand = s.n;
          f.dan[s.cell] = 0;
          f.cell = s.cell;
        } else if (s.k === "sow") {
          f.hand = Math.max(0, f.hand - 1);
          f.dan[s.cell] += 1;
          f.cell = s.cell;
        } else {
          f.dan[s.cell] = 0;
          if (s.quan) f.quan[quanIndex(s.cell)] = false;
          f.cell = s.cell;
          f.captured = [...f.captured, s.cell];
          f.pending[move.player].dan -= s.dan;
          if (s.quan) f.pending[move.player].quan -= 1;
        }
        emit();
      }, delay * (i + 1)),
    );
  });
  // Hold the last frame a moment, then the next queued move (or the real board).
  timers.push(setTimeout(done, delay * (move.steps.length + 1) + 350));
}

// ─── Board ───────────────────────────────────────────────────────────

/** Squares in screen order for whoever sits at the bottom (two-player board). */
export function layoutFor(bottomSide: number, players = 2) {
  const bottom = rowOf(bottomSide);
  const top = rowOf((bottomSide + 1) % players).reverse();
  return { top, bottom, left: bottomSide * SEGMENT, right: ((bottomSide + 1) % players) * SEGMENT };
}

/** One colour per seat, shared by the ring tint, the name tags and the player strips. */
export const SIDE_COLORS = ["#fbbf24", "#fb7185", "#38bdf8", "#34d399"] as const;

export interface BoardPlayer {
  side: number;
  name: string;
  isTurn: boolean;
  out: boolean;
  self: boolean;
}

export function OQBoard({
  dan,
  quan,
  bottomSide,
  selectable,
  selected,
  onSelect,
  onSow,
  frame,
  lastCell,
  players = [],
}: {
  dan: number[];
  quan: boolean[];
  /** Side shown on the bottom (yours; side 0 for spectators). */
  bottomSide: number;
  /** Squares you may pick right now. */
  selectable: number[];
  selected: number | null;
  onSelect: (cell: number | null) => void;
  /** Sow the selected square: −1 = left, +1 = right (as seen on screen). */
  onSow: (dir: 1 | -1) => void;
  frame: SowFrame | null;
  /** Square the last move started from (subtle marker). */
  lastCell: number | null;
  /** Names / turn marker per side (drawn on the ring board with 3–4 players). */
  players?: BoardPlayer[];
}) {
  const n = quan.length;
  const cup = (cell: number, mine: boolean) => (
    <Cup
      key={cell}
      cell={cell}
      count={dan[cell]}
      mine={mine}
      selectable={selectable.includes(cell)}
      selected={selected === cell}
      active={frame?.cell === cell}
      flash={!!frame?.captured.includes(cell)}
      hand={frame?.cell === cell ? frame.hand : 0}
      started={!frame && lastCell === cell}
      hotkey={selectable.includes(cell) ? rowOf(bottomSide).indexOf(cell) + 1 : 0}
      onClick={() => onSelect(selected === cell ? null : cell)}
      onSow={onSow}
    />
  );
  const woodStyle = {
    background:
      "repeating-linear-gradient(92deg, rgba(0,0,0,0.07) 0 2px, transparent 2px 9px), repeating-linear-gradient(88deg, rgba(255,230,180,0.05) 0 1px, transparent 1px 23px), linear-gradient(180deg, #a8682f 0%, #8a5023 45%, #6e3c18 100%)",
  };
  const shadow =
    "shadow-[0_18px_40px_rgba(0,0,0,0.55),inset_0_2px_0_rgba(255,220,160,0.25),inset_0_-6px_14px_rgba(0,0,0,0.45)]";

  if (n > 2) {
    return (
      <RingBoard
        n={n}
        dan={dan}
        quan={quan}
        bottomSide={bottomSide}
        frame={frame}
        players={players}
        woodStyle={woodStyle}
        shadow={shadow}
        cup={(c) => cup(c, Math.floor(c / SEGMENT) === bottomSide)}
      />
    );
  }

  const { top, bottom, left, right } = layoutFor(bottomSide, n);
  const quanCup = (cell: number, side: "left" | "right") => (
    <QuanCup cell={cell} side={side} count={dan[cell]} hasQuan={quan[quanIndex(cell)]} active={frame?.cell === cell} flash={!!frame?.captured.includes(cell)} hand={frame?.cell === cell ? frame.hand : 0} />
  );
  return (
    <div
      className={cn("relative grid w-full select-none grid-cols-[1.35fr_repeat(5,minmax(0,1fr))_1.35fr] grid-rows-2 gap-[1.2%] rounded-[1.6rem] p-[2.2%] sm:rounded-[2.4rem]", shadow)}
      style={woodStyle}
    >
      {quanCup(left, "left")}
      {top.map((c) => cup(c, false))}
      {quanCup(right, "right")}
      {bottom.map((c) => cup(c, true))}
      {/* Divider groove between the two rows. */}
      <span aria-hidden className="pointer-events-none absolute inset-x-[16%] top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-black/25 shadow-[0_1px_0_rgba(255,220,160,0.18)]" />
    </div>
  );
}

/**
 * 3–4 players: the ring is a triangle / square. Segment i runs from corner i (its ô quan) to corner i+1;
 * the segment of the player at the bottom is the bottom edge, running left → right, and the ring continues
 * counter-clockwise on screen — so "phải" is always left → right on your own edge.
 */
function RingBoard({
  n,
  dan,
  quan,
  bottomSide,
  frame,
  players,
  woodStyle,
  shadow,
  cup,
}: {
  n: number;
  dan: number[];
  quan: boolean[];
  bottomSide: number;
  frame: SowFrame | null;
  players: BoardPlayer[];
  woodStyle: React.CSSProperties;
  shadow: string;
  cup: (cell: number) => React.ReactNode;
}) {
  // Board space: 100 wide, `h` tall (cups are sized in the same units, i.e. % of the width).
  const tri = n === 3;
  const h = tri ? 90 : 100;
  const verts: [number, number][] = tri
    ? [
        [8, 81],
        [92, 81],
        [50, 8.3],
      ]
    : [
        [10, 90],
        [90, 90],
        [90, 10],
        [10, 10],
      ];
  const CUP = tri ? 11.5 : 11;
  const QUAN = tri ? 14.5 : 14;
  const cx = verts.reduce((t, v) => t + v[0], 0) / n;
  const cy = verts.reduce((t, v) => t + v[1], 0) / n;
  const pos = (side: number) => (side - bottomSide + n) % n;
  const point = (cell: number): [number, number] => {
    const side = Math.floor(cell / SEGMENT);
    const k = cell % SEGMENT;
    const p = pos(side);
    const a = verts[p];
    const b = verts[(p + 1) % n];
    return [a[0] + ((b[0] - a[0]) * k) / SEGMENT, a[1] + ((b[1] - a[1]) * k) / SEGMENT];
  };
  const place = (cell: number, size: number) => {
    const [x, y] = point(cell);
    return { left: `${x}%`, top: `${(y / h) * 100}%`, width: `${size}%`, transform: "translate(-50%, -50%)" } as const;
  };
  return (
    <div
      className={cn("relative w-full select-none rounded-[1.6rem] sm:rounded-[2.4rem]", shadow)}
      style={{ ...woodStyle, aspectRatio: `100 / ${h}` }}
    >
      {/* Coloured track + name tag per player. */}
      <svg aria-hidden viewBox={`0 0 100 ${h}`} className="pointer-events-none absolute inset-0 h-full w-full">
        {Array.from({ length: n }, (_, side) => {
          const p = pos(side);
          const a = verts[p];
          const b = verts[(p + 1) % n];
          const pl = players.find((x) => x.side === side);
          return (
            <line
              key={side}
              x1={a[0]}
              y1={a[1]}
              x2={b[0]}
              y2={b[1]}
              stroke={SIDE_COLORS[side]}
              strokeWidth={CUP * 1.25}
              strokeLinecap="round"
              opacity={pl?.out ? 0.08 : pl?.isTurn ? 0.5 : 0.2}
            />
          );
        })}
      </svg>
      {players.map((pl) => {
        const p = pos(pl.side);
        const a = verts[p];
        const b = verts[(p + 1) % n];
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        // Pull the tag towards the middle of the board, away from the cups.
        const dx = cx - mx;
        const dy = cy - my;
        const len = Math.hypot(dx, dy) || 1;
        const off = 13;
        const x = mx + (dx / len) * off;
        const y = my + (dy / len) * off;
        return (
          <span
            key={pl.side}
            className={cn(
              "pointer-events-none absolute max-w-[30%] -translate-x-1/2 -translate-y-1/2 truncate rounded-full px-2 py-0.5 text-[clamp(9px,2.6vw,13px)] font-bold leading-tight text-black shadow",
              pl.out && "opacity-40 grayscale",
              pl.isTurn && "ring-2 ring-white",
            )}
            style={{ left: `${x}%`, top: `${(y / h) * 100}%`, background: SIDE_COLORS[pl.side] }}
          >
            {pl.isTurn && "▶ "}
            {pl.self ? "Bạn" : pl.name}
            {pl.out && " ✕"}
          </span>
        );
      })}
      {Array.from({ length: n * SEGMENT }, (_, c) =>
        c % SEGMENT === 0 ? (
          <div key={c} className="absolute" style={place(c, QUAN)}>
            <QuanDisc
              cell={c}
              count={dan[c]}
              hasQuan={quan[quanIndex(c)]}
              active={frame?.cell === c}
              flash={!!frame?.captured.includes(c)}
              hand={frame?.cell === c ? frame.hand : 0}
            />
          </div>
        ) : (
          <div key={c} className="absolute" style={place(c, CUP)}>
            {cup(c)}
          </div>
        ),
      )}
    </div>
  );
}

/** Round ô quan for the ring board (the two-player board uses the half-moon `QuanCup`). */
function QuanDisc({ cell, count, hasQuan, active, flash, hand }: { cell: number; count: number; hasQuan: boolean; active: boolean; flash: boolean; hand: number }) {
  return (
    <div className="relative aspect-square" aria-label={`Ô quan ${cell}: ${hasQuan ? "còn quan, " : ""}${count} dân`}>
      <div
        className={cn(
          "absolute inset-0 overflow-hidden rounded-full shadow-[inset_0_8px_16px_rgba(0,0,0,0.7),inset_0_-2px_5px_rgba(255,210,150,0.18),0_1px_0_rgba(255,220,160,0.25)]",
          "bg-[radial-gradient(circle_at_50%_45%,#4f2d12,#2a1506_78%)]",
          active && "ring-[3px] ring-sky-300",
          flash && "ring-[3px] ring-emerald-300 bg-emerald-900/60",
        )}
      >
        {hasQuan && (
          <span
            aria-hidden
            className="absolute left-1/2 top-[14%] h-[34%] w-[62%] -translate-x-1/2 rounded-[48%_52%_45%_55%] shadow-[0_3px_5px_rgba(0,0,0,0.7),inset_-3px_-4px_7px_rgba(0,0,0,0.45),inset_3px_3px_5px_rgba(255,255,255,0.45)]"
            style={{ background: "radial-gradient(circle at 35% 30%, #f3e3b4, #b8955a 55%, #7a5a2c)" }}
          />
        )}
        <div className={cn("absolute inset-x-[10%]", hasQuan ? "bottom-[8%] top-[50%]" : "inset-y-[14%]")}>
          <Pebbles n={count} max={14} spread={30} size={hasQuan ? 26 : 22} />
        </div>
      </div>
      <CountBadge n={count} className="-bottom-[6%] -right-[6%]" />
      <HandBadge n={hand} />
    </div>
  );
}

const STONE_TONES = ["#d9d2c3", "#bfb6a5", "#8f8a80", "#e7dcc8", "#a49a8a", "#cfc3ad", "#7d776f"];

/** Up to `max` pebbles scattered in a cup (deterministic, golden-angle spiral). */
function Pebbles({ n, max = 16, spread = 34, size = 19 }: { n: number; max?: number; spread?: number; size?: number }) {
  const shown = Math.min(n, max);
  return (
    <>
      {Array.from({ length: shown }, (_, i) => {
        const r = shown === 1 ? 0 : spread * Math.sqrt((i + 0.5) / shown);
        const a = i * 2.39996 + 0.7;
        return (
          <span
            key={i}
            aria-hidden
            className="absolute rounded-[45%] shadow-[0_1px_1.5px_rgba(0,0,0,0.6),inset_-1px_-1px_2px_rgba(0,0,0,0.35),inset_1px_1px_1.5px_rgba(255,255,255,0.55)]"
            style={{
              width: `${size}%`,
              height: `${size * 0.82}%`,
              left: `${50 + r * Math.cos(a) - size / 2}%`,
              top: `${50 + r * Math.sin(a) - (size * 0.82) / 2}%`,
              background: STONE_TONES[(i * 3) % STONE_TONES.length],
              transform: `rotate(${(i * 47) % 180}deg)`,
            }}
          />
        );
      })}
    </>
  );
}

function CountBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute z-10 min-w-[1.35em] rounded-full bg-black/70 px-1 text-center font-mono text-[clamp(10px,2.6vw,15px)] font-black leading-[1.35em] text-amber-100 ring-1 ring-amber-200/30",
        n === 0 && "opacity-40",
        className,
      )}
    >
      {n}
    </span>
  );
}

function HandBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-300 px-1.5 text-[11px] font-black text-black shadow-lg">
      ✋{n}
    </span>
  );
}

function Cup({
  cell,
  count,
  mine,
  selectable,
  selected,
  active,
  flash,
  hand,
  started,
  hotkey,
  onClick,
  onSow,
}: {
  cell: number;
  count: number;
  mine: boolean;
  selectable: boolean;
  selected: boolean;
  active: boolean;
  flash: boolean;
  hand: number;
  started: boolean;
  /** Number key (1–5, left → right on your row) that picks this square; 0 = none. Desktop only. */
  hotkey: number;
  onClick: () => void;
  onSow: (dir: 1 | -1) => void;
}) {
  return (
    <div className="relative aspect-square">
      <button
        type="button"
        disabled={!selectable}
        onClick={onClick}
        aria-label={`Ô ${cell}: ${count} dân${selectable ? " — bấm để chọn" : ""}`}
        className={cn(
          "absolute inset-0 overflow-hidden rounded-[30%] transition-[box-shadow,transform] duration-150",
          "shadow-[inset_0_6px_12px_rgba(0,0,0,0.65),inset_0_-2px_4px_rgba(255,210,150,0.18),0_1px_0_rgba(255,220,160,0.25)]",
          mine ? "bg-[radial-gradient(circle_at_50%_40%,#5a3417,#3a1f0b_75%)]" : "bg-[radial-gradient(circle_at_50%_40%,#4d2c13,#2f1808_75%)]",
          selectable && !selected && "cursor-pointer ring-2 ring-amber-300/60 hover:ring-amber-200 motion-safe:hover:-translate-y-0.5",
          selected && "ring-[3px] ring-amber-300",
          active && "ring-[3px] ring-sky-300",
          flash && "ring-[3px] ring-emerald-300 bg-emerald-900/60",
          started && "ring-1 ring-amber-100/40",
        )}
      >
        <Pebbles n={count} />
      </button>
      <CountBadge n={count} className="bottom-[3%] right-[3%]" />
      <HandBadge n={hand} />
      {hotkey > 0 && !selected && (
        <kbd
          aria-hidden
          className="pointer-events-none absolute left-[6%] top-[6%] z-10 hidden min-w-[1.3em] rounded bg-amber-300/90 px-1 text-center font-mono text-[11px] font-black leading-[1.3em] text-black shadow lg:block [@media(pointer:coarse)]:hidden"
        >
          {hotkey}
        </kbd>
      )}
      {selected && (
        <div className="absolute inset-0 z-20 flex overflow-hidden rounded-[30%] ring-[3px] ring-amber-300">
          <button
            type="button"
            onClick={() => onSow(-1)}
            className="flex flex-1 items-center justify-center bg-black/55 text-lg font-black text-amber-200 hover:bg-amber-500/50 active:bg-amber-500/70"
            aria-label="Rải sang trái"
          >
            ◀
          </button>
          <span className="w-px bg-amber-200/40" />
          <button
            type="button"
            onClick={() => onSow(1)}
            className="flex flex-1 items-center justify-center bg-black/55 text-lg font-black text-amber-200 hover:bg-amber-500/50 active:bg-amber-500/70"
            aria-label="Rải sang phải"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}

function QuanCup({
  cell,
  side,
  count,
  hasQuan,
  active,
  flash,
  hand,
}: {
  cell: number;
  side: "left" | "right";
  count: number;
  hasQuan: boolean;
  active: boolean;
  flash: boolean;
  hand: number;
}) {
  return (
    <div className="relative row-span-2" aria-label={`Ô quan ${cell}: ${hasQuan ? "còn quan, " : ""}${count} dân`}>
      <div
        className={cn(
          "absolute inset-0 overflow-hidden shadow-[inset_0_8px_16px_rgba(0,0,0,0.7),inset_0_-2px_5px_rgba(255,210,150,0.18),0_1px_0_rgba(255,220,160,0.25)] transition-[box-shadow]",
          side === "left" ? "rounded-l-[999px] rounded-r-[22%]" : "rounded-r-[999px] rounded-l-[22%]",
          "bg-[radial-gradient(ellipse_at_50%_45%,#4f2d12,#2a1506_78%)]",
          active && "ring-[3px] ring-sky-300",
          flash && "ring-[3px] ring-emerald-300 bg-emerald-900/60",
        )}
      >
        {hasQuan && (
          <span
            aria-hidden
            className="absolute left-1/2 top-[26%] h-[30%] w-[66%] -translate-x-1/2 rounded-[48%_52%_45%_55%] shadow-[0_3px_5px_rgba(0,0,0,0.7),inset_-3px_-4px_7px_rgba(0,0,0,0.45),inset_3px_3px_5px_rgba(255,255,255,0.45)]"
            style={{ background: "radial-gradient(circle at 35% 30%, #f3e3b4, #b8955a 55%, #7a5a2c)" }}
          />
        )}
        <div className={cn("absolute inset-x-[8%]", hasQuan ? "bottom-[6%] top-[52%]" : "inset-y-[16%]")}>
          <Pebbles n={count} max={14} spread={30} size={hasQuan ? 26 : 22} />
        </div>
      </div>
      {hasQuan && (
        <span className="pointer-events-none absolute left-1/2 top-[6%] z-10 -translate-x-1/2 rounded-full bg-amber-400/90 px-1.5 text-[10px] font-black uppercase tracking-wide text-black">
          Quan
        </span>
      )}
      <CountBadge n={count} className={cn("bottom-[4%]", side === "left" ? "left-[30%]" : "right-[30%]")} />
      <HandBadge n={hand} />
    </div>
  );
}
