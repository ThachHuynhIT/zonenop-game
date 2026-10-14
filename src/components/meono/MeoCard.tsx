"use client";

/* eslint-disable @next/next/no-img-element -- small static card art; next/image adds nothing here */
import { MEO_ART, MEO_ART_VERSION } from "@/lib/meono/art";
import { CARDS, type CardType, PACKS } from "@/lib/meono/cards";
import { cn } from "@/lib/utils";

/** What a card is for, shown as the colour of its name. Few groups on purpose, so the colours stay easy to learn. */
export type CardRole = "bomb" | "save" | "attack" | "info" | "cat";

export const ROLES: Record<CardRole, { label: string; emoji: string; text: string }> = {
  bomb: { label: "Bom", emoji: "💣", text: "text-red-400" },
  save: { label: "Né / cứu", emoji: "🛡️", text: "text-emerald-300" },
  attack: { label: "Tấn công / nhắm người", emoji: "⚔️", text: "text-orange-300" },
  info: { label: "Xem / xếp bài", emoji: "🔮", text: "text-sky-300" },
  cat: { label: "Mèo ghép bộ", emoji: "🐱", text: "text-amber-200" },
};

const ROLE_OF: Record<CardType, CardRole> = {
  exploding: "bomb",
  imploding: "bomb",
  defuse: "save",
  nope: "save",
  skip: "save",
  superskip: "save",
  reverse: "save",
  streaking: "save",
  zombie: "save",
  attack: "attack",
  targeted: "attack",
  personal: "attack",
  deadattack: "attack",
  favor: "attack",
  steal: "attack",
  ilt: "attack",
  mark: "attack",
  curse: "attack",
  annoy: "attack",
  slap: "attack",
  barking: "attack",
  catomic: "attack",
  rollcall: "attack",
  corn: "attack",
  clone: "attack",
  future: "info",
  future5: "info",
  alter: "info",
  alternow: "info",
  share: "info",
  clairvoyance: "info",
  shuffle: "info",
  swap: "info",
  bottom: "info",
  bury: "info",
  dig: "info",
  garbage: "info",
  potluck: "info",
  feed: "info",
  grave: "info",
  taco: "cat",
  melon: "cat",
  potato: "cat",
  beard: "cat",
  rainbow: "cat",
  feral: "cat",
};

export const roleOf = (t: CardType): CardRole => ROLE_OF[t] ?? "info";

interface MeoCardProps {
  type: CardType;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  faceDown?: boolean;
  className?: string;
  /** Show the rules text as a native tooltip. */
  tooltip?: boolean;
}

// Name size per card size; the hand overrides width (and --name) per breakpoint in MeoTable.
const SIZES = {
  sm: "w-12 [--name:8px] [--emoji:1.25rem]",
  md: "w-[4.6rem] [--name:10.5px] [--emoji:1.9rem] sm:w-20 sm:[--name:11px]",
  lg: "w-28 [--name:13px] [--emoji:2.8rem]",
};

const HAS_ART = new Set<string>(MEO_ART);
const artSrc = (name: CardType | "back") => (HAS_ART.has(name) ? `/games/meono/cards/${name}.webp?v=${MEO_ART_VERSION}` : null);

/**
 * A Mèo Nổ card: name on a dark strip at the top (full text, coloured by what the card does), the
 * artwork from public/games/meono/cards/ with rounded corners underneath (see scripts/card-art.mjs),
 * or a big emoji when a card has no art yet.
 */
export function MeoCard({ type, selected, onClick, size = "md", faceDown, className, tooltip = true }: MeoCardProps) {
  const info = CARDS[type];
  const Tag = onClick ? "button" : "div";
  // "hidden": a card of a cursed hand (Lời nguyền mông mèo) — you pick it blind.
  if (faceDown || !info) {
    const back = info ? artSrc("back") : null;
    return (
      <Tag
        onClick={onClick}
        className={cn(
          "aspect-[5/7] shrink-0 rounded-xl border-2 border-white/20 bg-[repeating-linear-gradient(135deg,#7c2d12_0_6px,#9a3412_6px_12px)] shadow-md transition-transform",
          SIZES[size],
          onClick && "hover:-translate-y-1",
          selected && "-translate-y-3 ring-2 ring-amber-300",
          className,
        )}
      >
        {back ? (
          <img src={back} alt="" draggable={false} className="h-full w-full rounded-[10px] object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[length:var(--emoji)] opacity-80">{info ? "🐱" : "🍑"}</div>
        )}
      </Tag>
    );
  }
  const art = artSrc(type);
  const role = ROLES[roleOf(type)];
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!selected : undefined}
      aria-label={info.name}
      title={tooltip ? `${info.name}\n${info.effect}` : undefined}
      className={cn(
        "relative flex aspect-[5/7] shrink-0 select-none flex-col gap-[3px] overflow-hidden rounded-xl border-2 bg-gradient-to-br p-[3px] font-bold text-white shadow-[0_3px_10px_rgba(0,0,0,0.4)] transition-transform duration-150",
        info.color,
        SIZES[size],
        selected ? "-translate-y-4 border-amber-300 ring-2 ring-amber-300" : "border-white/25",
        onClick && "cursor-pointer hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
        onClick && selected && "hover:-translate-y-4",
        className,
      )}
    >
      {/* Name: always the whole name (up to two lines), coloured by the card's role. */}
      <span
        className={cn(
          "flex min-h-[2.3em] shrink-0 items-center justify-center rounded-md bg-black/70 px-0.5 text-center text-[length:var(--name)] font-extrabold leading-[1.1] [overflow-wrap:anywhere]",
          role.text,
        )}
      >
        {info.name}
      </span>
      <span className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-black/25 ring-1 ring-black/30">
        {art ? (
          <img src={art} alt="" draggable={false} className="h-full w-full object-cover object-[50%_60%]" />
        ) : (
          <span className="flex h-full items-center justify-center text-[length:var(--emoji)] leading-none drop-shadow-lg">{info.emoji}</span>
        )}
        {info.pack !== "base" && (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/55 px-0.5 text-[length:var(--name)] leading-tight">{PACKS[info.pack].emoji}</span>
        )}
      </span>
    </Tag>
  );
}
