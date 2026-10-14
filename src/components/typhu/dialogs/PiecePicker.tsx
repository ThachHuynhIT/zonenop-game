"use client";

import { useEffect } from "react";
import { PIECE_COLORS, PIECE_EMOJIS, type TPSeatView } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { pieceOfSeat, type Act } from "../shared";

/** Pick my token's emoji and colour (also the colour of my houses). Ones another player holds are greyed out. */
export function PiecePicker({ seats, meId, act, onClose }: { seats: (TPSeatView | null)[]; meId: string; act: Act; onClose: () => void }) {
  const me = seats.find((s) => s?.id === meId);
  const others = seats.filter((s): s is TPSeatView => !!s && s.id !== meId);
  const emojiTaken = (e: string) => others.some((o) => pieceOfSeat(o).emoji === e);
  const colorTaken = (c: string) => others.some((o) => pieceOfSeat(o).color === c);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!me) return null;
  const mine = pieceOfSeat(me);
  const choose = (emoji: string, color: string) => void act({ type: "pick", emoji, color });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#111013] p-5 text-white shadow-2xl">
        <h2 className="mb-1 text-lg font-bold text-amber-300">Quân cờ &amp; màu nhà</h2>
        <p className="mb-3 text-xs text-white/55">Không trùng với người chơi khác — ô mờ là đã có người dùng.</p>
        <div className="mb-3 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full border-2 border-white text-2xl" style={{ background: mine.color }}>
            {mine.emoji}
          </span>
          <span className="text-sm text-white/70">Quân của bạn</span>
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Quân cờ">
          {PIECE_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={mine.emoji === e}
              disabled={emojiTaken(e)}
              onClick={() => choose(e, mine.color)}
              className={cn("grid size-10 place-items-center rounded-lg border text-xl disabled:cursor-not-allowed disabled:opacity-25", mine.emoji === e ? "border-amber-300 bg-amber-400/20" : "border-white/15 hover:bg-white/10")}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Màu">
          {PIECE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={mine.color === c}
              aria-label={c}
              disabled={colorTaken(c)}
              onClick={() => choose(mine.emoji, c)}
              className={cn("size-8 rounded-full border-2 disabled:cursor-not-allowed disabled:opacity-25", mine.color === c ? "border-white" : "border-transparent")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300">
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
