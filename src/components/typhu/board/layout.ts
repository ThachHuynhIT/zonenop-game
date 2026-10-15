import { AIR_RENT, isOwnable, type Square } from "@/lib/typhu/board";
import type { Deed } from "@/lib/typhu/protocol";

/** Compact number for tiny squares: 220, 1k, 1,3k. */
export function shortNum(n: number): string {
  if (n < 1000) return String(n);
  const k = Math.round(n / 100) / 10;
  return `${String(k).replace(".", ",")}k`;
}

/**
 * Rent due on an owned square right now (null = no deed, or it depends on the dice). `ownerCount` = squares of the same
 * kind (airports / utilities) the owner holds; `fullGroup` = the owner holds the whole colour group.
 */
export function rentAmount(sq: Square, deed: Deed | undefined, ownerCount: number, fullGroup: boolean): number | null {
  if (!deed || !isOwnable(sq)) return null;
  if (deed.mortgaged) return 0;
  if (sq.kind === "prop") return deed.houses > 0 ? sq.rent[deed.houses] : fullGroup ? sq.rent[0] * 2 : sq.rent[0];
  if (sq.kind === "air") return AIR_RENT[Math.max(0, ownerCount - 1)];
  return null; // utilities: dice total × multiplier
}

/** The one number a compact square shows: price when free, rent when owned, the amount for a tax; "" for icon-only squares. */
export function cellLabel(sq: Square, deed: Deed | undefined, rent: number | null): string {
  if (sq.kind === "tax") return shortNum(sq.amount);
  if (!isOwnable(sq)) return "";
  if (!deed) return shortNum(sq.price);
  if (deed.mortgaged) return "TC";
  return rent === null ? "🎲" : shortNum(rent);
}

const SLOTS: { x: number; y: number }[][] = [
  [],
  [{ x: 50, y: 50 }],
  [{ x: 30, y: 50 }, { x: 70, y: 50 }],
  [{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 50, y: 72 }],
  [{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 30, y: 70 }, { x: 70, y: 70 }],
  [{ x: 18, y: 30 }, { x: 50, y: 30 }, { x: 82, y: 30 }, { x: 30, y: 72 }, { x: 70, y: 72 }],
  [{ x: 18, y: 30 }, { x: 50, y: 30 }, { x: 82, y: 30 }, { x: 18, y: 72 }, { x: 50, y: 72 }, { x: 82, y: 72 }],
];
const SCALE = [0, 1, 0.8, 0.7, 0.65, 0.5, 0.5];

/** Where tokens sharing a square sit (percent of the square) so none covers another. */
export function tokenSlots(n: number): { x: number; y: number; scale: number }[] {
  const k = Math.max(0, Math.min(6, Math.floor(n)));
  return SLOTS[k].map((s) => ({ ...s, scale: SCALE[k] }));
}

/** Smallest token (px) on a square shared by `n` tokens: smaller as more crowd a 20 px square, so no two overlap by more than 30%. */
export function tokenMinPx(n: number): number {
  return n <= 1 ? 12 : n <= 4 ? 11 : 8;
}

/** Width of a side square: the grid is `1.6fr repeat(edge - 1, 1fr) 1.6fr`. */
export const sideCellPx = (boardPx: number, edge: number) => boardPx / (edge - 1 + 3.2);

export const COMPACT_CELL_PX = 64;
export const isCompact = (cellPx: number) => cellPx < COMPACT_CELL_PX;
