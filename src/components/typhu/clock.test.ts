import { describe, expect, it } from "vitest";
import type { TPGameView, TPRoomView } from "@/lib/typhu/protocol";
import { localizeTPView } from "./clock";

const SERVER = 1_000_000;

function view(current: Partial<TPGameView> | null): TPRoomView {
  return {
    game: "typhu",
    code: "ABCDE",
    meId: "p1",
    role: "player",
    serverTime: SERVER,
    settings: { startCash: 1500, timeLimit: 0 },
    seats: [],
    current: current && ({ status: "playing", players: [], deeds: {}, turn: "p1", phase: "roll", deadline: SERVER + 30_000, dice: null, rollAgain: false, debt: null, trade: null, lastCard: null, finished: [], endsAt: null, log: [], ...current } as TPGameView),
    history: [],
    spectators: [],
    reactions: [],
  };
}

describe("localizeTPView", () => {
  it("leaves a view without a game alone", () => {
    const v = view(null);
    expect(localizeTPView(v, SERVER + 5_000)).toBe(v);
  });

  it("shifts the turn deadline, the game end, offers and the auction by the same skew", () => {
    const skew = 120_000; // this browser's clock is two minutes ahead of the server's
    const out = localizeTPView(
      view({
        phase: "auction",
        deadline: SERVER + 15_000,
        endsAt: SERVER + 600_000,
        auction: { pos: 3, bid: 30, bidder: null, minNext: 30, deadline: SERVER + 15_000 },
        trade: { from: "a", to: "b", give: { props: [], cash: 0 }, get: { props: [], cash: 0 }, deadline: SERVER + 30_000 },
        loan: { from: "a", to: "b", amount: 100, rate: 10, deadline: SERVER + 30_000 },
      }),
      SERVER + skew,
    ).current!;
    expect(out.deadline).toBe(SERVER + 15_000 + skew);
    expect(out.auction!.deadline).toBe(out.deadline);
    expect(out.endsAt).toBe(SERVER + 600_000 + skew);
    expect(out.trade!.deadline).toBe(SERVER + 30_000 + skew);
    expect(out.loan!.deadline).toBe(SERVER + 30_000 + skew);
    // Everything else is untouched.
    expect(out.auction).toMatchObject({ pos: 3, bid: 30, bidder: null, minNext: 30 });
  });

  it("copes with servers that send no auction field, or a null one", () => {
    expect(localizeTPView(view({}), SERVER + 1_000).current!.auction).toBeUndefined();
    expect(localizeTPView(view({ auction: null }), SERVER + 1_000).current!.auction).toBeNull();
  });

  it("shifts backwards when the local clock is behind", () => {
    const out = localizeTPView(view({ auction: { pos: 1, bid: 30, bidder: "p2", minNext: 40, deadline: SERVER + 8_000 }, deadline: SERVER + 8_000 }), SERVER - 90_000).current!;
    expect(out.deadline).toBe(SERVER + 8_000 - 90_000);
    expect(out.auction!.deadline).toBe(out.deadline);
  });
});
