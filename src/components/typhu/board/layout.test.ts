import { describe, expect, it } from "vitest";
import { BOARD, type Square } from "@/lib/typhu/board";
import type { Deed } from "@/lib/typhu/protocol";
import { COMPACT_CELL_PX, cellLabel, isCompact, rentAmount, shortNum, sideCellPx, tokenSlots } from "./layout";

const prop = BOARD.find((s) => s.kind === "prop") as Extract<Square, { kind: "prop" }>;
const air = BOARD.find((s) => s.kind === "air")!;
const util = BOARD.find((s) => s.kind === "util")!;
const tax = BOARD.find((s) => s.kind === "tax") as Extract<Square, { kind: "tax" }>;
const chance = BOARD.find((s) => s.kind === "chance")!;
const deed = (d: Partial<Deed> = {}): Deed => ({ owner: "p1", houses: 0, mortgaged: false, ...d }) as Deed;

describe("shortNum", () => {
  it("keeps small numbers and shortens thousands", () => {
    expect(shortNum(220)).toBe("220");
    expect(shortNum(1000)).toBe("1k");
    expect(shortNum(1250)).toBe("1,3k");
    expect(shortNum(2000)).toBe("2k");
  });
});

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

describe("cellLabel", () => {
  it("shows the price of a free square and the rent of an owned one", () => {
    expect(cellLabel(prop, undefined, null)).toBe(shortNum(prop.price));
    expect(cellLabel(prop, deed(), 26)).toBe("26");
  });
  it("marks mortgaged squares, dice-based rent and taxes", () => {
    expect(cellLabel(prop, deed({ mortgaged: true }), 0)).toBe("TC");
    expect(cellLabel(util, deed(), null)).toBe("🎲");
    expect(cellLabel(tax, undefined, null)).toBe(`Thuế ${shortNum(tax.amount)}`);
  });
  it("is empty for squares that only show an icon", () => {
    expect(cellLabel(chance, undefined, null)).toBe("");
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
