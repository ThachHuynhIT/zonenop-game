"use client";

import { memo, useEffect, useRef, useState } from "react";
// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { m as motion } from "motion/react";
import { GROUP_COLORS, MAX_HOUSES, type Square, isOwnable } from "@/lib/typhu/board";
import { type Deed } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { tokenMinPx, tokenSlots } from "./layout";
import { ArtIcon, Building, money, squareImg } from "../shared";

/** Grid cell (1-based row/col) of a board position, Khởi hành bottom-right; the ring has `side` squares per edge. */
function cellOf(i: number, side: number): { row: number; col: number; side: "bottom" | "left" | "top" | "right" | "corner" } {
  const last = side + 1;
  if (i % side === 0) {
    const corners = [
      { row: last, col: last },
      { row: last, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: last },
    ];
    return { ...corners[i / side], side: "corner" };
  }
  if (i < side) return { row: last, col: last - i, side: "bottom" };
  if (i < 2 * side) return { row: last - (i - side), col: 1, side: "left" };
  if (i < 3 * side) return { row: 1, col: 1 + (i - 2 * side), side: "top" };
  return { row: 1 + (i - 3 * side), col: last, side: "right" };
}

// ─── Board cells ────────────────────────────────────────────────────

/** Burst over a cell the moment a house / hotel is built there: flash, expanding ring and flying sparks (gold and bigger for a hotel). */
function BuildBurst({ count }: { count: number }) {
  const prev = useRef(count);
  const [burst, setBurst] = useState<{ key: number; hotel: boolean } | null>(null);
  useEffect(() => {
    const grew = count > prev.current;
    prev.current = count;
    if (!grew) return;
    setBurst({ key: Date.now(), hotel: count === MAX_HOUSES });
    const t = setTimeout(() => setBurst(null), 1100);
    return () => clearTimeout(t);
  }, [count]);
  if (!burst) return null;
  const n = burst.hotel ? 12 : 8;
  const color = burst.hotel ? "#fbbf24" : "#ffffff";
  return (
    <span key={burst.key} className="pointer-events-none absolute inset-0 z-10" aria-hidden>
      <motion.span className="absolute inset-0" style={{ background: color }} initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} />
      <motion.span
        className="absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{ borderColor: color }}
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ scale: burst.hotel ? 2.6 : 1.8, opacity: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
      {Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * Math.PI * 2;
        const dist = (burst.hotel ? 120 : 90) * (i % 2 ? 1 : 0.65);
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 size-[5px] rounded-full"
            style={{ background: i % 3 === 0 ? "#fbbf24" : "#ffffff", boxShadow: "0 0 4px rgba(0,0,0,.5)" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * dist * 0.28, y: Math.sin(angle) * dist * 0.28, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        );
      })}
    </span>
  );
}

/** Houses on a colour band; the newest one pops in when built. */
function Buildings({ count, vertical }: { count: number; vertical: boolean }) {
  // Only buildings added after the page opened get the pop-in.
  const initialCount = useRef(count);
  if (count <= 0) return null;
  const hotel = count === MAX_HOUSES;
  return (
    <span className={cn("flex h-full w-full items-center justify-center gap-[1px] p-[1px]", vertical && "flex-col")}>
      {(hotel ? [0] : Array.from({ length: count }, (_, i) => i)).map((i) => (
        <motion.span
          key={`${hotel ? "hotel" : "house"}-${i}`}
          initial={i < initialCount.current && (!hotel || initialCount.current === MAX_HOUSES) ? false : { scale: 0, y: -8 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 14 }}
          className={cn("flex items-center justify-center drop-shadow", vertical ? "w-full" : "h-full", hotel ? (vertical ? "h-[70%]" : "w-[70%]") : vertical ? "h-[30%]" : "w-[30%]")}
        >
          <Building hotel={hotel} className="h-full w-full [filter:drop-shadow(1px_0_0_#fff)_drop-shadow(-1px_0_0_#fff)_drop-shadow(0_1px_0_#fff)_drop-shadow(0_-1px_0_#fff)]" />
        </motion.span>
      ))}
    </span>
  );
}

