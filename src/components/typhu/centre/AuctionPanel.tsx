"use client";

import { cn } from "@/lib/utils";
import { isOwnable } from "@/lib/typhu/board";
import type { TPPlayerView, TPRoomView } from "@/lib/typhu/protocol";
import { boardRef } from "../board-ref";
import { CBtn, money, type Act } from "../shared";
import { AUCTION_MS, type AuctionView, bidBlocker, bidChoices } from "./auction";
import { BorderTimer } from "./BorderTimer";
import styles from "./AuctionPanel.module.scss";

/**
 * The auction of an unbought square, in the middle of the board: the square, the price, who leads, the clock on the
 * border and the buttons. Everyone still in the game may bid, not only the player whose turn is paused.
 * The hotkeys (Space, 1–6) live in `Centre`, from the same `bidChoices`.
 */
export function AuctionPanel({
  auction,
  role,
  mine,
  busy,
  run,
  nameOf,
}: {
  auction: AuctionView;
  role: TPRoomView["role"];
  mine: TPPlayerView | null;
  busy: boolean;
  run: Act;
  nameOf: (id: string) => string;
}) {
  const sq = boardRef.current[auction.pos];
  const price = sq && isOwnable(sq) ? sq.price : null;
  const blocker = bidBlocker(auction, role, mine);
  const choices = bidChoices(auction, mine?.cash ?? 0);
  const leading = !!mine && auction.bidder === mine.id;

  return (
    <section aria-label="Đấu giá" className={styles.panel}>
      <span className={styles.title}>🔨 Đấu giá</span>
      <BorderTimer deadline={auction.deadline} total={AUCTION_MS} />
      <p className={styles.square}>{sq?.name ?? "Ô đất"}</p>
      {price !== null && <p className={styles.list}>Giá đất {money(price)}</p>}
      <p className={styles.price} aria-live="polite">
        {money(auction.bid)}
      </p>
      <p className={cn(styles.leader, leading && styles.mine)} aria-live="polite">
        {auction.bidder === null ? "Chưa ai trả giá" : leading ? "👑 Bạn đang dẫn đầu" : `👑 ${nameOf(auction.bidder)} đang dẫn đầu`}
      </p>
      {blocker === null && mine ? (
        <>
          <div className={styles.choices}>
            {choices.map((c) => (
              <CBtn
                key={c.id}
                primary={c.id === "start"}
                hotkey={c.hotkey}
                onClick={() => void run({ type: "bid", amount: c.amount })}
                disabled={busy || !c.affordable}
                title={c.affordable ? `Trả ${money(c.amount)}` : `Không đủ tiền mặt (cần ${money(c.amount)})`}
                aria-label={`Trả ${money(c.amount)}`}
                className={cn("h-auto min-h-10 px-2 py-1", c.id === "start" && styles.wide)}
              >
                {c.id === "start" ? `${c.label} · ${money(c.amount)}` : c.label}
              </CBtn>
            ))}
          </div>
          <p className={styles.note}>Tiền mặt của bạn: {money(mine.cash)} · không dùng thế chấp để trả giá</p>
        </>
      ) : (
        <p className={styles.note}>{blocker}</p>
      )}
    </section>
  );
}
