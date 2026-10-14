"use client";
/* eslint-disable @next/next/no-img-element -- small static game sprites; next/image adds nothing here */

import { CARDS, CARD_BY_ID, GEMS, GEM_NAMES, type Gem, NOBLE_BY_ID, type Token } from "@/lib/splendor/cards";
import { cn } from "@/lib/utils";

/**
 * Card art: the owner's own illustrations (public/games/splendor), cut into
 *   cards/<colour>-<tier>-<1..3>.webp, nobles/n<1..10>.webp, gems/<token>.webp.
 */
const ASSETS = "/games/splendor";
export const gemSrc = (t: Token) => `${ASSETS}/gems/${t}.webp`;
const nobleSrc = (id: number) => `${ASSETS}/nobles/n${id}.webp`;

/** Each colour/tier has 3 scenes; cards of that colour and tier take turns using them. */
const VARIANT: Record<number, number> = (() => {
  const seen: Record<string, number> = {};
  return Object.fromEntries(
    CARDS.map((c) => {
      const key = `${c.bonus}-${c.tier}`;
      seen[key] = (seen[key] ?? 0) + 1;
      return [c.id, ((seen[key] - 1) % 3) + 1];
    }),
  );
})();
const cardArt = (id: number) => {
  const c = CARD_BY_ID[id];
  return `${ASSETS}/cards/${c.bonus}-${c.tier}-${VARIANT[id]}.webp`;
};

export const GEM_STYLE: Record<Token, { base: string; light: string; dark: string; text: string }> = {
  white: { base: "#e5e7eb", light: "#ffffff", dark: "#9ca3af", text: "#111827" },
  blue: { base: "#2563eb", light: "#93c5fd", dark: "#1e3a8a", text: "#ffffff" },
  green: { base: "#16a34a", light: "#86efac", dark: "#14532d", text: "#ffffff" },
  red: { base: "#dc2626", light: "#fca5a5", dark: "#7f1d1d", text: "#ffffff" },
  black: { base: "#374151", light: "#9ca3af", dark: "#030712", text: "#ffffff" },
  gold: { base: "#f59e0b", light: "#fde68a", dark: "#92400e", text: "#1c1917" },
};

/** Card frame per bonus colour: gilded edge + the gem's colour. */
const FRAME: Record<Gem, string> = {
  white: "linear-gradient(145deg,#fff7e0,#d8d2c4 40%,#a8a29e 60%,#f5f5f4)",
  blue: "linear-gradient(145deg,#fde68a,#1d4ed8 35%,#1e3a8a 65%,#fbbf24)",
  green: "linear-gradient(145deg,#fde68a,#15803d 35%,#14532d 65%,#fbbf24)",
  red: "linear-gradient(145deg,#fde68a,#b91c1c 35%,#7f1d1d 65%,#fbbf24)",
  black: "linear-gradient(145deg,#fde68a,#27272a 35%,#09090b 65%,#fbbf24)",
};

/** The gem artwork (round gilded coin). */
export function GemIcon({ gem, className }: { gem: Token; className?: string }) {
  return <img src={gemSrc(gem)} alt={GEM_NAMES[gem]} className={cn("select-none object-contain drop-shadow", className)} draggable={false} />;
}

/** A gem with a number on it — used for costs and requirements. */
export function GemCount({ gem, n, className }: { gem: Gem; n: number; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)} title={`${n} ${GEM_NAMES[gem]}`}>
      <GemIcon gem={gem} className="absolute inset-0 h-full w-full" />
      <span className="relative text-[0.8em] font-black text-white [text-shadow:0_0_3px_#000,0_0_2px_#000,0_1px_1px_#000]">{n}</span>
    </span>
  );
}

/** A token in the bank or a player's hand. */
export function TokenChip({
  gem,
  count,
  size = "md",
  selected,
  dimmed,
  onClick,
  title,
  hotkey,
}: {
  gem: Token;
  count?: number;
  size?: "sm" | "md" | "lg";
  selected?: number;
  dimmed?: boolean;
  onClick?: () => void;
  title?: string;
  /** Keyboard shortcut hint (desktop, non-touch only). */
  hotkey?: string;
}) {
  // The bank row (6 lg chips) has to fit a 360px-wide phone on one line.
  const px = size === "lg" ? "h-11 w-11 min-[400px]:h-14 min-[400px]:w-14 sm:h-16 sm:w-16 short:h-10 short:w-10" : size === "md" ? "h-11 w-11" : "h-7 w-7 sm:h-8 sm:w-8";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      title={title ?? GEM_NAMES[gem]}
      className={cn("relative shrink-0 rounded-full transition-transform", onClick && "hover:-translate-y-0.5 active:scale-95", dimmed && "opacity-35 grayscale", !!selected && "ring-4 ring-amber-300")}
    >
      <GemIcon gem={gem} className={px} />
      {count !== undefined && (
        <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/85 px-1 text-[11px] font-bold text-white ring-1 ring-amber-200/40">
          {count}
        </span>
      )}
      {hotkey && (
        <kbd className="absolute -right-1 -top-1 hidden rounded border border-white/30 bg-black/80 px-1 font-mono text-[10px] font-normal leading-4 text-white/80 lg:inline [@media(pointer:coarse)]:hidden">{hotkey}</kbd>
      )}
      {!!selected && (
        <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-black text-black shadow">
          +{selected}
        </span>
      )}
    </Tag>
  );
}

