import { describe, expect, it } from "vitest";
import type { TPPlayerView } from "@/lib/typhu/protocol";
import { type AuctionView, BID_RAISES, bidBlocker, bidChoices, bidForKey } from "./auction";

const auction = (over: Partial<AuctionView> = {}): AuctionView => ({ pos: 3, bid: 30, bidder: null, minNext: 30, deadline: 1, ...over });
const me = (over: Partial<TPPlayerView> = {}): TPPlayerView => ({ id: "p1", pos: 0, cash: 1000, jail: 0, jailCards: 0, bankrupt: false, netWorth: 1000, ...over });

describe("bidChoices", () => {
  it("offers the start price first while nobody has bid, then every raise on top of it", () => {
    const c = bidChoices(auction(), 1000);
    expect(c.map((x) => x.id)).toEqual(["start", ...BID_RAISES.map((r) => `+${r}`)]);
    expect(c[0]).toMatchObject({ amount: 30, hotkey: "Space", key: " " });
    expect(c.slice(1).map((x) => x.amount)).toEqual([40, 50, 80, 130, 230, 530]);
    expect(c.slice(1).map((x) => x.hotkey)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("raises the current price once someone leads (no start button)", () => {
    const c = bidChoices(auction({ bid: 120, bidder: "p2", minNext: 130 }), 1000);
    expect(c.map((x) => x.amount)).toEqual([130, 140, 170, 220, 320, 620]);
    expect(c.every((x) => x.amount >= 130)).toBe(true);
  });

  it("greys out what I can't pay in cash", () => {
    const c = bidChoices(auction({ bid: 120, bidder: "p2", minNext: 130 }), 200);
    expect(c.map((x) => x.affordable)).toEqual([true, true, true, false, false, false]); // 130 140 170 fit in 200; 220+ do not
    // Exactly enough cash is enough.
    expect(bidChoices(auction(), 30)[0].affordable).toBe(true);
    expect(bidChoices(auction(), 29)[0].affordable).toBe(false);
  });
});

describe("bidForKey", () => {
  it("Space places the lowest bid allowed, 1–6 the raises", () => {
    expect(bidForKey(auction(), " ", 1000)).toBe(30);
    expect(bidForKey(auction({ bid: 120, bidder: "p2", minNext: 130 }), " ", 1000)).toBe(130);
    expect(bidForKey(auction({ bid: 120, bidder: "p2", minNext: 130 }), "3", 1000)).toBe(170);
    expect(bidForKey(auction(), "6", 1000)).toBe(530);
  });

  it("does nothing for other keys or when I can't pay", () => {
    expect(bidForKey(auction(), "7", 1000)).toBeNull();
    expect(bidForKey(auction(), "r", 1000)).toBeNull();
    expect(bidForKey(auction(), "6", 500)).toBeNull();
    expect(bidForKey(auction(), " ", 10)).toBeNull();
  });
});

describe("bidBlocker", () => {
  it("lets anyone still in the game bid, turn or not", () => {
    expect(bidBlocker(auction(), "player", me())).toBeNull();
    expect(bidBlocker(auction({ bid: 50, bidder: "p2", minNext: 60 }), "player", me())).toBeNull();
  });

  it("blocks the leader, the bankrupt and spectators", () => {
    expect(bidBlocker(auction({ bid: 50, bidder: "p1", minNext: 60 }), "player", me())).toBe("Bạn đang dẫn đầu");
    expect(bidBlocker(auction(), "player", me({ bankrupt: true }))).toBe("Bạn đã phá sản");
    expect(bidBlocker(auction(), "spectator", null)).toBe("Khán giả không trả giá được");
    expect(bidBlocker(auction(), "player", null)).toBe("Khán giả không trả giá được");
  });
});
