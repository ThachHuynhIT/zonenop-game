"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AIR_RENT, UTIL_MULT, isOwnable, type Group, type Square } from "@/lib/typhu/board";
import type { TPGameView, TPSeatView, TPSettings } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { boardRef, groupPositions } from "./board-ref";

/** A seat's token. A server from before token picking sends no `piece`: fall back to the starting token of the seat. */
export const pieceOfSeat = (seat: TPSeatView) => seat.piece ?? TOKENS[seat.color % TOKENS.length];

export const TOKENS = [
  { emoji: "🛵", color: "#ef4444" },
  { emoji: "🐃", color: "#3b82f6" },
  { emoji: "🚲", color: "#22c55e" },
  { emoji: "🚤", color: "#eab308" },
  { emoji: "🐉", color: "#a855f7" },
  { emoji: "🎩", color: "#f97316" },
];

/** Illustrated icons (public/games/typhu/icons/<name>.webp) for the special squares; the emoji stay as a fallback. */
export const SQUARE_IMG: Partial<Record<Square["kind"], string>> = {
  go: "go",
  air: "air",
  chance: "chance",
  chest: "chest",
  tax: "tax",
  jail: "jail",
  parking: "parking",
  gotojail: "gotojail",
};

/** The picture for a square kind (utilities pick Điện / Nước by name), or null when it has none. */
export const squareImg = (sq: Square): string | null => (sq.kind === "util" ? (sq.name.includes("Điện") ? "electric" : "water") : SQUARE_IMG[sq.kind] ?? null);

