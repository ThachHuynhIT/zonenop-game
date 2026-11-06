import type { TPGameView, TPPlayerView, TPRoomView } from "@/lib/typhu/protocol";

/** The running auction as the server sends it (`TPGameView.auction`, never null here). */
export type AuctionView = NonNullable<NonNullable<TPGameView["auction"]>>;

/** be_game AUCTION_MS: the clock is never more than this long (each bid adds 5 s, capped at 15 s left). */
export const AUCTION_MS = 15_000;

/** Raises (tr) offered as buttons; the hotkeys are 1–6 in this order. */
export const BID_RAISES = [10, 20, 50, 100, 200, 500] as const;

export interface BidChoice {
  id: string;
  label: string;
  /** What `{ type: "bid", amount }` carries. */
  amount: number;
  /** The key that places it (`KeyboardEvent.key`) and the text of the badge on the button. */
  key: string;
  hotkey: string;
  /** I have the cash for it (bids are cash only: no mortgage in an auction). */
  affordable: boolean;
}

/** I declined to buy this square (skip / timeout), so I may only bid from the land price (`floor`) up. */
export function isDecliner(a: AuctionView, myId: string | null): boolean {
  return !!myId && a.floorFor === myId && typeof a.floor === "number" && a.floor > a.minNext;
}

/** The lowest bid the server accepts from me now: `minNext`, or the land price for the player who declined to buy. */
export function myMin(a: AuctionView, myId: string | null): number {
  return isDecliner(a, myId) ? Math.max(a.minNext, a.floor ?? 0) : a.minNext;
}

/** I dropped out of this auction ("Bỏ cuộc"). Older servers send no `folded`: nobody has. */
export function hasFolded(a: AuctionView, myId: string | null): boolean {
  return !!myId && (a.folded ?? []).includes(myId);
}

/** Why I can't bid now (null = I can). Anyone still in the game may bid, whether or not it is their turn. */
export function bidBlocker(a: AuctionView, role: TPRoomView["role"], mine: TPPlayerView | null): string | null {
  if (role !== "player" || !mine) return "Khán giả không trả giá được";
  if (mine.bankrupt) return "Bạn đã phá sản";
  if (hasFolded(a, mine.id)) return "Bạn đã bỏ cuộc";
  if (a.bidder === mine.id) return "Bạn đang dẫn đầu";
  return null;
}

/**
 * "Bỏ cuộc" (`{ type: "fold" }`) is open to anyone still in the game who has not folded yet, except the leader.
 * Only offered when the server sends `folded` (older servers do not know the command).
 */
export function canFold(a: AuctionView, role: TPRoomView["role"], mine: TPPlayerView | null): boolean {
  if (role !== "player" || !mine || mine.bankrupt) return false;
  if (!Array.isArray(a.folded)) return false;
  return !hasFolded(a, mine.id) && a.bidder !== mine.id;
}

/**
 * The buttons. First, when it applies, the lowest bid allowed (Space): "Khởi điểm" (the start price) while nobody has
 * bid, or "Giá đất" (the land price) for the player who declined to buy. Then the raises on top of the current price,
 * minus any below my minimum (so every button is a bid the server accepts when I have the cash).
 */
export function bidChoices(a: AuctionView, cash: number, myId: string | null): BidChoice[] {
  const min = myMin(a, myId);
  const choices: BidChoice[] = [];
  if (a.bidder === null || min > a.minNext) {
    const label = isDecliner(a, myId) ? "Giá đất" : "Khởi điểm";
    choices.push({ id: "start", label, amount: min, key: " ", hotkey: "Space", affordable: cash >= min });
  }
  BID_RAISES.forEach((raise, i) => {
    const amount = a.bid + raise;
    if (amount < min) return;
    choices.push({ id: `+${raise}`, label: `+${raise}tr`, amount, key: String(i + 1), hotkey: String(i + 1), affordable: cash >= amount });
  });
  return choices;
}

/** The bid a key press places (Space = the lowest bid allowed), or null when the key does nothing or I can't pay. */
export function bidForKey(a: AuctionView, key: string, cash: number, myId: string | null): number | null {
  const choices = bidChoices(a, cash, myId);
  const hit = key === " " ? (choices.find((c) => c.id === "start") ?? choices.find((c) => c.id === "+10")) : choices.find((c) => c.key === key);
  return hit?.affordable ? hit.amount : null;
}
