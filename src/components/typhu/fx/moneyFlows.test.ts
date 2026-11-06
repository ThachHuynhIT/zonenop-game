import { describe, expect, it } from "vitest";
import { moneyFlows } from "./moneyFlows";

describe("moneyFlows", () => {
  it("sends rent from the tenant to the owner", () => {
    expect(moneyFlows({ a: 1000, b: 1000 }, { a: 800, b: 1200 })).toEqual([{ from: "a", to: "b", amount: 200 }]);
  });

  it("sends what nobody receives to the bank, and what nobody pays comes from it", () => {
    expect(moneyFlows({ a: 1000, b: 1000 }, { a: 700, b: 1000 })).toEqual([{ from: "a", to: null, amount: 300 }]);
    expect(moneyFlows({ a: 1000, b: 1000 }, { a: 1000, b: 1200 })).toEqual([{ from: null, to: "b", amount: 200 }]);
  });

  it("splits one payment over several receivers and keeps the totals", () => {
    const flows = moneyFlows({ a: 1000, b: 1000, c: 1000 }, { a: 700, b: 1100, c: 1100 });
    expect(flows).toEqual([
      { from: "a", to: "b", amount: 100 },
      { from: "a", to: "c", amount: 100 },
      { from: "a", to: null, amount: 100 },
    ]);
  });

  it("covers a payment bigger than the receipt with the bank", () => {
    expect(moneyFlows({ a: 1000, b: 1000 }, { a: 700, b: 1100 })).toEqual([
      { from: "a", to: "b", amount: 100 },
      { from: "a", to: null, amount: 200 },
    ]);
  });

  it("ignores unchanged cash, unknown players and skipped (bankrupt) players", () => {
    expect(moneyFlows({ a: 1000 }, { a: 1000, b: 500 })).toEqual([]);
    expect(moneyFlows({ a: 1000, b: 1000 }, { a: 0, b: 1500 }, new Set(["a"]))).toEqual([{ from: null, to: "b", amount: 500 }]);
  });
});
