import type { TPRoomView } from "@/lib/typhu/protocol";

/**
 * Shift the server-clock deadlines of a view onto the local clock (`localNow` = `Date.now()` when the view arrived).
 * Every deadline the table counts down must go through here, or two clocks on screen would disagree: the turn's
 * `deadline` and the auction's own copy of it are shifted by the same skew.
 */
export function localizeTPView(view: TPRoomView, localNow: number): TPRoomView {
  const g = view.current;
  if (!g) return view;
  const skew = localNow - view.serverTime;
  const shift = (t: number | null) => (t ? t + skew : t);
  return {
    ...view,
    current: {
      ...g,
      deadline: shift(g.deadline),
      endsAt: shift(g.endsAt),
      trade: g.trade ? { ...g.trade, deadline: g.trade.deadline + skew } : null,
      loan: g.loan ? { ...g.loan, deadline: g.loan.deadline + skew } : null,
      // Servers without the auction rule send no field at all: keep it that way.
      auction: g.auction ? { ...g.auction, deadline: g.auction.deadline + skew } : g.auction,
    },
  };
}
