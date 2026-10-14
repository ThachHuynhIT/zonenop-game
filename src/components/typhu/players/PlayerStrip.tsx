"use client";

import { useEffect, useRef } from "react";
import { type TPGameView, type TPSeatView } from "@/lib/typhu/protocol";
import { SeatChip } from "@/components/game-ui/SeatChip";

/** Phones held upright: everyone at the table as one row of chips above the board (tap one for their details). */
export function PlayerStrip({
  seats,
  g,
  meId,
  tokenOf,
  onOpen,
}: {
  seats: (TPSeatView | null)[];
  g: TPGameView | null;
  meId: string;
  tokenOf: (id: string) => { emoji: string; color: string };
  onOpen: (id: string) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const turn = g?.status === "playing" ? g.turn : null;
  // Keep the chip whose turn it is in view (horizontal scroll only, the page itself never jumps).
  useEffect(() => {
    const list = listRef.current;
    const chip = turn ? list?.querySelector<HTMLElement>(`[data-seat="${CSS.escape(turn)}"]`) : null;
    if (!list || !chip) return;
    list.scrollTo({ left: chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2, behavior: "smooth" });
  }, [turn]);

  return (
    <ul ref={listRef} aria-label="Người chơi" className="flex snap-x gap-2 overflow-x-auto pb-1 lg:hidden short:hidden">
      {seats
        .filter((s): s is TPSeatView => !!s)
        .map((seat) => {
          const p = g?.players.find((x) => x.id === seat.id);
          const token = tokenOf(seat.id);
          return (
            <li key={seat.id} data-seat={seat.id} className="shrink-0 snap-start">
              <button type="button" onClick={() => onOpen(seat.id)} className="block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                <SeatChip
                  size="sm"
                  name={seat.name}
                  profile={{ icon: token.emoji, color: token.color }}
                  points={p?.cash}
                  online={seat.connected}
                  isTurn={!!turn && turn === seat.id}
                  isHost={seat.isHost}
                  isYou={seat.id === meId}
                  out={p?.bankrupt}
                />
              </button>
            </li>
          );
        })}
    </ul>
  );
}