export interface CellToken {
  id: string;
  emoji: string;
  color: string;
  turn: boolean;
}

export const NO_TOKENS: CellToken[] = [];

/** Everything a square draws — the memo below compares these fields, not object identities (every server update brings fresh objects). */
interface CellProps {
  index: number;
  /** Squares per edge of the current map (the grid position depends on it). */
  edge: number;
  sq: Square;
  deed: Deed | undefined;
  /** Nghỉ chân's pot (0 elsewhere). */
  pot: number;
  owner: { emoji: string; color: string } | null;
  here: CellToken[];
  highlight: boolean;
  /** Narrow squares (phones): smaller icon and name, thinner colour band. */
  compact: boolean;
  onOpen: (pos: number) => void;
}

const sameCell = (a: CellProps, b: CellProps) =>
  a.index === b.index &&
  a.edge === b.edge &&
  a.sq === b.sq &&
  a.pot === b.pot &&
  a.highlight === b.highlight &&
  a.compact === b.compact &&
  a.onOpen === b.onOpen &&
  a.deed?.owner === b.deed?.owner &&
  a.deed?.houses === b.deed?.houses &&
  a.deed?.mortgaged === b.deed?.mortgaged &&
  a.owner?.emoji === b.owner?.emoji &&
  a.owner?.color === b.owner?.color &&
  a.here.length === b.here.length &&
  a.here.every((t, i) => t.id === b.here[i].id && t.emoji === b.here[i].emoji && t.color === b.here[i].color && t.turn === b.here[i].turn);

