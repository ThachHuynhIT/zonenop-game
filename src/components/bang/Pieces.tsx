"use client";

/* eslint-disable @next/next/no-img-element -- small static card art; next/image adds nothing here */
import { useEffect, useState } from "react";
import { BANG_ART, BANG_ART_VERSION, type BangArt } from "@/lib/bang/art";
import {
  CARD_TYPES,
  CHARACTERS,
  type CardKey,
  type CharKey,
  EVENTS,
  type EventKey,
  GEAR,
  type GearKey,
  PACKS,
  type Pack,
  ROLE_INFO,
  type Role,
  SUIT_SYMBOL,
  cardDef,
  isRedSuit,
  rankLabel,
  typeOf,
} from "@/lib/bang/cards";
import { cn } from "@/lib/utils";

/** Frame colour per card colour: brown = play & discard, blue = stays, green = stays, use later. */
const FRAME: Record<string, string> = {
  brown: "border-amber-700/80 bg-gradient-to-b from-[#f7ecd6] to-[#e8d3a9]",
  blue: "border-sky-600/80 bg-gradient-to-b from-[#e6f1fb] to-[#bcd8f2]",
  green: "border-emerald-600/80 bg-gradient-to-b from-[#e7f6ea] to-[#b9e2c3]",
};

const HAS_ART = new Set<string>(BANG_ART);
/** URL of a card's artwork (see scripts/card-art.mjs), or null → draw the emoji face. */
export const artSrc = (name: BangArt) => (HAS_ART.has(name) ? `/games/bang/cards/${name}.webp?v=${BANG_ART_VERSION}` : null);

export const suitText = (id: number) => {
  const d = cardDef(id);
  return `${rankLabel(d.rank)}${SUIT_SYMBOL[d.suit]}`;
};

/** A playing card face: emoji, name, rank + suit. */
export function CardFace({
  id,
  size = "md",
  selected,
  dim,
  onClick,
  badge,
  className,
}: {
  id: number;
  size?: "xs" | "sm" | "md" | "lg";
  selected?: boolean;
  dim?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
  className?: string;
}) {
  const d = cardDef(id);
  const t = typeOf(id);
  const w = { xs: "w-9", sm: "w-12", md: "w-[3.9rem] sm:w-[4.6rem] xl:w-[5.2rem] 2xl:w-[5.8rem] short:w-[3.6rem]", lg: "w-28" }[size];
  const art = artSrc(`card-${t.key}`);
  const title = `${t.name} ${suitText(id)}\n${t.text}`;
  const small = size === "xs" || size === "sm";
  const face = (
    <span
      className={cn(
        "relative flex aspect-[5/7] w-full select-none flex-col gap-[2px] overflow-hidden rounded-lg border-2 p-[2px] text-stone-900 shadow-md transition-[transform,opacity,filter] duration-150",
        FRAME[t.color],
        // Selected wins over hover: a hover lift never pulls a selected card back down.
        selected ? "-translate-y-2 ring-2 ring-amber-300 ring-offset-1 ring-offset-black" : onClick && "group-hover:-translate-y-1",
        // Greyed but still readable (name / suit / tooltip stay legible).
        dim && !selected && "opacity-60 grayscale",
      )}
    >
      {/* Top strip: rank + suit, then the full name (two lines when it's long). */}
      <span
        className={cn(
          "flex shrink-0 flex-col items-center rounded-md bg-[#f7ecd6]/95 px-0.5 text-center leading-[1.05]",
          size === "xs" ? "py-px" : "py-0.5",
        )}
      >
        <span
          className={cn(
            "self-start font-black",
            size === "xs" ? "text-[6px]" : size === "lg" ? "text-sm" : small ? "text-[8px]" : "text-[9px] sm:text-[10px]",
            isRedSuit(d.suit) ? "text-rose-700" : "text-stone-900",
          )}
        >
          {suitText(id)}
        </span>
        <span
          className={cn(
            "w-full font-extrabold [overflow-wrap:anywhere]",
            size === "xs" ? "line-clamp-1 text-[6px]" : size === "sm" ? "line-clamp-2 text-[8px]" : size === "lg" ? "text-sm" : "line-clamp-2 text-[9.5px] sm:text-[11px] 2xl:text-xs",
          )}
        >
          {t.name}
        </span>
      </span>
      {/* Artwork with rounded corners, or the emoji when a card has no art yet. */}
      <span className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-black/10 ring-1 ring-black/20">
        {art ? (
          <img src={art} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <span className={cn("leading-none", size === "xs" ? "text-sm" : size === "sm" ? "text-lg" : size === "lg" ? "text-5xl" : "text-2xl sm:text-3xl")} aria-hidden>
            {t.emoji}
          </span>
        )}
      </span>
      {badge}
    </span>
  );
  if (!onClick) {
    return (
      <div title={title} className={cn("relative shrink-0", w, className)}>
        {face}
      </div>
    );
  }
  // The button itself never moves: only the face inside lifts. If the hit area moved with the
  // hover / selected lift, a pointer near the card's edge would flicker in and out of :hover
  // (the card sinks, jumps back, …) and a selected card looked like it lost its selection.
  // -mt-2 pt-2 stretches the hit area over the lifted position without changing the layout.
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={!!selected}
      className={cn("group relative -mt-2 shrink-0 cursor-pointer rounded-lg pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300", w, className)}
    >
      {face}
    </button>
  );
}

