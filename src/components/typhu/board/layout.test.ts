import { describe, expect, it } from "vitest";
import { BOARD, type Square } from "@/lib/typhu/board";
import type { Deed } from "@/lib/typhu/protocol";
import { COMPACT_CELL_PX, isCompact, rentAmount, sideCellPx, tokenMinPx, tokenSlots } from "./layout";

const prop = BOARD.find((s) => s.kind === "prop") as Extract<Square, { kind: "prop" }>;
const air = BOARD.find((s) => s.kind === "air")!;
const util = BOARD.find((s) => s.kind === "util")!;
const deed = (d: Partial<Deed> = {}): Deed => ({ owner: "p1", houses: 0, mortgaged: false, ...d }) as Deed;

describe("rentAmount", () => {
  it("is the base rent, doubled for a full group, then the house row", () => {
    expect(rentAmount(prop, deed(), 1, false)).toBe(prop.rent[0]);
    expect(rentAmount(prop, deed(), 1, true)).toBe(prop.rent[0] * 2);
    expect(rentAmount(prop, deed({ houses: 2 }), 1, true)).toBe(prop.rent[2]);
  });
  it("is 0 while mortgaged, null for utilities (depends on the dice), null without a deed", () => {
    expect(rentAmount(prop, deed({ mortgaged: true }), 1, true)).toBe(0);
    expect(rentAmount(util, deed(), 1, false)).toBeNull();
    expect(rentAmount(prop, undefined, 0, false)).toBeNull();
  });
  it("grows with the number of airports owned", () => {
    expect(rentAmount(air, deed(), 2, false)).toBeGreaterThan(rentAmount(air, deed(), 1, false)!);
  });
});

describe("tokenSlots", () => {
  it("returns one slot per token, inside the cell, with centres at least 30% apart", () => {
    for (let n = 1; n <= 6; n++) {
      const slots = tokenSlots(n);
      expect(slots).toHaveLength(n);
      for (const s of slots) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(100);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(100);
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y)).toBeGreaterThanOrEqual(30);
    }
  });
  it("shrinks tokens as more share a cell and clamps the count", () => {
    expect(tokenSlots(1)[0].scale).toBeGreaterThan(tokenSlots(4)[0].scale);
    expect(tokenSlots(0)).toEqual([]);
    expect(tokenSlots(9)).toHaveLength(6);
  });
});

describe("compact cells", () => {
  it("measures a side square from the board width (corners are 1.6 squares wide)", () => {
    expect(sideCellPx(1220, 10)).toBeCloseTo(100, 5);
  });
  it("is compact under 64 px", () => {
    expect(COMPACT_CELL_PX).toBe(64);
    expect(isCompact(63.9)).toBe(true);
    expect(isCompact(64)).toBe(false);
  });
});

describe("tokens on the narrowest squares", () => {
  // Worst case on the huge map at 375 px: a 20 x 20 px square. A token is a circle of max(tokenMinPx, 42% x scale of the height).
  const overlap = (n: number, size: number) => {
    const slots = tokenSlots(n);
    const rects = slots.map((s) => {
      const d = Math.max(tokenMinPx(n), 0.42 * s.scale * size);
      return { x: (s.x / 100) * size - d / 2, y: (s.y / 100) * size - d / 2, d };
    });
    let worst = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const w = Math.min(rects[i].x + rects[i].d, rects[j].x + rects[j].d) - Math.max(rects[i].x, rects[j].x);
        const h = Math.min(rects[i].y + rects[i].d, rects[j].y + rects[j].d) - Math.max(rects[i].y, rects[j].y);
        if (w > 0 && h > 0) worst = Math.max(worst, (w * h) / Math.min(rects[i].d ** 2, rects[j].d ** 2));
      }
    return worst;
  };
  it("keeps tokens sharing a 20 px square under 30% overlap, 1 to 6 of them", () => {
    for (let n = 1; n <= 6; n++) expect(overlap(n, 20), `${n} tokens`).toBeLessThanOrEqual(0.3);
  });
  it("never goes below 8 px", () => {
    for (let n = 1; n <= 6; n++) expect(tokenMinPx(n)).toBeGreaterThanOrEqual(8);
  });
});
