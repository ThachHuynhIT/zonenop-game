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

/** Why I can't bid now (null = I can). Anyone still in the game may bid, whether or not it is their turn. */
export function bidBlocker(a: AuctionView, role: TPRoomView["role"], mine: TPPlayerView | null): string | null {
  if (role !== "player" || !mine) return "Khán giả không trả giá được";
  if (mine.bankrupt) return "Bạn đã phá sản";
  if (a.bidder === mine.id) return "Bạn đang dẫn đầu";
  return null;
}

/**
 * The buttons: while nobody has bid, "Khởi điểm" (the start price, Space) first; then the raises on top of the current
 * price (always above `minNext`, so the server accepts them when I have the cash).
 */
export function bidChoices(a: AuctionView, cash: number): BidChoice[] {
  const choices: BidChoice[] = [];
  if (a.bidder === null) choices.push({ id: "start", label: "Khởi điểm", amount: a.minNext, key: " ", hotkey: "Space", affordable: cash >= a.minNext });
  BID_RAISES.forEach((raise, i) => {
    const amount = a.bid + raise;
    choices.push({ id: `+${raise}`, label: `+${raise}tr`, amount, key: String(i + 1), hotkey: String(i + 1), affordable: cash >= amount });
  });
  return choices;
}

/** The bid a key press places (Space = the lowest bid allowed), or null when the key does nothing or I can't pay. */
export function bidForKey(a: AuctionView, key: string, cash: number): number | null {
  const choices = bidChoices(a, cash);
  const hit = key === " " ? (a.bidder === null ? choices[0] : choices.find((c) => c.id === "+10")) : choices.find((c) => c.key === key);
  return hit?.affordable ? hit.amount : null;
}