export function CardBack({ className, count }: { className?: string; count?: number }) {
  const art = artSrc("back");
  return (
    <div className={cn("relative flex aspect-[5/7] w-10 items-center justify-center rounded-lg border-2 border-amber-900/70 bg-[repeating-linear-gradient(45deg,#7c2d12_0_5px,#92400e_5px_10px)] shadow-md", className)}>
      {art ? <img src={art} alt="" draggable={false} className="h-full w-full rounded-md object-cover" /> : <span className="text-lg">🤠</span>}
      {count !== undefined && <span className="absolute -right-2 -top-2 rounded-full bg-black/80 px-1.5 font-mono text-[10px] text-amber-200">{count}</span>}
    </div>
  );
}

/** A small chip for a card lying in front of someone. */
export function PlayChip({ id, cubes, fresh, onClick, active, compact }: { id: number; cubes?: number; fresh?: boolean; onClick?: () => void; active?: boolean; compact?: boolean }) {
  const t = typeOf(id);
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={`${t.name} ${suitText(id)}\n${t.text}${fresh ? "\n(dùng được từ lượt sau)" : ""}`}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border px-1 py-0.5 text-[11px] leading-none",
        t.color === "green" ? "border-emerald-400/50 bg-emerald-500/15" : "border-sky-400/50 bg-sky-500/15",
        fresh && "opacity-60",
        onClick && "cursor-pointer hover:bg-white/15",
        // Phones: a finger-sized target (the compact chips on other players' tiles are emoji only).
        onClick && "max-sm:min-h-8 max-sm:min-w-8 max-sm:justify-center max-sm:px-1.5 short:min-h-7 short:min-w-7 short:justify-center",
        active && "ring-2 ring-amber-300",
      )}
    >
      <span aria-hidden>{t.emoji}</span>
      {/* compact: emoji only on phones (the name is in the tooltip / on tap). */}
      <span className={cn("max-w-[5.5rem] truncate", compact && "max-sm:hidden short:hidden")}>{t.name}</span>
      {cubes ? <span className="ml-0.5 rounded bg-amber-400 px-0.5 font-bold text-black">{cubes}</span> : null}
    </Tag>
  );
}

export function Hearts({ life, max, dead }: { life: number; max: number; dead?: boolean }) {
  if (dead) return <span className="text-xs text-white/50">☠️</span>;
  return (
    <span className="inline-flex items-center gap-px text-[11px] leading-none" aria-label={`${life}/${max} máu`} title={`${life}/${max} máu`}>
      {max <= 6 ? (
        Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < life ? "" : "opacity-25 grayscale"}>
            ❤️
          </span>
        ))
      ) : (
        <>
          ❤️ <b className="ml-0.5">{life}</b>/{max}
        </>
      )}
    </span>
  );
}

