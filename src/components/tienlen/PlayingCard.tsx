"use client";

import { type Card, RANK_LABELS, SUIT_SYMBOLS, isRed, rankOf, suitOf } from "@/lib/tienlen";
import { cn } from "@/lib/utils";

interface PlayingCardProps {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
  className?: string;
  style?: React.CSSProperties;
}

/** A card face drawn with plain markup — no images needed. */
export function PlayingCard({ card, selected, onClick, size = "md", className, style }: PlayingCardProps) {
  const rank = RANK_LABELS[rankOf(card)];
  const suit = SUIT_SYMBOLS[suitOf(card)];
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!selected : undefined}
      aria-label={`${rank}${suit}`}
      style={style}
      className={cn(
        "relative shrink-0 select-none rounded-[0.45em] border bg-[#fdfbf5] font-semibold leading-none",
        "shadow-[0_2px_6px_rgba(0,0,0,0.35)] transition-transform duration-150",
        size === "md" ? "w-[var(--cw)] text-[calc(var(--cw)*0.3)]" : "w-[var(--cw-sm)] text-[calc(var(--cw-sm)*0.3)]",
        "aspect-[5/7]",
        isRed(card) ? "text-[#c8102e]" : "text-[#16181d]",
        selected ? "-translate-y-[28%] border-amber-400 ring-2 ring-amber-400" : "border-black/15",
        onClick && "cursor-pointer hover:-translate-y-[10%] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
        onClick && selected && "hover:-translate-y-[28%]",
        className,
      )}
    >
      <span className="absolute left-[0.22em] top-[0.22em] flex flex-col items-center gap-[0.05em]">
        <span>{rank}</span>
        <span className="text-[0.85em]">{suit}</span>
      </span>
      <span className="absolute inset-0 flex items-center justify-center pl-[0.5em] pt-[0.7em] text-[1.6em]">{suit}</span>
    </Tag>
  );
}

/** Face-down card used for opponents' hands. */
export function CardBack({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "aspect-[5/7] w-[var(--cw-back)] rounded-[4px] border border-white/30 shadow-md",
        "bg-[repeating-linear-gradient(45deg,#7f1d1d_0_4px,#991b1b_4px_8px)]",
        className,
      )}
    />
  );
}
