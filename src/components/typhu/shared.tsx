"use client";

import { UTIL_MULT, isOwnable, type Group, type Square } from "@/lib/typhu/board";
import type { TPGameView, TPSeatView, TPSettings } from "@/lib/typhu/protocol";
import { GameButton } from "@/components/game-ui/GameButton";
import { GameDialog } from "@/components/game-ui/GameDialog";
import { cn } from "@/lib/utils";
import { rentAmount } from "./board/layout";
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
  className,
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
  className?: string;
}) {
  return (
    <GameButton
      size="md"
      variant={danger ? "danger" : primary || build ? "primary" : "secondary"}
      shine={build}
      onClick={onClick}
      disabled={disabled}
      title={title}
      // The centre panel is pale: the translucent-white secondary style would be unreadable on it.
      className={cn(!primary && !danger && !build && "bg-emerald-900/80 text-white hover:bg-emerald-800/90", className)}
    >
      {children}
      {hotkey && (
        <kbd className="hidden rounded border border-current/30 bg-black/10 px-1 font-mono text-[10px] font-normal opacity-70 lg:inline [@media(pointer:coarse)]:hidden">{hotkey}</kbd>
      )}
    </GameButton>
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
  const count = Object.entries(g.deeds).filter(([p, x]) => x.owner === d.owner && boardRef.current[Number(p)].kind === b.kind).length;
  // The number comes from rentAmount, the same helper the board squares use, so the two never disagree.
  const full = b.kind === "prop" && groupPositions(b.group).every((p) => g.deeds[p]?.owner === d.owner);
  const amount = rentAmount(b, d, count, full);
  if (b.kind === "prop") return { text: money(amount ?? 0), row: d.houses > 0 ? d.houses : 0 };
  if (b.kind === "air") return { text: money(amount ?? 0), row: count - 1 };
  return { text: `tổng xúc xắc × ${UTIL_MULT[count >= 2 ? 1 : 0]}`, row: count >= 2 ? 1 : 0 };
}

/**
 * Dialog for the table: a drawer on phones, centred from `md` up (GameDialog; Esc and the "Đóng" button close it).
 * `dark` for the pre-styled dark content (it brings its own heading); otherwise the cream surface with dark text.
 * Without a `title` the heading is kept for screen readers only.
 */
export function Modal({ children, onClose, dark, title }: { children: React.ReactNode; onClose: () => void; dark?: boolean; title?: string }) {
  return (
    <GameDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title ?? "Chi tiết"}
      hideTitle={!title}
      light={!dark}
      footer={
        <GameButton size="sm" variant={dark ? "secondary" : "primary"} onClick={onClose}>
          Đóng
        </GameButton>
      }
    >
      {children}
    </GameDialog>
  );
}