export const Cell = memo(function Cell({ index, edge, sq, deed, pot, owner, here, highlight, compact, onOpen }: CellProps) {
  const { row, col, side } = cellOf(index, edge);
  const band = sq.kind === "prop" ? GROUP_COLORS[sq.group] : null;
  const bandSide = side === "bottom" ? "top" : side === "top" ? "bottom" : side === "left" ? "right" : side === "right" ? "left" : null;
  const houses = deed?.houses ?? 0;
  // Owners already there when the page opened don't replay the badge animation.
  const initialOwner = useRef(deed?.owner);
  // Owner badge sits on the outer edge, away from the colour band.
  const badgePos =
    side === "bottom" ? "bottom-[1px] right-[1px]" : side === "top" ? "top-[1px] left-[1px]" : side === "left" ? "left-[1px] top-[1px]" : "right-[1px] bottom-[1px]";

  return (
    <button
      onClick={() => onOpen(index)}
      style={{
        gridRow: row,
        gridColumn: col,
        // Tint in the owner's colour, layered over the cream card colour.
        backgroundImage: owner ? `linear-gradient(135deg, ${owner.color}66, ${owner.color}26 65%, transparent)` : undefined,
        boxShadow: owner ? `inset 0 0 0 3px ${owner.color}` : undefined,
      }}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden bg-[#f4efe1] p-[1px] text-center leading-tight text-emerald-950 transition-colors hover:brightness-105",
        side === "corner" && "bg-[#e6f4ea]",
        highlight && "ring-2 ring-inset ring-amber-400",
        deed?.mortgaged && "opacity-60 grayscale-[40%]",
        band && bandSide === "top" && (compact ? (houses ? "pt-[30%]" : "pt-[18%]") : houses ? "pt-[40%]" : "pt-[22%]"),
        band && bandSide === "bottom" && (compact ? (houses ? "pb-[30%]" : "pb-[18%]") : houses ? "pb-[40%]" : "pb-[22%]"),
        band && bandSide === "left" && (compact ? (houses ? "pl-[30%]" : "pl-[18%]") : houses ? "pl-[40%]" : "pl-[22%]"),
        band && bandSide === "right" && (compact ? (houses ? "pr-[30%]" : "pr-[18%]") : houses ? "pr-[40%]" : "pr-[22%]"),
      )}
      title={deed ? `${sq.name} — chủ ${owner?.emoji}` : sq.name}
    >
      {band && bandSide && (
        <span
          className={cn(
            "absolute",
            bandSide === "top" && "inset-x-0 top-0",
            bandSide === "bottom" && "inset-x-0 bottom-0",
            bandSide === "left" && "inset-y-0 left-0",
            bandSide === "right" && "inset-y-0 right-0",
            bandSide === "top" || bandSide === "bottom"
              ? compact ? (houses ? "h-[30%]" : "h-[18%]") : houses ? "h-[40%]" : "h-[22%]"
              : compact ? (houses ? "w-[30%]" : "w-[18%]") : houses ? "w-[40%]" : "w-[22%]",
          )}
          style={{ background: band }}
        >
          <Buildings count={houses} vertical={bandSide === "left" || bandSide === "right"} />
        </span>
      )}
      {band && <BuildBurst count={houses} />}
      {compact ? (
        <span className="pointer-events-none flex flex-col items-center">
          {sq.kind !== "prop" && squareImg(sq) ? <ArtIcon name={squareImg(sq)!} className={side === "corner" ? "size-5" : "size-4"} /> : null}
          {/* The place name, not its price: tap the square for prices and rents. */}
          <span className="line-clamp-2 break-words text-[7px] font-semibold leading-[1.1]">{sq.kind === "air" ? sq.name.replace("Sân bay ", "SB ") : sq.name}</span>
          {sq.kind === "parking" && !!pot && <span className="rounded bg-amber-300 px-1 text-[10px] font-bold leading-none text-amber-950">💰 {money(pot)}</span>}
        </span>
      ) : (
        <span className="pointer-events-none flex flex-col items-center px-[2px]">
          {squareImg(sq) ? (
            <ArtIcon name={squareImg(sq)!} className={cn(side === "corner" ? "size-5 sm:size-9 short:size-5" : "size-3.5 sm:size-6 short:size-3.5")} />
          ) : null}
          <span className={cn("line-clamp-2 font-semibold", side === "corner" ? "text-[8px] sm:text-xs short:text-[8px]" : "text-[6px] sm:text-[9px] xl:text-[10px] short:text-[6px]")}>
            {sq.kind === "air" ? sq.name.replace("Sân bay ", "SB ") : sq.name}
          </span>
          {isOwnable(sq) && !deed && <span className="hidden text-[8px] text-emerald-900/70 sm:block short:hidden">{money(sq.price)}</span>}
          {deed?.mortgaged && <span className="text-[6px] font-bold text-rose-700 sm:text-[8px] short:text-[6px]">THẾ CHẤP</span>}
          {sq.kind === "parking" && !!pot && (
            <span className="rounded bg-amber-300 px-1 text-[7px] font-bold text-amber-950 sm:text-[10px] short:text-[7px]">💰 {money(pot)}</span>
          )}
        </span>
      )}
      {owner && deed && (
        <motion.span
          key={deed.owner}
          initial={deed.owner === initialOwner.current ? false : { scale: 3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className={cn(
            "pointer-events-none absolute flex aspect-square h-[30%] items-center justify-center rounded-full border border-white shadow",
            compact ? "min-h-[12px] text-[10px]" : "min-h-[10px] text-[6px] sm:text-[10px] short:text-[6px]",
            badgePos,
          )}
          style={{ background: owner.color }}
        >
          {owner.emoji}
        </motion.span>
      )}
      {here.length > 0 && (
        <span className="pointer-events-none absolute inset-0">
          {here.map((p, i) => {
            const slot = tokenSlots(here.length)[i] ?? tokenSlots(6)[i % 6];
            return (
              <motion.span
                key={p.id}
                layoutId={`token-${p.id}`}
                // Short tween per square: the walk itself is the square-by-square steps.
                transition={{ layout: { type: "tween", ease: "easeOut", duration: 0.16 } }}
                className={cn(
                  "absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white text-[8px] shadow-md sm:text-sm short:text-[8px]",
                  p.turn && "z-10 ring-2 ring-amber-400",
                )}
                // Height in percent of the square (aspect-square gives the width) so slots never overlap.
                style={{ left: `${slot.x}%`, top: `${slot.y}%`, height: `${42 * slot.scale}%`, minHeight: tokenMinPx(here.length), background: p.color }}
              >
                {p.emoji}
              </motion.span>
            );
          })}
        </span>
      )}
    </button>
  );
}, sameCell);
