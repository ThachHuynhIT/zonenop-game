"use client";

import { SeatAvatar } from "@/components/games/PlayerAvatar";
import NumberFlow from "@number-flow/react";
import { SeatBubble } from "@/components/tienlen/Effects";
import { signed } from "@/components/tienlen/Scoreboard";
import { GROUP_COLORS, MAX_HOUSES } from "@/lib/typhu/board";
import { type TPGameView, type TPPlayerView, type TPSeatView } from "@/lib/typhu/protocol";
import { type Reaction } from "@/lib/tienlen";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "@/components/games/ConfirmButton";
import { boardRef } from "../board-ref";

// ─── Side panel ─────────────────────────────────────────────────────

export function PlayerRow({
  seat,
  p,
  g,
  self,
  token,
  isTurn,
  reactions,
  onOpen,
  onPick,
  onKick,
}: {
  seat: TPSeatView;
  p: TPPlayerView | null;
  g: TPGameView | null;
  self: boolean;
  token: { emoji: string; color: string };
  isTurn: boolean;
  reactions: Reaction[];
  onOpen: (pos: number) => void;
  /** Own row only: opens the token picker. */
  onPick?: () => void;
  onKick?: () => void;
}) {
  const owned = g ? Object.entries(g.deeds).filter(([, d]) => d.owner === seat.id).map(([pos]) => Number(pos)) : [];
  return (
    <li className={cn("relative rounded-xl p-2", isTurn ? "bg-amber-400/15 ring-1 ring-amber-300/60" : "bg-white/5", p?.bankrupt && "opacity-50")}>
      <div className="flex items-center gap-2">
        <span className="relative">
          <SeatBubble reactions={reactions} />
          <button
            type="button"
            disabled={!onPick}
            onClick={onPick}
            title={onPick ? "Đổi quân cờ & màu" : undefined}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-lg",
              (!seat.connected || seat.kicked) && "grayscale",
              onPick && "cursor-pointer ring-amber-300 hover:ring-2 max-sm:min-h-9",
            )}
            style={{ background: token.color }}
          >
            {token.emoji}
          </button>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            {seat.isHost && <span title="Chủ bàn">👑</span>}
            <SeatAvatar name={seat.name} className="grid size-5 shrink-0 place-items-center rounded-full text-[11px]" fallbackClassName="bg-white/15 font-bold" />
            <span className="truncate">{seat.name}</span>
            {self && <span className="text-xs font-normal text-white/60">(bạn)</span>}
          </p>
          <p className="flex flex-wrap items-center gap-1 text-[11px] text-white/70">
            {p && !p.bankrupt && (
              <span className="font-mono text-emerald-300">
                💰 <NumberFlow value={p.cash} locales="vi-VN" suffix="tr" />
              </span>
            )}
            {p && !p.bankrupt && (
              <span className="font-mono text-white/50" title="Tổng tài sản">
                ≈ <NumberFlow value={p.netWorth} locales="vi-VN" suffix="tr" />
              </span>
            )}
            {p?.jail ? <span className="rounded bg-zinc-600 px-1">🚔 Ở tù</span> : null}
            {p && p.jailCards > 0 && <span title="Thẻ ra tù">🗝️×{p.jailCards}</span>}
            {p?.bankrupt && <span className="rounded bg-rose-900/60 px-1">Phá sản</span>}
            {!seat.connected && !seat.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">Mất kết nối</span>}
            {seat.kicked && <span className="rounded bg-rose-900/60 px-1 text-rose-200">Bị kích</span>}
            {seat.games > 0 && <span className={cn("font-mono", seat.points > 0 ? "text-emerald-300" : seat.points < 0 ? "text-rose-300" : "")}>{signed(seat.points)}đ</span>}
          </p>
        </div>
        {onKick && (
          <ConfirmButton
            onConfirm={onKick}
            confirmLabel="Chắc chắn?"
            title={p && !p.bankrupt ? "Kích người mất kết nối — họ bị tính phá sản" : "Mời người mất kết nối ra khỏi bàn"}
            className="rounded bg-rose-600 px-1.5 text-[11px] font-semibold text-white hover:bg-rose-500 max-sm:min-h-8 max-sm:px-2.5"
          >
            Kích
          </ConfirmButton>
        )}
      </div>
      {owned.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {owned.map((pos) => {
            const sq = boardRef.current[pos];
            const d = g!.deeds[pos];
            return (
              <button
                key={pos}
                onClick={() => onOpen(pos)}
                title={sq.name}
                className={cn("flex h-5 items-center justify-center gap-0.5 rounded px-1 text-[10px] font-semibold text-black max-sm:h-7 max-sm:min-w-7 max-sm:px-1.5 max-sm:text-[11px] short:h-6 short:min-w-6", d.mortgaged && "opacity-40 line-through")}
                style={{ background: sq.kind === "prop" ? GROUP_COLORS[sq.group] : "#e5e7eb" }}
              >
                {sq.kind === "air" ? "✈️" : sq.kind === "util" ? (sq.name.includes("Điện") ? "💡" : "🚰") : null}
                {sq.kind === "prop" ? sq.name.split(" ").map((w) => w[0]).join("") : ""}
                {d.houses > 0 && <span>{d.houses === MAX_HOUSES ? "🏨" : `${d.houses}🏠`}</span>}
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}