export function RoleBadge({ role, small }: { role: Role | null; small?: boolean }) {
  if (!role) return <span className={cn("rounded bg-white/10 px-1 text-white/50", small ? "text-[10px]" : "text-xs")}>❓</span>;
  const tone: Record<Role, string> = {
    sheriff: "bg-amber-400 text-black",
    deputy: "bg-sky-400 text-black",
    outlaw: "bg-rose-600 text-white",
    renegade: "bg-violet-500 text-white",
  };
  return (
    <span className={cn("whitespace-nowrap rounded px-1 font-semibold", tone[role], small ? "text-[10px]" : "text-xs")} title={ROLE_INFO[role].goal}>
      {ROLE_INFO[role].emoji} {ROLE_INFO[role].name}
    </span>
  );
}

/** A character's portrait (art, or the emoji when there is none). `className` sizes the portrait. */
export function CharAvatar({ char, className, emojiClass }: { char: CharKey; className?: string; emojiClass?: string }) {
  const art = artSrc(`char-${char}`);
  if (!art) return <span className={emojiClass}>{CHARACTERS[char].emoji}</span>;
  return <img src={art} alt="" draggable={false} className={cn("inline-block aspect-[5/7] shrink-0 rounded-md border border-amber-900/40 object-cover object-top", className)} />;
}

export function CharCard({ char, onClick, selected, compact }: { char: CharKey; onClick?: () => void; selected?: boolean; compact?: boolean }) {
  const c = CHARACTERS[char];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-1 rounded-2xl border-2 bg-gradient-to-b from-[#fbf1dc] to-[#e7cf9f] p-3 text-left text-stone-900 shadow-lg",
        selected ? "border-amber-400 ring-2 ring-amber-300" : "border-amber-800/60",
        onClick && "transition-transform hover:-translate-y-1",
      )}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className="shrink-0">
          <CharAvatar char={char} className="w-12" emojiClass="text-3xl" />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-base leading-tight">{c.name}</b>
          <span className="text-xs text-stone-600">
            {"❤️".repeat(Math.min(c.life, 6))}
            {c.life > 6 ? ` ×${c.life}` : ""} · {PACKS[c.pack].emoji} {PACKS[c.pack].name}
          </span>
        </span>
      </span>
      {!compact && <span className="text-sm leading-snug">{c.text}</span>}
    </Tag>
  );
}

/** An event card's artwork, or nothing when it has none. */
export function EventArt({ event, className }: { event: EventKey; className?: string }) {
  const art = artSrc(`event-${event}`);
  return art ? <img src={art} alt="" draggable={false} className={cn("shrink-0 rounded-md object-cover", className)} /> : null;
}

