"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/utils";
import type { PlayerProfile } from "@/components/games/gameClient";
import { GameAvatar } from "./GameAvatar";

/** A player at the table: avatar, name, live points, online dot, host crown, and a running light on their turn. */
export function SeatChip({
  name,
  profile,
  points,
  online = true,
  isTurn,
  isHost,
  isYou,
  out,
  size = "md",
  className,
}: {
  name: string;
  profile: PlayerProfile;
  points?: number;
  online?: boolean;
  isTurn?: boolean;
  isHost?: boolean;
  isYou?: boolean;
  out?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative inline-flex min-w-0 max-w-full items-center rounded-full border bg-black/35",
        size === "sm" ? "gap-1.5 py-0.5 pl-0.5 pr-2 text-xs" : "gap-2 py-1 pl-1 pr-3 text-sm",
        isTurn ? "border-transparent" : "border-white/10",
        !online && "opacity-60",
        className,
      )}
    >
      {isTurn && <span aria-hidden className="game-beam" />}
      <span className="relative shrink-0">
        <GameAvatar name={name} profile={profile} className={cn(size === "sm" ? "size-6 text-sm" : "size-9 text-lg", out && "grayscale")} />
        <span
          aria-hidden
          className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-black/60", online ? "bg-emerald-400" : "bg-zinc-500")}
        />
        {/* The host's crown sits on top of their avatar. */}
        {isHost && (
          <span role="img" aria-label="Chủ phòng" className={cn("pointer-events-none absolute left-1/2 -translate-x-1/2 leading-none drop-shadow", size === "sm" ? "-top-2 text-[10px]" : "-top-3 text-sm")}>
            👑
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1 font-bold leading-tight">
          <span className="truncate">{name}</span>
          {isYou && <span className="shrink-0 rounded-full bg-white/15 px-1.5 text-[10px] font-extrabold">Bạn</span>}
        </span>
        {points !== undefined && <NumberFlow value={points} className="block text-xs font-bold tabular-nums text-game-accent" />}
      </span>
      <span className="sr-only">
        {online ? "đang online" : "offline"}
        {isTurn ? ", đang tới lượt" : ""}
      </span>
    </div>
  );
}
