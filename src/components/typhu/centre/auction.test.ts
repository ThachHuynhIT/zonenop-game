import { describe, expect, it } from "vitest";
import type { TPPlayerView } from "@/lib/typhu/protocol";
import { type AuctionView, BID_RAISES, bidBlocker, bidChoices, bidForKey, canFold, myMin } from "./auction";

// A 200tr square: the auction opens at 80% = 160tr; "p1" (me) is a bystander unless a test says otherwise.
const auction = (over: Partial<AuctionView> = {}): AuctionView => ({ pos: 3, bid: 160, bidder: null, minNext: 160, deadline: 1, folded: [], floor: 200, floorFor: "p9", ...over });
const me = (over: Partial<TPPlayerView> = {}): TPPlayerView => ({ id: "p1", pos: 0, cash: 1000, jail: 0, jailCards: 0, bankrupt: false, netWorth: 1000, ...over });

describe("bidChoices", () => {
  it("offers the start price first while nobody has bid, then every raise on top of it", () => {
    const c = bidChoices(auction(), 1000, "p1");
    expect(c.map((x) => x.id)).toEqual(["start", ...BID_RAISES.map((r) => `+${r}`)]);
    expect(c[0]).toMatchObject({ label: "Khởi điểm", amount: 160, hotkey: "Space", key: " " });
    expect(c.slice(1).map((x) => x.amount)).toEqual([170, 180, 210, 260, 360, 660]);
    expect(c.slice(1).map((x) => x.hotkey)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("raises the current price once someone leads (no start button)", () => {
    const c = bidChoices(auction({ bid: 220, bidder: "p2", minNext: 230 }), 1000, "p1");
    expect(c.map((x) => x.amount)).toEqual([230, 240, 270, 320, 420, 720]);
    expect(c.every((x) => x.amount >= 230)).toBe(true);
  });

  it("greys out what I can't pay in cash", () => {
    const c = bidChoices(auction({ bid: 220, bidder: "p2", minNext: 230 }), 300, "p1");
    expect(c.map((x) => x.affordable)).toEqual([true, true, true, false, false, false]); // 230 240 270 fit in 300; 320+ do not
    // Exactly enough cash is enough.
    expect(bidChoices(auction(), 160, "p1")[0].affordable).toBe(true);
    expect(bidChoices(auction(), 159, "p1")[0].affordable).toBe(false);
  });

  it("starts the player who declined to buy at the land price and drops raises below it", () => {
    const c = bidChoices(auction({ floorFor: "p1" }), 1000, "p1");
    expect(c[0]).toMatchObject({ id: "start", label: "Giá đất", amount: 200, hotkey: "Space" });
    // 170 and 180 are under the 200tr floor; 210+ stay with their own keys.
    expect(c.slice(1).map((x) => [x.amount, x.hotkey])).toEqual([[210, "3"], [260, "4"], [360, "5"], [660, "6"]]);
    expect(c.every((x) => x.amount >= 200)).toBe(true);
  });

  it("keeps a land-price button for the decliner while the lead is still under the floor", () => {
    const c = bidChoices(auction({ floorFor: "p1", bid: 170, bidder: "p2", minNext: 180 }), 1000, "p1");
    expect(c[0]).toMatchObject({ label: "Giá đất", amount: 200 });
    expect(c.slice(1).map((x) => x.amount)).toEqual([220, 270, 370, 670]);
  });

  it("treats the decliner like everyone else once the price passes the floor, and older servers as no floor", () => {
    expect(bidChoices(auction({ floorFor: "p1", bid: 250, bidder: "p2", minNext: 260 }), 1000, "p1").map((x) => x.amount)).toEqual([260, 270, 300, 350, 450, 750]);
    const old = auction({ folded: undefined, floor: undefined, floorFor: undefined });
    expect(bidChoices(old, 1000, "p1")[0]).toMatchObject({ label: "Khởi điểm", amount: 160 });
  });
});

describe("myMin", () => {
  it("is minNext for everyone but the decliner, who pays at least the land price", () => {
    expect(myMin(auction(), "p1")).toBe(160);
    expect(myMin(auction(), "p9")).toBe(200);
    expect(myMin(auction({ bid: 250, bidder: "p2", minNext: 260 }), "p9")).toBe(260);
    expect(myMin(auction(), null)).toBe(160);
  });
});

describe("bidForKey", () => {
  it("Space places the lowest bid allowed, 1–6 the raises", () => {
    expect(bidForKey(auction(), " ", 1000, "p1")).toBe(160);
    expect(bidForKey(auction({ bid: 220, bidder: "p2", minNext: 230 }), " ", 1000, "p1")).toBe(230);
    expect(bidForKey(auction({ bid: 220, bidder: "p2", minNext: 230 }), "3", 1000, "p1")).toBe(270);
    expect(bidForKey(auction(), "6", 1000, "p1")).toBe(660);
  });

  it("follows the decliner's floor: Space = land price, dropped raises do nothing", () => {
    expect(bidForKey(auction({ floorFor: "p1" }), " ", 1000, "p1")).toBe(200);
    expect(bidForKey(auction({ floorFor: "p1" }), "1", 1000, "p1")).toBeNull();
    expect(bidForKey(auction({ floorFor: "p1" }), "3", 1000, "p1")).toBe(210);
  });

  it("does nothing for other keys or when I can't pay", () => {
    expect(bidForKey(auction(), "7", 1000, "p1")).toBeNull();
    expect(bidForKey(auction(), "r", 1000, "p1")).toBeNull();
    expect(bidForKey(auction(), "6", 500, "p1")).toBeNull();
    expect(bidForKey(auction(), " ", 10, "p1")).toBeNull();
  });
});

describe("bidBlocker", () => {
  it("lets anyone still in the game bid, turn or not", () => {
    expect(bidBlocker(auction(), "player", me())).toBeNull();
    expect(bidBlocker(auction({ bid: 170, bidder: "p2", minNext: 180 }), "player", me())).toBeNull();
  });

  it("blocks the leader, the folded, the bankrupt and spectators", () => {
    expect(bidBlocker(auction({ bid: 170, bidder: "p1", minNext: 180 }), "player", me())).toBe("Bạn đang dẫn đầu");
    expect(bidBlocker(auction({ folded: ["p1"] }), "player", me())).toBe("Bạn đã bỏ cuộc");
    expect(bidBlocker(auction(), "player", me({ bankrupt: true }))).toBe("Bạn đã phá sản");
    expect(bidBlocker(auction(), "spectator", null)).toBe("Khán giả không trả giá được");
    expect(bidBlocker(auction(), "player", null)).toBe("Khán giả không trả giá được");
  });
});

describe("canFold", () => {
  it("lets anyone still in the auction fold, except the leader", () => {
    expect(canFold(auction(), "player", me())).toBe(true);
    expect(canFold(auction({ bid: 170, bidder: "p2", minNext: 180 }), "player", me())).toBe(true);
    expect(canFold(auction({ floorFor: "p1" }), "player", me())).toBe(true);
    expect(canFold(auction({ bid: 170, bidder: "p1", minNext: 180 }), "player", me())).toBe(false);
  });

  it("not twice, not when bankrupt, not for spectators, not on an older server", () => {
    expect(canFold(auction({ folded: ["p1"] }), "player", me())).toBe(false);
    expect(canFold(auction(), "player", me({ bankrupt: true }))).toBe(false);
    expect(canFold(auction(), "spectator", null)).toBe(false);
    expect(canFold(auction({ folded: undefined }), "player", me())).toBe(false);
  });
});