export function EventBanner({ event, left, onClick }: { event: EventKey; left: number; onClick?: () => void }) {
  const e = EVENTS[event];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-xl border border-amber-300/40 bg-gradient-to-r from-amber-500/25 to-orange-700/20 px-3 py-1.5 text-left text-sm"
    >
      {artSrc(`event-${event}`) ? (
        <EventArt event={event} className="h-9 w-9" />
      ) : (
        <span className="text-xl" aria-hidden>
          {e.emoji}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <b className="text-amber-200">{e.name}</b>
        <span className="ml-1.5 text-amber-50/90 max-sm:line-clamp-1">{e.text}</span>
      </span>
      <span className="shrink-0 text-[10px] text-amber-100/60">còn {left}</span>
    </button>
  );
}

export function GearChip({ gear, onClick, price, disabled, compact }: { gear: GearKey; onClick?: () => void; price?: number; disabled?: boolean; compact?: boolean }) {
  const g = GEAR[gear];
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      title={`${g.name} (${g.cost} vàng)\n${g.text}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-yellow-400/50 bg-yellow-500/15 px-1.5 py-1 text-xs",
        onClick && "hover:bg-yellow-500/25 disabled:opacity-40",
      )}
    >
      <span aria-hidden>{g.emoji}</span>
      <span className={cn("max-w-[6rem] truncate", compact && "max-sm:hidden short:hidden")}>{g.name}</span>
      {price !== undefined && <span className="rounded bg-yellow-400 px-1 font-bold text-black">{price}🪙</span>}
    </Tag>
  );
}

/** Rules summary for the lobby and the in-game guide. */
export function BangRules() {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm">
      <li>
        3–8 người. Vai trò bí mật: <b>Cảnh sát trưởng</b> (lộ mặt, +1 máu) cùng các <b>Phó</b> phải diệt hết <b>Kẻ cướp</b> và <b>Kẻ phản bội</b>; Kẻ cướp cần hạ Cảnh sát trưởng; Kẻ phản bội phải là người sống sót cuối cùng. Chơi 3 người: Phó săn Kẻ phản bội, Kẻ phản bội săn Kẻ cướp, Kẻ cướp săn Phó.
      </li>
      <li>Đầu ván mỗi người chọn 1 trong 2 nhân vật; máu = số ❤️ của nhân vật, bài trên tay tối đa bằng số máu.</li>
      <li>Mỗi lượt: rút 2 lá → đánh bao nhiêu lá tuỳ thích (chỉ 1 lá BANG!) → bỏ bớt bài dư.</li>
      <li>
        <b>Khoảng cách</b> là số ghế giữa hai người (tính vòng ngắn nhất). BANG! chỉ bắn được người trong tầm súng (mặc định 1). Ngựa làm người khác nhìn bạn xa hơn; Ống ngắm giúp bạn nhìn gần hơn.
      </li>
      <li>Bị bắn thì đánh Trượt! để né. Hết máu thì tự động uống Bia (nếu còn hơn 2 người) để sống.</li>
      <li>Hạ Kẻ cướp được thưởng 3 lá. Cảnh sát trưởng lỡ tay bắn chết Phó thì phải bỏ hết bài.</li>
      <li>
        Lá <b className="text-amber-200">nâu</b> đánh xong bỏ; lá <b className="text-sky-300">xanh dương</b> đặt trước mặt và có tác dụng liên tục; lá <b className="text-emerald-300">xanh lá</b> (Né Đạn) đặt trước mặt, từ lượt sau mới bỏ ra để dùng.
      </li>
      <li>“Rút!” là lật lá trên cùng chồng bài và xem chất / số để quyết định (Thùng Gỗ, Nhà Giam, Thuốc Nổ…).</li>
      <li>Hết giờ mà chưa trả lời: máy đỡ giúp nếu bạn có Trượt!, không thì chịu đòn; hết giờ lượt thì tự bỏ bài dư và qua lượt.</li>
    </ul>
  );
}

/** Every card, character and event of the chosen packs. */
export function BangGuide({ packs, onClose }: { packs: Pack[]; onClose: () => void }) {
  const [tab, setTab] = useState<"cards" | "chars" | "events" | "gear" | "rules">("cards");
  const on = (p: Pack) => p === "base" || packs.includes(p);
  const cards = (Object.keys(CARD_TYPES) as CardKey[]).filter((k) => on(CARD_TYPES[k].pack));
  const chars = (Object.keys(CHARACTERS) as CharKey[]).filter((k) => on(CHARACTERS[k].pack));
  const events = (Object.keys(EVENTS) as EventKey[]).filter((k) => on(EVENTS[k].pack));
  const tabs = [
    ["cards", `🃏 Lá bài (${cards.length})`],
    ["chars", `🤠 Nhân vật (${chars.length})`],
    ...(events.length ? [["events", `📰 Sự kiện (${events.length})`]] : []),
    ...(on("goldrush") ? [["gear", "💰 Trang bị"]] : []),
    ["rules", "📖 Luật"],
  ] as [typeof tab, string][];
  return (
    <Sheet
      onClose={onClose}
      title="📖 Hướng dẫn Đấu Súng"
      tabs={
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 text-xs font-semibold [scrollbar-width:none]" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn("min-h-8 shrink-0 rounded-md px-2.5 py-1.5 max-sm:min-h-9", tab === id ? "bg-amber-400 text-black" : "bg-white/5 text-amber-50/80 hover:bg-white/10")}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {tab === "cards" && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {cards.map((k) => {
            const t = CARD_TYPES[k];
            return (
              <li key={k} className="flex gap-2 rounded-lg bg-white/5 p-2 text-sm">
                <span className="text-2xl" aria-hidden>
                  {t.emoji}
                </span>
                <span>
                  <b className={t.color === "blue" ? "text-sky-300" : t.color === "green" ? "text-emerald-300" : "text-amber-200"}>{t.name}</b>
                  {t.range ? <span className="ml-1 text-xs text-white/60">tầm {t.range}</span> : null}
                  <span className="ml-1 text-xs text-white/40">{PACKS[t.pack].emoji}</span>
                  <span className="block text-white/80">{t.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {tab === "chars" && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {chars.map((k) => (
            <li key={k}>
              <CharCard char={k} />
            </li>
          ))}
        </ul>
      )}
      {tab === "events" && (
        <ul className="space-y-2">
          {events.map((k) => (
            <li key={k} className="rounded-lg bg-white/5 p-2 text-sm">
              <b className="text-amber-200">
                {EVENTS[k].emoji} {EVENTS[k].name}
              </b>
              {EVENTS[k].final && <span className="ml-1 rounded bg-rose-600 px-1 text-[10px]">cuối</span>}
              <span className="ml-1 text-xs text-white/40">{PACKS[EVENTS[k].pack].name}</span>
              <span className="block text-white/80">{EVENTS[k].text}</span>
            </li>
          ))}
        </ul>
      )}
      {tab === "gear" && (
        <div className="space-y-2 text-sm">
          <p className="text-white/70">Cuối lượt, mỗi lá bạn bỏ (kể cả bỏ thêm tuỳ ý) được 1 vàng. Trong lượt, mua trang bị ở cửa hàng 3 món; trang bị giữ lại không bị cướp.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(GEAR) as GearKey[]).map((k) => (
              <li key={k} className="rounded-lg bg-white/5 p-2">
                <b className="text-yellow-200">
                  {GEAR[k].emoji} {GEAR[k].name}
                </b>{" "}
                <span className="text-xs text-white/60">
                  {GEAR[k].cost} vàng · {GEAR[k].kind === "instant" ? "dùng ngay" : "giữ lại"}
                </span>
                <span className="block text-white/80">{GEAR[k].text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {tab === "rules" && <BangRules />}
    </Sheet>
  );
}

/**
 * Modal that becomes a bottom sheet on phones: the title and ✕ stay put while the body scrolls,
 * plus a big "Đóng" bar on phones (same pattern as the other games' dialogs). Esc closes it.
 * `tabs` (e.g. the guide's tab row) sit in the fixed header too.
 */
export function Sheet({ children, onClose, title, tabs }: { children: React.ReactNode; onClose: () => void; title?: string; tabs?: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#1f140c] text-amber-50 shadow-2xl sm:rounded-2xl short:max-h-[96dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full bg-white/10 text-lg leading-none text-white shadow hover:bg-white/20"
          aria-label="Đóng"
        >
          ✕
        </button>
        {(title || tabs) && (
          <div className="shrink-0 border-b border-white/10 px-4 pb-2 pt-3 pr-12 sm:px-5">
            {title && <h2 className="mb-2 text-lg font-black leading-tight text-amber-300">{title}</h2>}
            {tabs}
          </div>
        )}
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5", !title && !tabs && "pr-12 sm:pr-12")}>{children}</div>
        <button
          onClick={onClose}
          className="shrink-0 border-t border-white/10 bg-black/20 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm font-semibold text-amber-100 sm:hidden short:py-2"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