const TIER_MARK = { 1: "I", 2: "II", 3: "III" } as const;
/**
 * Width of an md market card / deck: 5 per row on any phone (page + market padding ≈ 4.75rem); bigger on
 * tablets; on PCs the three rows fill the screen height (≈15rem goes to the bar, turn line and bank).
 */
export const MD_CARD_W =
  "w-[min(4.8rem,calc((100vw-4.75rem)/5))] sm:w-[6.5rem] md:w-[7.5rem] lg:w-[clamp(6.5rem,calc((100dvh-15rem)*5/21),11.5rem)] short:w-[min(4.4rem,calc((100dvh-7.5rem)*5/21))]";

/**
 * Market-row slot: the card keeps its `MD_CARD_W` width (a definite `width`, so the column gets its natural size) but may shrink (never grow) so a row of deck + 4 cards
 * fits whatever room the column has — no horizontal scrolling. The card inside is `size="fluid"` (fills the slot).
 */
export const MD_SLOT =
  "min-w-0 shrink grow-0 w-[min(4.8rem,calc((100vw-4.75rem)/5))] sm:w-[6.5rem] md:w-[7.5rem] lg:w-[clamp(6.5rem,calc((100dvh-15rem)*5/21),11.5rem)] short:w-[min(4.4rem,calc((100dvh-7.5rem)*5/21))]";

/** A development card: illustration, colour frame, points + bonus on top, cost in gems at the bottom. */
export function DevCardView({
  id,
  size = "md",
  onClick,
  affordable,
  highlight,
  className,
}: {
  id: number;
  /** `fluid`: as wide as its parent (a market-row slot, see `MD_SLOT`). */
  size?: "sm" | "md" | "lg" | "fluid";
  onClick?: () => void;
  affordable?: boolean;
  highlight?: boolean;
  className?: string;
}) {
  const card = CARD_BY_ID[id];
  const Tag = onClick ? "button" : "div";
  // md: a market row (deck + 4 cards) always fits the phone width; smaller when the phone is sideways.
  const w = size === "lg" ? "w-44" : size === "md" ? MD_CARD_W : size === "fluid" ? "w-full" : "w-14";
  const costs = GEMS.filter((g) => card.cost[g]);
  const gemSize =
    size === "lg" ? "h-9 w-9 text-lg" : size === "md" || size === "fluid" ? "h-[1.15rem] w-[1.15rem] text-[11px] sm:h-6 sm:w-6 sm:text-sm xl:h-7 xl:w-7 xl:text-base short:h-[1.15rem] short:w-[1.15rem] short:text-[11px]" : "h-3 w-3 text-[7px]";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "relative aspect-[5/7] shrink-0 rounded-lg p-[3px] text-left shadow-lg transition-transform",
        w,
        onClick && "hover:-translate-y-1 hover:shadow-xl",
        affordable && "outline outline-2 outline-offset-1 outline-emerald-400",
        highlight && "outline outline-2 outline-offset-1 outline-amber-300",
        className,
      )}
      style={{ background: FRAME[card.bonus] }}
      title={`Thẻ ${GEM_NAMES[card.bonus]} · ${card.points} điểm · giá ${costs.map((g) => `${card.cost[g]} ${GEM_NAMES[g]}`).join(", ")}`}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[5px]">
        <img src={cardArt(id)} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" draggable={false} />
        {/* Top: points and the bonus gem. */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/70 via-black/35 to-transparent px-1 pb-3 pt-0.5">
          <span
            className={cn(
              "font-black leading-none text-white [text-shadow:0_2px_3px_#000]",
              size === "lg" ? "text-4xl" : size === "md" ? "text-lg sm:text-2xl xl:text-3xl short:text-lg" : "text-xs",
            )}
          >
            {card.points || ""}
          </span>
          <GemIcon gem={card.bonus} className={size === "lg" ? "h-11 w-11" : size === "md" ? "h-6 w-6 sm:h-8 sm:w-8 xl:h-10 xl:w-10 short:h-6 short:w-6" : "h-4 w-4"} />
        </div>
        {/* Bottom: the cost, as gems. */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/75 via-black/40 to-transparent px-0.5 pb-0.5 pt-3">
          <div className="flex flex-wrap gap-[1px]">
            {costs.map((g) => (
              <GemCount key={g} gem={g} n={card.cost[g]!} className={gemSize} />
            ))}
          </div>
          <span className="pr-0.5 text-[8px] font-bold text-amber-200/80">{TIER_MARK[card.tier]}</span>
        </div>
      </div>
    </Tag>
  );
}

