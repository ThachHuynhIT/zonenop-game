import { describe, expect, it } from "vitest";
import { PROFILE_COLORS } from "@/components/games/gameClient";
import { seatTokens } from "./tokens";

const piece = (id: string) => ({ emoji: `piece-${id}`, color: "#000000" });
const seat = (id: string, name = id) => ({ id, name });

describe("seatTokens", () => {
  it("uses each player's site look, and the name's first letter when they picked no icon", () => {
    const t = seatTokens([seat("a", "Lan"), seat("b", "minh")], { Lan: { icon: "🦊", color: PROFILE_COLORS[1] }, minh: { icon: "", color: PROFILE_COLORS[2] } }, piece);
    expect(t.get("a")).toEqual({ emoji: "🦊", color: PROFILE_COLORS[1] });
    expect(t.get("b")).toEqual({ emoji: "M", color: PROFILE_COLORS[2] });
  });

  it("gives the later seat a free colour when two players wear the same one, the same on every screen", () => {
    const looks = { Lan: { icon: "🦊", color: PROFILE_COLORS[0] }, Minh: { icon: "🐼", color: PROFILE_COLORS[0] } };
    const t = seatTokens([seat("a", "Lan"), seat("b", "Minh")], looks, piece);
    expect(t.get("a")!.color).toBe(PROFILE_COLORS[0]);
    expect(t.get("b")!.color).not.toBe(PROFILE_COLORS[0]);
    expect(PROFILE_COLORS).toContain(t.get("b")!.color);
    expect(t.get("b")!.emoji).toBe("🐼");
    expect(seatTokens([seat("a", "Lan"), seat("b", "Minh")], looks, piece)).toEqual(t);
  });

  it("keeps every colour distinct for a full table of the same colour", () => {
    const names = ["A", "B", "C", "D", "E", "F"];
    const looks = Object.fromEntries(names.map((n) => [n, { icon: "", color: PROFILE_COLORS[3] }]));
    const t = seatTokens(names.map((n) => seat(n)), looks, piece);
    expect(new Set([...t.values()].map((x) => x.color)).size).toBe(names.length);
  });

  it("keeps the in-game piece for a seat without a look (older client)", () => {
    const t = seatTokens([seat("a", "Lan")], {}, piece);
    expect(t.get("a")).toEqual(piece("a"));
  });
});
