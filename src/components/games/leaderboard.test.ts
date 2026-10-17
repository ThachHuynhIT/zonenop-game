import { describe, expect, it } from "vitest";
import { toLeaderRows } from "./leaderboard";

describe("toLeaderRows", () => {
  it("reads the current-season payload with icon and colour", () => {
    const rows = toLeaderRows({ season: "current", rows: [{ name: "Lan", points: 12, games: 3, wins: 2, icon: "🐱", color: "#f00" }] });
    expect(rows).toEqual([{ name: "Lan", points: 12, games: 3, wins: 2, icon: "🐱", color: "#f00" }]);
  });
  it("accepts the old {players} shape and a bare array, defaulting icon and colour", () => {
    const old = [{ name: "Minh", points: -4, games: 5, wins: 1 }];
    const expected = [{ name: "Minh", points: -4, games: 5, wins: 1, icon: "", color: "" }];
    expect(toLeaderRows({ players: old })).toEqual(expected);
    expect(toLeaderRows(old)).toEqual(expected);
  });
  it("returns an empty list for junk and skips malformed rows", () => {
    expect(toLeaderRows(null)).toEqual([]);
    expect(toLeaderRows({ nope: 1 })).toEqual([]);
    expect(toLeaderRows({ rows: [null, { name: 5 }, { name: "Ok", points: "7", games: 1 }] })).toEqual([
      { name: "Ok", points: 0, games: 1, wins: 0, icon: "", color: "" },
    ]);
  });
});