export function ArtIcon({ name, className }: { name: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/games/typhu/icons/${name}.webp`} alt="" draggable={false} className={cn("inline-block shrink-0 object-contain", className)} />;
}


export const money = (n: number) => `${n.toLocaleString("vi-VN")}tr`;

export type Act = (msg: Record<string, unknown> & { type: string }) => Promise<boolean>;

/** A little house or hotel (illustrated icons, public/games/typhu/icons/{house,hotel}.webp). */
export function Building({ hotel, className }: { hotel?: boolean; className?: string }) {
  return <ArtIcon name={hotel ? "hotel" : "house"} className={cn("drop-shadow-sm", className)} />;
}

export const GROUP_NAMES: Record<Group, string> = {
  brown: "Nâu",
  lightblue: "Xanh nhạt",
  pink: "Hồng",
  orange: "Cam",
  red: "Đỏ",
  yellow: "Vàng",
  green: "Xanh lá",
  darkblue: "Xanh đậm",
};
export const ALL_GROUPS = Object.keys(GROUP_NAMES) as Group[];

/** Colour groups `id` can build in: every city owned, or (without the full-group rule) at least one. */
export function buildableGroups(g: TPGameView, id: string, needGroup: boolean): Group[] {
  return ALL_GROUPS.filter((grp) => {
    const cells = groupPositions(grp);
    return needGroup ? cells.every((p) => g.deeds[p]?.owner === id) : cells.some((p) => g.deeds[p]?.owner === id);
  });
}

/** One-line summary of the table's building rule. */
export const buildRuleText = (st: TPSettings) =>
  (st.buildRule === "chain"
    ? "Xây theo chuỗi: nhà 2 / nhà 3 cần 2 ô trong nhóm có nhà 1 / nhà 2, nhà 4 cần cả nhóm 3 nhà, khách sạn cần cả nhóm 4 nhà."
    : "Xây đều từng ô trong nhóm; 4 nhà rồi lên khách sạn.") + (st.needGroup === false ? " Không cần đủ nhóm màu, nhưng chưa đủ nhóm thì tối đa 3 nhà (nhà 4 / khách sạn cần đủ nhóm)." : "");

export function CBtn({
  children,
  onClick,
  disabled,
  primary,
  danger,
  build,
  title,
  hotkey,
}: {
  children: React.ReactNode;
  onClick: () => void;
  /** Keyboard shortcut shown on the button (desktop only). */
  hotkey?: string;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  /** The house-building button: stands out next to the main action. */
  build?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-semibold shadow transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm",
        primary && "bg-emerald-700 text-white enabled:hover:bg-emerald-600",
        danger && "bg-rose-600 text-white enabled:hover:bg-rose-500",
        build && "bg-gradient-to-b from-amber-300 to-orange-500 text-black shadow-[0_3px_0_#9a3412] enabled:hover:brightness-110 enabled:active:translate-y-0.5",
        !primary && !danger && !build && "border border-emerald-800/30 bg-white/70 enabled:hover:bg-white",
      )}
    >
      {children}
      {hotkey && (
        <kbd className="ml-1.5 hidden rounded border border-current/30 bg-black/10 px-1 align-middle font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">{hotkey}</kbd>
      )}
    </button>
  );
}

/** Why a lot can't be mortgaged: only my own houses in the group get in the way. */
export function mortgageBlocker(g: TPGameView, meId: string, pos: number): string | null {
  const sq = boardRef.current[pos];
  const d = g.deeds[pos];
  if (!d || d.owner !== meId) return "Đây không phải đất của bạn";
  if (d.mortgaged) return "Đã thế chấp rồi";
  if (sq.kind === "prop" && groupPositions(sq.group).some((p) => g.deeds[p]?.owner === meId && g.deeds[p].houses > 0)) return "Bán hết nhà của bạn trong nhóm trước";
  return null;
}

/** What landing on an owned square costs right now: the amount (null = depends on the dice) and the row of the rent table it comes from. */
export function rentDue(g: TPGameView, pos: number): { text: string; row: number | null; free?: boolean } | null {
  const d = g.deeds[pos];
  const b = boardRef.current[pos];
  if (!d || !isOwnable(b)) return null;
  if (d.mortgaged) return { text: "0 — đang thế chấp", row: null, free: true };
  if (b.kind === "prop") {
    if (d.houses > 0) return { text: money(b.rent[d.houses]), row: d.houses };
    const full = groupPositions(b.group).every((p) => g.deeds[p]?.owner === d.owner);
    return { text: money(full ? b.rent[0] * 2 : b.rent[0]), row: 0 };
  }
  const count = Object.entries(g.deeds).filter(([p, x]) => x.owner === d.owner && boardRef.current[Number(p)].kind === b.kind).length;
  if (b.kind === "air") return { text: money(AIR_RENT[Math.max(0, count - 1)]), row: count - 1 };
  return { text: `tổng xúc xắc × ${UTIL_MULT[count >= 2 ? 1 : 0]}`, row: count >= 2 ? 1 : 0 };
}

/**
 * Dialog: a bottom sheet on phones (backdrop above it to tap away, a full-width "Đóng" bar at the bottom),
 * centred from `sm` up. The ✕ stays put while the content scrolls; Esc closes too.
 */
export function Modal({ children, onClose, dark }: { children: React.ReactNode; onClose: () => void; dark?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Portalled to <body>: a dialog opened from inside the board centre must not be trapped by its overflow / filter containing block.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        className={cn(
          "relative flex max-h-[82dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl text-left shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl",
          dark ? "border border-white/10 bg-[#0c2233] text-sky-50" : "bg-[#f4efe1]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className={cn(
            "absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full text-lg leading-none shadow",
            dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-black/35 text-white hover:bg-black/50",
          )}
          aria-label="Đóng"
        >
          ✕
        </button>
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", dark && "p-5 [&>h2:first-child]:pr-10")}>{children}</div>
        <button
          onClick={onClose}
          className={cn(
            "shrink-0 border-t py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm font-semibold sm:hidden",
            dark ? "border-white/10 bg-black/20 text-sky-100" : "border-emerald-900/15 bg-white/60 text-emerald-950",
          )}
        >
          Đóng
        </button>
      </div>
    </div>,
    document.body,
  );
}