const BACKS: Record<1 | 2 | 3, { art: string; color: string }> = {
  1: { art: `${ASSETS}/cards/green-1-1.webp`, color: "#65a30d" },
  2: { art: `${ASSETS}/cards/blue-2-3.webp`, color: "#d97706" },
  3: { art: `${ASSETS}/cards/red-3-2.webp`, color: "#2563eb" },
};

/** A deck of one tier (card back). */
export function CardBack({ tier, count, onClick, size = "md" }: { tier: 1 | 2 | 3; count?: number; onClick?: () => void; size?: "sm" | "md" | "fluid" }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "relative aspect-[5/7] shrink-0 rounded-lg p-[3px] shadow-lg",
        size === "md" ? MD_CARD_W : size === "fluid" ? "w-full" : "w-14",
        onClick && "hover:-translate-y-1",
      )}
      style={{ background: `linear-gradient(145deg,#fde68a,${BACKS[tier].color} 40%,#1c1917 70%,#fbbf24)` }}
      title={`Chồng thẻ cấp ${tier}`}
    >
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[5px]">
        <img src={BACKS[tier].art} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 blur-[1px] sepia" draggable={false} />
        <div className="absolute inset-2 rounded border border-amber-300/60" />
        <span className="relative rounded-full bg-black/70 px-2 py-0.5 font-serif text-base font-black text-amber-200">{TIER_MARK[tier]}</span>
        {count !== undefined && <span className="relative mt-1 rounded bg-black/70 px-1.5 text-[10px] text-amber-100/90">{count} thẻ</span>}
      </div>
    </Tag>
  );
}

/** Noble tile: portrait (transparent), 3 points, required card bonuses as gems. */
export function NobleTile({ id, size = "md", dim }: { id: number; size?: "sm" | "md"; dim?: boolean }) {
  const n = NOBLE_BY_ID[id];
  const req = GEMS.filter((g) => n.req[g]);
  return (
    <div
      className={cn(
        "relative aspect-square shrink-0 overflow-hidden rounded-lg p-[2px] shadow-lg",
        size === "md" ? "w-[min(4.5rem,calc((100vw-4.75rem)/5))] sm:w-24 short:w-[min(4rem,calc((50vw-4rem)/5))]" : "w-10",
        dim && "opacity-40",
      )}
      style={{ background: "linear-gradient(145deg,#fef3c7,#b8893a 45%,#7c5a1f 70%,#fde68a)" }}
      title={`Quý tộc · ${n.points} điểm · cần ${req.map((g) => `${n.req[g]} thẻ ${GEM_NAMES[g]}`).join(", ")}`}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[6px] bg-[radial-gradient(circle_at_60%_40%,#fff7e6,#e9dcc0)]">
        <img src={nobleSrc(id)} alt="Quý tộc" className="absolute bottom-0 right-0 h-[92%] w-[80%] object-contain object-bottom" draggable={false} />
        <span
          className={cn("absolute left-1 top-0.5 font-black text-stone-900 [text-shadow:0_1px_0_#fff]", size === "md" ? "text-lg sm:text-2xl" : "text-xs")}
        >
          {n.points}
        </span>
        <div className="absolute bottom-0.5 left-0.5 flex flex-col gap-[1px]">
          {req.map((g) => (
            <span
              key={g}
              className={cn("flex items-center justify-center rounded-sm border border-amber-100/70 font-black shadow", size === "md" ? "h-4 w-4 text-[10px] sm:h-5 sm:w-5 sm:text-xs" : "h-2.5 w-2.5 text-[7px]")}
              style={{ background: GEM_STYLE[g].base, color: GEM_STYLE[g].text }}
            >
              {n.req[g]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Owned-card count per colour (the permanent discount). */
export function BonusPip({ gem, n }: { gem: Gem; n: number }) {
  return (
    <span className={cn("relative flex h-6 w-5 items-center justify-center rounded border sm:h-7 sm:w-6 border-amber-200/30 shadow", !n && "opacity-35")} style={{ background: FRAME[gem] }} title={`${n} thẻ ${GEM_NAMES[gem]}`}>
      <span className="text-[12px] font-black text-white [text-shadow:0_0_3px_#000]">{n}</span>
    </span>
  );
}
